import { authenticateApiRequest, json, apiError } from "@/lib/api-auth";
import { db } from "@/db";
import { vehicles, transporters } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { vehiclePatchSchema, zodDetails } from "@/lib/api-schemas";
import { API_SMALL_JSON_BODY_LIMIT, readJsonBody } from "@/lib/request-body";
import { validateGenericVehicleStatusTransition } from "@/lib/vehicle-lifecycle";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiRequest({ scopes: ["read"], permission: "vehicles" });
  if (!auth.ok) return apiError(auth.status, auth.message);
  const { id } = await params;
  const [row] = await db.select().from(vehicles).where(eq(vehicles.id, id));
  if (!row) return apiError(404, "Vehicle not found");
  return json({ data: row });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiRequest({ scopes: ["write"], permission: "vehicles" });
  if (!auth.ok) return apiError(auth.status, auth.message);
  const { id } = await params;
  const [existing] = await db.select().from(vehicles).where(eq(vehicles.id, id));
  if (!existing) return apiError(404, "Vehicle not found");
  if (existing.status === "decommissioned") {
    return apiError(409, "A decommissioned vehicle cannot be edited through the generic vehicle API");
  }

  try {
    const bodyResult = await readJsonBody(req, API_SMALL_JSON_BODY_LIMIT);
    if (!bodyResult.ok) return apiError(bodyResult.status, bodyResult.message);

    const parsed = vehiclePatchSchema.safeParse(bodyResult.value);
    if (!parsed.success) return apiError(400, "Invalid vehicle payload", zodDetails(parsed.error));
    const body = parsed.data;
    const changedFields = Object.keys(body);
    if (!changedFields.length) return apiError(400, "No vehicle changes were provided");

    if (body.status) {
      const transition = validateGenericVehicleStatusTransition(existing.status, body.status);
      if (!transition.ok) return apiError(409, transition.message);
    }

    const updates: Partial<typeof vehicles.$inferInsert> = { updatedAt: new Date() };
    const mapping: Record<string, string> = {
      registration_number: "registrationNumber", make: "make", model: "model",
      body_type: "bodyType", category: "category", vehicle_class: "vehicleClass",
      colour: "colour", manufacturing_year: "manufacturingYear", vin: "vin",
      chassis_number: "chassisNumber", engine_number: "engineNumber",
      fuel_type: "fuelType", transmission: "transmission", status: "status",
      odometer_reading: "odometerReading",
    };
    for (const [apiName, dbName] of Object.entries(mapping)) {
      if (apiName in body) (updates as Record<string, unknown>)[dbName] = (body as Record<string, unknown>)[apiName];
    }
    if (typeof updates.registrationNumber === "string") updates.registrationNumber = updates.registrationNumber.toUpperCase();
    if (typeof updates.vin === "string") updates.vin = updates.vin.toUpperCase();

    const updateResult = await db.transaction(async (tx) => {
      if ("transporter_id" in body) {
        if (!body.transporter_id) {
          updates.transporterId = null;
        } else {
          const [transporter] = await tx
            .select({ id: transporters.id })
            .from(transporters)
            .where(and(eq(transporters.id, body.transporter_id), isNull(transporters.deletedAt)))
            .limit(1);
          if (!transporter) return { ok: false as const, reason: "transporter_not_found" as const };
          updates.transporterId = transporter.id;
        }
      }

      const [updated] = await tx
        .update(vehicles)
        .set(updates)
        .where(eq(vehicles.id, id))
        .returning();
      return { ok: true as const, updated };
    });

    if (!updateResult.ok) return apiError(400, "transporter_id not found");
    if (!updateResult.updated) return apiError(404, "Vehicle not found");

    const { logAudit } = await import("@/lib/audit");
    await logAudit({
      userId: auth.user.id,
      userName: auth.user.name,
      action: "update",
      entityType: "vehicle",
      entityId: id,
      entityLabel: updateResult.updated.registrationNumber,
      summary: `Updated vehicle via API: ${updateResult.updated.registrationNumber}`,
      before: existing,
      after: updateResult.updated,
    });
    return json({ data: { id, updated: changedFields } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/unique|duplicate/i.test(message)) return apiError(409, "Vehicle registration already exists");
    return apiError(500, "Failed to update vehicle");
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiRequest({ scopes: ["write"], permission: "vehicles" });
  if (!auth.ok) return apiError(auth.status, auth.message);
  const { id } = await params;
  const [existing] = await db.select().from(vehicles).where(eq(vehicles.id, id));
  if (!existing) return apiError(404, "Vehicle not found");

  if (existing.status === "decommissioned") {
    return json({ data: { id, decommissioned: true, already_decommissioned: true } });
  }

  // Preserve referential/audit history by decommissioning instead of hard deletion.
  const [updated] = await db
    .update(vehicles)
    .set({ status: "decommissioned", updatedAt: new Date() })
    .where(eq(vehicles.id, id))
    .returning();

  const { logAudit } = await import("@/lib/audit");
  await logAudit({
    userId: auth.user.id,
    userName: auth.user.name,
    action: "archive",
    entityType: "vehicle",
    entityId: id,
    entityLabel: existing.registrationNumber,
    summary: `Decommissioned vehicle via API: ${existing.registrationNumber}`,
    before: existing,
    after: updated || { ...existing, status: "decommissioned" },
  });
  return json({ data: { id, decommissioned: true, already_decommissioned: false } });
}
