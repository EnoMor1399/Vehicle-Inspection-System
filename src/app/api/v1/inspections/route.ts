import { authenticateApiRequest, json, apiError } from "@/lib/api-auth";
import { db } from "@/db";
import { inspections, vehicles } from "@/db/schema";
import type { InspectionSectionData } from "@/db/schema";
import { desc, sql, eq, and } from "drizzle-orm";
import { newId } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { canApprove } from "@/lib/auth";
import { inspectionCreateSchema, zodDetails } from "@/lib/api-schemas";

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

    const failedItems = body.sectionData.flatMap((section) => section.items).filter((item) => item.result === "fail");
    if (body.overallResult === "pass" && failedItems.length > 0) {
      return apiError(422, "A PASS result cannot contain failed inspection items", {
        failed_items: failedItems.map((item) => item.name).slice(0, 25),
      });
    }

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

    await db.insert(inspections).values({
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

    await db.update(vehicles)
      .set({ status: body.overallResult === "pass" ? "passed" : "failed", updatedAt: new Date() })
      .where(eq(vehicles.id, body.vehicleId));

    await logAudit({
      userId: auth.user.id,
      userName: auth.user.name,
      action: "create",
      entityType: "inspection",
      entityId: id,
      entityLabel: inspectionNumber,
      summary: `Created inspection for vehicle ${vehicle.registrationNumber}`,
      after: { overallResult: body.overallResult, workflowStatus: body.workflowStatus, failedItemCount: failedItems.length },
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
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 50)));
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));
  const result = url.searchParams.get("result");
  const vehicleId = url.searchParams.get("vehicle_id");
  if (result && !RESULTS.has(result)) return apiError(400, "Invalid inspection result");

  const where = [];
  if (result) where.push(eq(inspections.overallResult, result as "pass" | "conditional_pass" | "reinspection_required" | "fail"));
  if (vehicleId) where.push(eq(inspections.vehicleId, vehicleId));

  const rows = await db
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
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(inspections.inspectionDate))
    .limit(limit)
    .offset(offset);

  const [countRow] = await db.select({ n: sql<number>`count(*)::int` }).from(inspections)
    .where(where.length ? and(...where) : undefined);

  return json({
    data: rows,
    pagination: { limit, offset, total: countRow?.n || 0 },
    links: { self: "/api/v1/inspections", vehicle: "/api/v1/vehicles/:id", inspection: "/api/v1/inspections/:id" },
  });
}
