"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { locations } from "@/db/schema";
import { getCurrentUser, canManageLocations } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { newId } from "@/lib/utils";
import { adminValidationMessage, stationAdminSchema } from "@/lib/admin-entity-policy";
import { assertSubscriptionCapacityAvailable, extractSubscriptionCapacityError } from "@/lib/subscription-capacity";

export type StationInput = {
  id?: string;
  name: string;
  code: string;
  region?: string;
  district?: string;
  address?: string;
  gpsAddress?: string;
  phone?: string;
  email?: string;
  managerName?: string;
  capacity?: number | null;
  equipment?: string[];
  status?: "active" | "inactive" | "maintenance";
};

export async function saveStation(input: StationInput) {
  const user = await getCurrentUser();
  if (!canManageLocations(user)) throw new Error("You do not have permission to manage inspection stations");

  const parsed = stationAdminSchema.safeParse(input);
  if (!parsed.success) throw new Error(adminValidationMessage(parsed.error));
  const data = parsed.data;
  const equipment = [...new Set(data.equipment || [])];
  const status = data.status || "active";

  const duplicateQuery = data.id
    ? and(
        eq(locations.organizationId, user.organizationId),
        eq(locations.code, data.code),
        ne(locations.id, data.id),
      )
    : and(
        eq(locations.organizationId, user.organizationId),
        eq(locations.code, data.code),
      );
  const [duplicate] = await db.select({ id: locations.id }).from(locations).where(duplicateQuery).limit(1);
  if (duplicate) throw new Error("Another station already uses this code");

  const values = {
    name: data.name,
    code: data.code,
    region: data.region || null,
    district: data.district || null,
    address: data.address || null,
    gpsAddress: data.gpsAddress || null,
    phone: data.phone || null,
    email: data.email?.toLowerCase() || null,
    managerName: data.managerName || null,
    capacity: data.capacity ?? null,
    equipment,
    status,
    updatedAt: new Date(),
  } as const;

  if (data.id) {
    const [before] = await db
      .select()
      .from(locations)
      .where(and(eq(locations.organizationId, user.organizationId), eq(locations.id, data.id)))
      .limit(1);
    if (!before) throw new Error("Station not found");
    if (before.status === "inactive" && status !== "inactive") {
      await assertSubscriptionCapacityAvailable(user.organizationId, "stations");
    }
    try {
      await db
        .update(locations)
        .set(values)
        .where(and(eq(locations.organizationId, user.organizationId), eq(locations.id, data.id)));
    } catch (error) {
      const capacityMessage = extractSubscriptionCapacityError(error);
      if (capacityMessage) throw new Error(capacityMessage);
      throw error;
    }
    await logAudit({
      organizationId: user.organizationId,
      userId: user.id,
      userName: user.name,
      action: "update",
      entityType: "location",
      entityId: data.id,
      entityLabel: data.name,
      summary: `Updated inspection station ${data.name}`,
      before,
      after: values,
    });
  } else {
    if (status !== "inactive") {
      await assertSubscriptionCapacityAvailable(user.organizationId, "stations");
    }
    const id = newId();
    try {
      await db.insert(locations).values({ id, organizationId: user.organizationId, ...values });
    } catch (error) {
      const capacityMessage = extractSubscriptionCapacityError(error);
      if (capacityMessage) throw new Error(capacityMessage);
      throw error;
    }
    await logAudit({
      organizationId: user.organizationId,
      userId: user.id,
      userName: user.name,
      action: "create",
      entityType: "location",
      entityId: id,
      entityLabel: data.name,
      summary: `Created inspection station ${data.name}`,
      after: values,
    });
  }

  revalidatePath("/locations");
  return { ok: true };
}
