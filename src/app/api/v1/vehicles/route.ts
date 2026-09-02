import { authenticateApiRequest, json, apiError } from "@/lib/api-auth";
import { db } from "@/db";
import { vehicles, transporters } from "@/db/schema";
import { eq, desc, sql, isNull, and } from "drizzle-orm";
import { vehicleCreateSchema, zodDetails } from "@/lib/api-schemas";
import { parseApiPagination } from "@/lib/api-pagination";
import { API_SMALL_JSON_BODY_LIMIT, readJsonBody } from "@/lib/request-body";
import { formatServerTiming, timeOperation } from "@/lib/performance";

const VEHICLE_STATUSES = new Set(["active", "under_inspection", "failed", "passed", "suspended", "decommissioned"]);

export async function GET(request: Request) {
  const auth = await authenticateApiRequest({ scopes: ["read"], permission: "vehicles" });
  if (!auth.ok) return apiError(auth.status, auth.message);

  const url = new URL(request.url);
  const pagination = parseApiPagination(url.searchParams);
  if (!pagination.ok) return apiError(400, pagination.message);
  const { limit, offset } = pagination;

  const status = url.searchParams.get("status");
  const transporterId = url.searchParams.get("transporter_id")?.trim() || null;
  if (status && !VEHICLE_STATUSES.has(status)) return apiError(400, "Invalid vehicle status");
  if (transporterId && transporterId.length > 64) return apiError(400, "transporter_id is too long");

  const where = [];
  if (status) where.push(eq(vehicles.status, status as typeof vehicles.status.enumValues[number]));
  if (transporterId) where.push(eq(vehicles.transporterId, transporterId));
  const predicate = where.length ? and(...where) : undefined;

  const started = performance.now();
  const [rowsQuery, countQuery] = await Promise.all([
    timeOperation("vehicles_list", async () => db.select().from(vehicles)
      .where(predicate)
      .orderBy(desc(vehicles.createdAt)).limit(limit).offset(offset)),
    timeOperation("vehicles_count", async () => db.select({ n: sql<number>`count(*)::int` }).from(vehicles)
      .where(predicate)),
  ]);
  const totalDurationMs = performance.now() - started;
  const [countRow] = countQuery.value;

  return json({
    data: rowsQuery.value,
    pagination: { limit, offset, total: countRow?.n || 0 },
    meta: { api_version: "v1", user: auth.user.name, request_time: new Date().toISOString() },
  }, 200, {
    "Server-Timing": formatServerTiming([
      { name: "vehicles_list", durationMs: rowsQuery.durationMs },
      { name: "vehicles_count", durationMs: countQuery.durationMs },
    ], totalDurationMs),
  });
}

export async function POST(request: Request) {
  const auth = await authenticateApiRequest({ scopes: ["write"], permission: "vehicles" });
  if (!auth.ok) return apiError(auth.status, auth.message);

  try {
    const bodyResult = await readJsonBody(request, API_SMALL_JSON_BODY_LIMIT);
    if (!bodyResult.ok) return apiError(bodyResult.status, bodyResult.message);

    const parsed = vehicleCreateSchema.safeParse(bodyResult.value);
    if (!parsed.success) return apiError(400, "Invalid vehicle payload", zodDetails(parsed.error));
    const body = parsed.data;

    let transporterId: string | null = null;
    if (body.transporter_id) {
      const [t] = await db.select().from(transporters)
        .where(and(eq(transporters.id, body.transporter_id), isNull(transporters.deletedAt)));
      if (!t) return apiError(400, "transporter_id not found");
      transporterId = t.id;
    }

    const { newId } = await import("@/lib/utils");
    const id = newId();
    const payload = {
      id,
      transporterId,
      registrationNumber: body.registration_number.toUpperCase(),
      make: body.make,
      model: body.model || null,
      bodyType: body.body_type || null,
      category: body.category || null,
      vehicleClass: body.vehicle_class || null,
      colour: body.colour || null,
      manufacturingYear: body.manufacturing_year || null,
      vin: body.vin?.toUpperCase() || null,
      chassisNumber: body.chassis_number || null,
      engineNumber: body.engine_number || null,
      fuelType: body.fuel_type || null,
      transmission: body.transmission || null,
      status: body.status,
    };
    await db.insert(vehicles).values(payload);

    const { logAudit } = await import("@/lib/audit");
    await logAudit({
      userId: auth.user.id,
      userName: auth.user.name,
      action: "create",
      entityType: "vehicle",
      entityId: id,
      entityLabel: payload.registrationNumber,
      summary: `Created vehicle via API: ${payload.registrationNumber}`,
      after: payload,
    });

    return json({ data: { id, registration_number: payload.registrationNumber } }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create vehicle";
    if (/unique|duplicate/i.test(message)) return apiError(409, "Vehicle registration already exists");
    return apiError(500, "Failed to create vehicle");
  }
}
