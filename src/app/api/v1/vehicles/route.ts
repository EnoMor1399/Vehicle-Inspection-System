import { authenticateApiRequest, json, apiError } from "@/lib/api-auth";
import { db } from "@/db";
import { vehicles, transporters } from "@/db/schema";
import { eq, desc, sql, isNull, and } from "drizzle-orm";
import { vehicleCreateSchema, zodDetails } from "@/lib/api-schemas";

const VEHICLE_STATUSES = new Set(["active", "under_inspection", "failed", "passed", "suspended", "decommissioned"]);

export async function GET(request: Request) {
  const auth = await authenticateApiRequest({ scopes: ["read"], permission: "vehicles" });
  if (!auth.ok) return apiError(auth.status, auth.message);

  const url = new URL(request.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 50)));
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));
  const status = url.searchParams.get("status");
  const transporterId = url.searchParams.get("transporter_id");
  if (status && !VEHICLE_STATUSES.has(status)) return apiError(400, "Invalid vehicle status");

  const where = [];
  if (status) where.push(eq(vehicles.status, status as typeof vehicles.status.enumValues[number]));
  if (transporterId) where.push(eq(vehicles.transporterId, transporterId));

  const rows = await db.select().from(vehicles)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(vehicles.createdAt)).limit(limit).offset(offset);

  const [countRow] = await db.select({ n: sql<number>`count(*)::int` }).from(vehicles)
    .where(where.length ? and(...where) : undefined);

  return json({
    data: rows,
    pagination: { limit, offset, total: countRow?.n || 0 },
    meta: { api_version: "v1", user: auth.user.name, request_time: new Date().toISOString() },
  });
}

export async function POST(request: Request) {
  const auth = await authenticateApiRequest({ scopes: ["write"], permission: "vehicles" });
  if (!auth.ok) return apiError(auth.status, auth.message);

  try {
    const parsed = vehicleCreateSchema.safeParse(await request.json());
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
