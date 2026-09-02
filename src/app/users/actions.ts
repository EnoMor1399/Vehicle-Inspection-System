"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { locations, sessions, transporters, users } from "@/db/schema";
import { and, count, eq, sql } from "drizzle-orm";
import { getCurrentUser, canManageUsers } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { isUserRole, validateDelegatedRoleChange } from "@/lib/user-access-policy";

export async function updateUserAccess(input: {
  userId: string;
  role: string;
  isActive: boolean;
  locationId?: string | null;
  transporterId?: string | null;
}) {
  const actor = await getCurrentUser();
  if (!canManageUsers(actor)) throw new Error("You do not have permission to manage users");

  const actorRole = actor.role;
  const requestedRole = input.role;
  if (!isUserRole(actorRole)) throw new Error("Your account role is not recognized");
  if (!isUserRole(requestedRole)) throw new Error("Invalid user role");
  if (!input.userId || input.userId.length > 64) throw new Error("Invalid user account identifier");

  const result = await db.transaction(async (tx) => {
    // Serialize access mutations so concurrent role changes cannot race the
    // last-Super-Administrator invariant or transporter/session updates.
    await tx.execute(sql`select pg_advisory_xact_lock(78654223)`);

    const [target] = await tx.select().from(users).where(eq(users.id, input.userId)).limit(1);
    if (!target) return { ok: false as const, error: "User account not found" };

    const targetRole = target.role;
    if (!isUserRole(targetRole)) return { ok: false as const, error: "Target account role is not recognized" };

    const delegated = validateDelegatedRoleChange(actorRole, targetRole, requestedRole);
    if (!delegated.ok) return { ok: false as const, error: delegated.message };

    if (target.id === actor.id && (!input.isActive || requestedRole !== actorRole)) {
      return { ok: false as const, error: "You cannot deactivate or change the role of your own active session" };
    }

    if (targetRole === "super_admin" && (requestedRole !== "super_admin" || !input.isActive)) {
      // Lock all currently-active Super Administrator rows so two concurrent
      // demotions cannot both observe a safe count and leave the system orphaned.
      await tx.execute(sql`select id from users where role = 'super_admin' and is_active = true for update`);
      const [row] = await tx
        .select({ n: count() })
        .from(users)
        .where(and(eq(users.role, "super_admin"), eq(users.isActive, true)));
      if (Number(row?.n || 0) <= 1) {
        return { ok: false as const, error: "At least one active Super Administrator must remain" };
      }
    }

    const locationId = input.locationId || null;
    if (locationId) {
      const [location] = await tx.select({ id: locations.id }).from(locations).where(eq(locations.id, locationId)).limit(1);
      if (!location) return { ok: false as const, error: "Selected inspection station does not exist" };
    }

    const transporterId = requestedRole === "transporter_user" ? input.transporterId || null : null;
    if (requestedRole === "transporter_user") {
      if (!transporterId) return { ok: false as const, error: "Transporter portal users must be linked to a transporter" };
      const [transporter] = await tx
        .select({ id: transporters.id, deletedAt: transporters.deletedAt })
        .from(transporters)
        .where(eq(transporters.id, transporterId))
        .limit(1);
      if (!transporter || transporter.deletedAt) {
        return { ok: false as const, error: "Selected transporter is unavailable" };
      }
    }

    const patch: Partial<typeof users.$inferInsert> = {
      role: requestedRole,
      isActive: input.isActive,
      locationId,
      transporterId,
      updatedAt: new Date(),
    };

    const securitySensitiveChange =
      targetRole !== requestedRole
      || target.isActive !== input.isActive
      || target.transporterId !== transporterId;

    const [updated] = await tx
      .update(users)
      .set(patch)
      .where(eq(users.id, target.id))
      .returning();

    if (!updated) return { ok: false as const, error: "User account update did not complete" };

    if (securitySensitiveChange) {
      await tx
        .update(sessions)
        .set({ isActive: false })
        .where(eq(sessions.userId, target.id));
    }

    return { ok: true as const, target, updated, securitySensitiveChange };
  });

  if (!result.ok) throw new Error(result.error);

  await logAudit({
    userId: actor.id,
    userName: actor.name,
    action: "update",
    entityType: "user",
    entityId: result.target.id,
    entityLabel: result.target.email,
    summary: `Updated access for ${result.target.name}`,
    before: {
      role: result.target.role,
      isActive: result.target.isActive,
      locationId: result.target.locationId,
      transporterId: result.target.transporterId,
    },
    after: {
      role: result.updated.role,
      isActive: result.updated.isActive,
      locationId: result.updated.locationId,
      transporterId: result.updated.transporterId,
      sessionsRevoked: result.securitySensitiveChange,
    },
  });

  revalidatePath("/users");
  return { ok: true };
}
