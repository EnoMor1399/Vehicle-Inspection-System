import { authenticateApiRequest, json, apiError } from "@/lib/api-auth";
import { db } from "@/db";
import { rfidTags, vehicles } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { rfidAssociationSchema, zodDetails } from "@/lib/api-schemas";
import { API_SMALL_JSON_BODY_LIMIT, readJsonBody } from "@/lib/request-body";
import { newId } from "@/lib/utils";

export async function GET(request: Request) {
  const auth = await authenticateApiRequest({ scopes: ["read"], permission: "vehicles" });
  if (!auth.ok) return apiError(auth.status, auth.message);

  const url = new URL(request.url);
  const tag = url.searchParams.get("tag")?.trim();
  if (!tag || tag.length > 128) return apiError(400, "Valid tag parameter required");

  const [row] = await db
    .select({ tag: rfidTags, vehicle: vehicles })
    .from(rfidTags)
    .innerJoin(vehicles, eq(vehicles.id, rfidTags.vehicleId))
    .where(and(eq(rfidTags.tagUid, tag), eq(rfidTags.status, "active")))
    .limit(1);

  if (!row) {
    return json({ data: null, found: false, tag, message: "No active vehicle association found for this RFID tag" });
  }

  await db.update(rfidTags).set({ lastScannedAt: new Date(), updatedAt: new Date() }).where(eq(rfidTags.id, row.tag.id));
  return json({
    data: row.vehicle,
    rfid: { id: row.tag.id, tag_uid: row.tag.tagUid, assigned_at: row.tag.assignedAt },
    found: true,
    scanned_at: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  const auth = await authenticateApiRequest({ scopes: ["write"], permission: "vehicles" });
  if (!auth.ok) return apiError(auth.status, auth.message);

  const bodyResult = await readJsonBody(request, API_SMALL_JSON_BODY_LIMIT);
  if (!bodyResult.ok) return apiError(bodyResult.status, bodyResult.message);

  const parsed = rfidAssociationSchema.safeParse(bodyResult.value);
  if (!parsed.success) return apiError(400, "Invalid RFID payload", zodDetails(parsed.error));
  const { tag, vehicle_id } = parsed.data;

  const [vehicle] = await db.select({ id: vehicles.id, registrationNumber: vehicles.registrationNumber })
    .from(vehicles).where(eq(vehicles.id, vehicle_id));
  if (!vehicle) return apiError(404, "Vehicle not found");

  const [existing] = await db.select().from(rfidTags).where(eq(rfidTags.tagUid, tag));
  if (existing && existing.vehicleId !== vehicle_id && existing.status === "active") {
    return apiError(409, "RFID tag is already assigned to another vehicle");
  }

  const id = existing?.id || newId();
  if (existing) {
    await db.update(rfidTags).set({
      vehicleId: vehicle_id,
      status: "active",
      assignedBy: auth.user.id,
      assignedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(rfidTags.id, existing.id));
  } else {
    await db.insert(rfidTags).values({ id, tagUid: tag, vehicleId: vehicle_id, assignedBy: auth.user.id, status: "active" });
  }

  const { logAudit } = await import("@/lib/audit");
  await logAudit({
    userId: auth.user.id,
    userName: auth.user.name,
    action: "update",
    entityType: "vehicle",
    entityId: vehicle_id,
    entityLabel: vehicle.registrationNumber,
    summary: `Assigned RFID tag ${tag} to vehicle ${vehicle.registrationNumber}`,
    after: { rfidTag: tag },
  });

  return json({ data: { id, tag, vehicle_id, associated: true } }, existing ? 200 : 201);
}
