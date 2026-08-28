"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { locations, transporters, users } from "@/db/schema";
import { and, count, eq } from "drizzle-orm";
import { getCurrentUser, canManageUsers } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { revokeAllUserSessions } from "@/lib/security";

const ROLES = new Set([
  "super_admin",
  "admin",
  "operations_manager",
  "supervisor",
  "inspector",
  "data_entry",
  "auditor",
  "compliance_officer",
  "viewer",
  "transporter_user",
]);

export async function updateUserAccess(input: {
  userId: string;
  role: string;
  isActive: boolean;
  locationId?: string | null;
  transporterId?: string | null;
}) {
  const actor = await getCurrentUser();
  if (!canManageUsers(actor)) throw new Error("You do not have permission to manage users");
  if (!ROLES.has(input.role)) throw new Error("Invalid user role");

  const [target] = await db.select().from(users).where(eq(users.id, input.userId));
  if (!target) throw new Error("User account not found");

  const touchingSuperAdmin = target.role === "super_admin" || input.role === "super_admin";
  if (touchingSuperAdmin && actor.role !== "super_admin") {
    throw new Error("Only a Super Administrator can modify Super Administrator access");
  }

  if (target.id === actor.id && (!input.isActive || input.role !== actor.role)) {
    throw new Error("You cannot deactivate or change the role of your own active session");
  }

  if (target.role === "super_admin" && (input.role !== "super_admin" || !input.isActive)) {
    const [row] = await db.select({ n: count() }).from(users).where(and(eq(users.role, "super_admin"), eq(users.isActive, true)));
    if (Number(row?.n || 0) <= 1) throw new Error("At least one active Super Administrator must remain");
  }

  const locationId = input.locationId || null;
  if (locationId) {
    const [location] = await db.select({ id: locations.id }).from(locations).where(eq(locations.id, locationId));
    if (!location) throw new Error("Selected inspection station does not exist");
  }

  const transporterId = input.role === "transporter_user" ? input.transporterId || null : null;
  if (input.role === "transporter_user") {
    if (!transporterId) throw new Error("Transporter portal users must be linked to a transporter");
    const [transporter] = await db.select({ id: transporters.id, deletedAt: transporters.deletedAt }).from(transporters).where(eq(transporters.id, transporterId));
    if (!transporter || transporter.deletedAt) throw new Error("Selected transporter is unavailable");
  }

  const patch = {
    role: input.role as typeof target.role,
    isActive: input.isActive,
    locationId,
    transporterId,
    updatedAt: new Date(),
  };

  await db.update(users).set(patch).where(eq(users.id, target.id));

  if (target.role !== input.role || target.isActive !== input.isActive || target.transporterId !== transporterId) {
    await revokeAllUserSessions(target.id);
  }

  await logAudit({
    userId: actor.id,
    userName: actor.name,
    action: "update",
    entityType: "user",
    entityId: target.id,
    entityLabel: target.email,
    summary: `Updated access for ${target.name}`,
    before: { role: target.role, isActive: target.isActive, locationId: target.locationId, transporterId: target.transporterId },
    after: patch,
  });

  revalidatePath("/users");
  return { ok: true };
}
