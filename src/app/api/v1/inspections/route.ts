import { authenticateApiRequest, json, apiError } from "@/lib/api-auth";
import { db } from "@/db";
import { inspections, vehicles } from "@/db/schema";
import type { InspectionSectionData } from "@/db/schema";
import { desc, sql, eq, and } from "drizzle-orm";
import { newId } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { canApprove } from "@/lib/auth";
import { inspectionCreateSchema, zodDetails } from "@/lib/api-schemas";
import { parseApiPagination } from "@/lib/api-pagination";
import { assessInspectionOutcome, deriveVehicleStatusAfterInspection } from "@/lib/inspection-policy";
import { getSettings } from "@/lib/settings";
import { formatServerTiming, timeOperation } from "@/lib/performance";

const RESULTS = new Set(["pass", "conditional_pass", "reinspection_required", "fail"]);

export async function POST(request: Request) {
  const auth = await authenticateApiRequest({ scopes: ["inspect"], permission: "inspections" });
  if (!auth.ok) return apiError(auth.status, auth.message);

  try {
    const parsed = inspectionCreateSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(400, "Invalid inspection payload", zodDetails(parsed.error));
    const body = parsed.data;

    if (body.workflowStatus === "approved" && !canApprove(auth.user)) {
      return apiError(403, "Approval permission is required to create an approved inspection");
    }

    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, body.vehicleId));
    if (!vehicle) return apiError(404, "Vehicle not found");
    if (vehicle.status === "decommissioned") {
      return apiError(409, "A decommissioned vehicle cannot be inspected");
    }

    const assessment = assessInspectionOutcome(body.overallResult, body.sectionData);
    if (!assessment.ok) {
      return apiError(422, assessment.message || "Inspection outcome is inconsistent with the checklist", {
        failed_items: assessment.failedNames,
        critical_failed_items: assessment.criticalFailedNames,
      });
    }

    const settings = await getSettings();
    const nextVehicleStatus = deriveVehicleStatusAfterInspection(
      body.overallResult,
      body.workflowStatus,
      settings.requireSupervisorApproval
    );

    const now = new Date();
    const id = newId();
    const datePart = now.toISOString().slice(0, 10).replaceAll("-", "");
    const inspectionNumber = `INS-${datePart}-${id.slice(0, 8).toUpperCase()}`;

    const sectionData: InspectionSectionData[] = body.sectionData.map((section) => ({
      section: section.section,
      title: section.title,
      items: section.items.map((item) => ({
        name: item.name,
        result: item.result,
        severity: item.severity,
        remarks: item.remarks ?? undefined,
        photos: item.photos?.map((photo) => ({
          id: photo.id,
          dataUrl: photo.dataUrl,
          caption: photo.caption ?? undefined,
          takenAt: photo.takenAt,
        })),
      })),
    }));

    await db.transaction(async (tx) => {
      await tx.insert(inspections).values({
        id,
        inspectionNumber,
        vehicleId: body.vehicleId,
        inspectionDate: now,
        overallResult: body.overallResult,
        inspectorId: auth.user.id,
        inspectorName: body.inspectorName || auth.user.name,
        station: body.station || null,
        workflowStatus: body.workflowStatus,
        sectionData,
      });

      if (nextVehicleStatus) {
        await tx.update(vehicles)
          .set({ status: nextVehicleStatus as any, updatedAt: new Date() })
          .where(eq(vehicles.id, body.vehicleId));
      }
    });

    await logAudit({
      userId: auth.user.id,
      userName: auth.user.name,
      action: "create",
      entityType: "inspection",
      entityId: id,
      entityLabel: inspectionNumber,
      summary: `Created inspection for vehicle ${vehicle.registrationNumber}`,
      after: {
        overallResult: body.overallResult,
        workflowStatus: body.workflowStatus,
        failedItemCount: assessment.failedCount,
        criticalFailedItemCount: assessment.criticalFailedCount,
        vehicleStatus: nextVehicleStatus,
      },
    });

    return json({ data: { id, inspectionNumber } }, 201);
  } catch (error) {
    console.error("Failed to create inspection:", error instanceof Error ? error.message : error);
    return apiError(500, "Failed to create inspection");
  }
}

export async function GET(request: Request) {
  const auth = await authenticateApiRequest({ scopes: ["read"], permission: "inspections" });
  if (!auth.ok) return apiError(auth.status, auth.message);

  const url = new URL(request.url);
  const pagination = parseApiPagination(url.searchParams);
  if (!pagination.ok) return apiError(400, pagination.message);
  const { limit, offset } = pagination;

  const result = url.searchParams.get("result");
  const vehicleId = url.searchParams.get("vehicle_id")?.trim() || null;
  if (result && !RESULTS.has(result)) return apiError(400, "Invalid inspection result");
  if (vehicleId && vehicleId.length > 64) return apiError(400, "vehicle_id is too long");

  const where = [];
  if (result) where.push(eq(inspections.overallResult, result as "pass" | "conditional_pass" | "reinspection_required" | "fail"));
  if (vehicleId) where.push(eq(inspections.vehicleId, vehicleId));
  const predicate = where.length ? and(...where) : undefined;

  const started = performance.now();
  const [rowsQuery, countQuery] = await Promise.all([
    timeOperation("inspections_list", async () => db
      .select({
        id: inspections.id,
        inspectionNumber: inspections.inspectionNumber,
        inspectionDate: inspections.inspectionDate,
        overallResult: inspections.overallResult,
        workflowStatus: inspections.workflowStatus,
        inspectorName: inspections.inspectorName,
        station: inspections.station,
        vehicleId: inspections.vehicleId,
        vehicleRegistration: vehicles.registrationNumber,
        vehicleMake: vehicles.make,
        vehicleModel: vehicles.model,
      })
      .from(inspections)
      .innerJoin(vehicles, eq(vehicles.id, inspections.vehicleId))
      .where(predicate)
      .orderBy(desc(inspections.inspectionDate))
      .limit(limit)
      .offset(offset)),
    timeOperation("inspections_count", async () => db
      .select({ n: sql<number>`count(*)::int` })
      .from(inspections)
      .where(predicate)),
  ]);
  const totalDurationMs = performance.now() - started;
  const [countRow] = countQuery.value;

  return json({
    data: rowsQuery.value,
    pagination: { limit, offset, total: countRow?.n || 0 },
    links: { self: "/api/v1/inspections", vehicle: "/api/v1/vehicles/:id", inspection: "/api/v1/inspections/:id" },
  }, 200, {
    "Server-Timing": formatServerTiming([
      { name: "inspections_list", durationMs: rowsQuery.durationMs },
      { name: "inspections_count", durationMs: countQuery.durationMs },
    ], totalDurationMs),
  });
}
