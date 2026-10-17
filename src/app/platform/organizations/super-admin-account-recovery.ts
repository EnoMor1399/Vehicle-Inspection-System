"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { decryptField } from "@/lib/field-encryption";
import { rateLimit } from "@/lib/rate-limit";
import { verifyTwoFactorToken } from "@/lib/security";
import { clientIpFromHeaders } from "@/lib/request-context";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { securityEvents, sessions, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { logAudit } from "@/lib/audit";
import { newId } from "@/lib/utils";

/**
 * Emergency supervised account recovery. The generated password is displayed
 * only once to the authenticated platform Super Administrator; never log it.
 * A future self-service reset-token flow should replace delivery by admin.
 */
export async function superAdminResetUserPassword(targetUserId: string, authenticationCode: string) {
  const actor = await getCurrentUser();
  if (actor.role !== "super_admin" || !actor.isActive || !actor.twoFactorEnabled || !actor.twoFactorSecret) {
    throw new Error("An active Super Administrator with enrolled MFA is required");
  }
  const ip = clientIpFromHeaders(await headers());
  const limiter = await rateLimit("twoFactor", `password-reset:${actor.id}:${ip}`);
  if (!limiter.allowed) throw new Error("Too many account recovery attempts");
  if (typeof authenticationCode !== "string" || !/^\d{6,8}$/.test(authenticationCode.trim())) {
    throw new Error("Enter your authenticator code");
  }
  const verified = await verifyTwoFactorToken(
    decryptField(actor.twoFactorSecret), authenticationCode.trim(),
  );
  if (!verified) throw new Error("Authenticator code was not accepted");
  if (!/^[a-zA-Z0-9-]{1,64}$/.test(targetUserId)) {
    throw new Error("Invalid user identifier");
  }
  if (actor.id === targetUserId) {
    throw new Error("Use your own account security settings to change your password");
  }

  // Do not permit administrative takeovers of other platform super admins.
  const [target] = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    role: users.role,
    organizationId: users.organizationId,
    isActive: users.isActive,
  }).from(users).where(eq(users.id, targetUserId)).limit(1);
  if (!target) throw new Error("Account not found");
  if (target.role === "super_admin") {
    throw new Error("Another Super Administrator must use verified self-service account recovery");
  }

  const temporaryPassword = randomBytes(32).toString("base64url");
  const passwordHash = await hashPassword(temporaryPassword);
  await db.transaction(async (tx) => {
    const [updated] = await tx.update(users).set({
      passwordHash,
      mustChangePassword: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      updatedAt: new Date(),
    }).where(and(eq(users.id, target.id), eq(users.organizationId, target.organizationId), ne(users.role, "super_admin")))
      .returning({ id: users.id });
    if (!updated) throw new Error("Password reset could not be completed");
    await tx.update(sessions).set({ isActive: false }).where(eq(sessions.userId, target.id));
    // Mandatory security evidence is written atomically with the password reset.
    // Associate the event with the account's own tenant and target user; the
    // platform actor is referenced explicitly in metadata.
    await tx.insert(securityEvents).values({
      id: newId(),
      organizationId: target.organizationId,
      userId: target.id,
      eventType: "admin_password_reset",
      severity: "warning",
      ipAddress: ip,
      description: "Platform Super Administrator reset the password; account must rotate it at next sign-in",
      metadata: { actorUserId: actor.id, targetUserId: target.id, sessionsRevoked: true },
    });
  });

  await logAudit({
    organizationId: target.organizationId,
    userId: actor.id,
    userName: actor.name,
    action: "update",
    entityType: "user_password",
    entityId: target.id,
    entityLabel: target.email,
    summary: "Platform Super Administrator reset a user password and revoked all existing sessions",
    after: { sessionsRevoked: true, actorId: actor.id },
  });
  revalidatePath("/users");
  revalidatePath("/driver-training/users");
  return { ok: true as const, temporaryPassword, accountEmail: target.email };
}


// Expected MFA and account-validation failures must be returned as safe results,
// not thrown through the React Server Components transport (production #441).
// The underlying reset retains the same authentication, MFA, rate limit, session
// revocation, tenant checks and mandatory password rotation.
export async function trySuperAdminResetUserPassword(
  targetUserId: string,
  authenticationCode: string,
): Promise<
  | { ok: true; temporaryPassword: string; accountEmail: string }
  | { ok: false; message: string }
> {
  try {
    return await superAdminResetUserPassword(targetUserId, authenticationCode);
  } catch (error) {
    const text = error instanceof Error ? error.message : "";
    const safeMessages = new Set([
      "Enter your authenticator code",
      "Authenticator code was not accepted",
      "Too many account recovery attempts",
      "Invalid user identifier",
      "Use your own account security settings to change your password",
      "Account not found",
      "Another Super Administrator must use verified self-service account recovery",
      "An active Super Administrator with enrolled MFA is required",
    ]);
    return {
      ok: false,
      message: safeMessages.has(text)
        ? text
        : "Password reset failed. Check your authorization and try again.",
    };
  }
}
