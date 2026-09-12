"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { locations, sessions, transporters, users } from "@/db/schema";
import { and, count, eq, sql } from "drizzle-orm";
import { getCurrentUser, canManageUsers } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { canManageTrainingUsers } from "@/lib/training-access";
import {
  canAccessDriverTraining,
  canAccessVehicleInspection,
  DRIVER_TRAINING_ACCESS_KEY,
  VEHICLE_INSPECTION_ACCESS_KEY,
} from "@/lib/system-access";
import { isUserRole, validateDelegatedRoleChange } from "@/lib/user-access-policy";

export async function updateUserAccess(input: {
  userId: string;
  role: string;
  isActive: boolean;
  vehicleInspectionAccess: boolean;
  driverTrainingAccess: boolean;
  locationId?: string | null;
  transporterId?: string | null;
}) {
  const actor = await getCurrentUser();
  const actorCanManageInspection = canManageUsers(actor);
  const actorCanManageTrainingUsers = canManageTrainingUsers(actor);
  if (!actorCanManageInspection && !actorCanManageTrainingUsers) {
    throw new Error("You do not have permission to manage users");
  }

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

    const currentVehicleInspectionAccess = canAccessVehicleInspection(target);
    const currentDriverTrainingAccess = canAccessDriverTraining(target);
    let vehicleInspectionAccess = Boolean(input.vehicleInspectionAccess);
    let driverTrainingAccess = Boolean(input.driverTrainingAccess);

    if (requestedRole === "super_admin") {
      if (actorRole !== "super_admin") {
        return { ok: false as const, error: "Only a Super Administrator can assign Super Administrator access" };
      }
      // Super Administrators retain governance visibility across both systems.
      vehicleInspectionAccess = true;
      driverTrainingAccess = true;
    }

    if (requestedRole === "transporter_user") {
      if (!vehicleInspectionAccess || driverTrainingAccess) {
        return { ok: false as const, error: "Transporter Portal users can only belong to Vehicle Inspection" };
      }
    }

    if (requestedRole === "instructor") {
      if (vehicleInspectionAccess || !driverTrainingAccess) {
        return { ok: false as const, error: "Instructor Account must be assigned to Driver Training & Assessment only" };
      }
    }

    if (!vehicleInspectionAccess && !driverTrainingAccess) {
      return { ok: false as const, error: "Assign the account to Vehicle Inspection, Driver Training, or both" };
    }

    if (actorRole !== "super_admin") {
      if ((currentVehicleInspectionAccess || vehicleInspectionAccess) && !actorCanManageInspection) {
        return { ok: false as const, error: "You cannot manage Vehicle Inspection user access" };
      }
      if ((currentDriverTrainingAccess || driverTrainingAccess) && !actorCanManageTrainingUsers) {
        return { ok: false as const, error: "You cannot manage Driver Training user access" };
      }
    }

    const accessChanged =
      currentVehicleInspectionAccess !== vehicleInspectionAccess
      || currentDriverTrainingAccess !== driverTrainingAccess;

    if (target.id === actor.id && (!input.isActive || requestedRole !== actorRole || accessChanged)) {
      return { ok: false as const, error: "You cannot deactivate, change the role, or change the system assignment of your own active session" };
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

    const locationId = vehicleInspectionAccess ? input.locationId || null : null;
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

    const currentPermissions = target.permissions && typeof target.permissions === "object"
      ? target.permissions
      : {};
    const permissions = {
      ...currentPermissions,
      [VEHICLE_INSPECTION_ACCESS_KEY]: vehicleInspectionAccess,
      [DRIVER_TRAINING_ACCESS_KEY]: driverTrainingAccess,
    };

    const patch: Partial<typeof users.$inferInsert> = {
      role: requestedRole as (typeof users.$inferInsert)["role"],
      permissions,
      isActive: input.isActive,
      locationId,
      transporterId,
      updatedAt: new Date(),
    };

    const securitySensitiveChange =
      targetRole !== requestedRole
      || target.isActive !== input.isActive
      || target.transporterId !== transporterId
      || accessChanged;

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

    return {
      ok: true as const,
      target,
      updated,
      securitySensitiveChange,
      currentVehicleInspectionAccess,
      currentDriverTrainingAccess,
      vehicleInspectionAccess,
      driverTrainingAccess,
    };
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
      vehicleInspectionAccess: result.currentVehicleInspectionAccess,
      driverTrainingAccess: result.currentDriverTrainingAccess,
    },
    after: {
      role: result.updated.role,
      isActive: result.updated.isActive,
      locationId: result.updated.locationId,
      transporterId: result.updated.transporterId,
      vehicleInspectionAccess: result.vehicleInspectionAccess,
      driverTrainingAccess: result.driverTrainingAccess,
      sessionsRevoked: result.securitySensitiveChange,
    },
  });

  revalidatePath("/users");
  revalidatePath("/driver-training/users");
  return { ok: true };
}
