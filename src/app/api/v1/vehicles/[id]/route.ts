import { authenticateApiRequest, json, apiError } from "@/lib/api-auth";
import { db } from "@/db";
import { vehicles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { vehiclePatchSchema, zodDetails } from "@/lib/api-schemas";

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

  try {
    const parsed = vehiclePatchSchema.safeParse(await req.json());
    if (!parsed.success) return apiError(400, "Invalid vehicle payload", zodDetails(parsed.error));
    const body = parsed.data;

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

    await db.update(vehicles).set(updates).where(eq(vehicles.id, id));

    const { logAudit } = await import("@/lib/audit");
    await logAudit({
      userId: auth.user.id, userName: auth.user.name, action: "update",
      entityType: "vehicle", entityId: id, entityLabel: existing.registrationNumber,
      summary: `Updated vehicle via API: ${existing.registrationNumber}`,
      before: existing, after: updates,
    });
    return json({ data: { id, updated: Object.keys(updates).filter((key) => key !== "updatedAt") } });
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

  // Preserve referential/audit history by decommissioning instead of hard deletion.
  await db.update(vehicles).set({ status: "decommissioned", updatedAt: new Date() }).where(eq(vehicles.id, id));
  const { logAudit } = await import("@/lib/audit");
  await logAudit({
    userId: auth.user.id, userName: auth.user.name, action: "archive",
    entityType: "vehicle", entityId: id, entityLabel: existing.registrationNumber,
    summary: `Decommissioned vehicle via API: ${existing.registrationNumber}`,
    before: existing, after: { status: "decommissioned" },
  });
  return json({ data: { id, decommissioned: true } });
}
