"use server";

import { cookies } from "next/headers";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { hashPassword, validatePasswordStrength, verifyPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { validateSession } from "@/lib/security";
import { SUPPORT_COOKIE_NAME } from "@/lib/support-session";

export async function completeRequiredPasswordChange(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<{ ok: boolean; error?: string; destination?: string }> {
  const jar = await cookies();
  if (jar.has(SUPPORT_COOKIE_NAME)) return { ok: false, error: "Exit support view before changing a password." };
  const user = await getCurrentUser({ allowPendingPasswordChange: true, allowPendingPrivileged2FA: true });
  if (!user.mustChangePassword) return { ok: false, error: "No required password change is pending." };
  const token = jar.get("rsl_session_token")?.value;
  if (!token) throw new Error("Authentication required");
  const session = await validateSession(token);
  if (!session.valid || session.userId !== user.id || !session.sessionId) {
    throw new Error("Authentication required");
  }

  const limited = await rateLimit("twoFactor", `password-change:${user.id}`);
  if (!limited.allowed) return { ok: false, error: "Too many attempts. Please try again later." };
  if (!input || typeof input.currentPassword !== "string" || typeof input.newPassword !== "string"
      || typeof input.confirmPassword !== "string"
      || input.currentPassword.length > 256 || input.newPassword.length > 128) {
    return { ok: false, error: "Invalid password input." };
  }
  if (input.newPassword !== input.confirmPassword) {
    return { ok: false, error: "The new password and confirmation do not match." };
  }
  if (input.newPassword === input.currentPassword) {
    return { ok: false, error: "Choose a different password from your temporary password." };
  }
  const strength = validatePasswordStrength(input.newPassword);
  if (!strength.valid) return { ok: false, error: strength.errors[0] };

  const [fresh] = await db.select({
    passwordHash: users.passwordHash,
    mustChangePassword: users.mustChangePassword,
  }).from(users).where(eq(users.id, user.id)).limit(1);
  if (!fresh?.mustChangePassword || !fresh.passwordHash
      || !(await verifyPassword(input.currentPassword, fresh.passwordHash))) {
    return { ok: false, error: "The current temporary password is incorrect." };
  }

  const nextHash = await hashPassword(input.newPassword);
  const updated = await db.transaction(async (tx) => {
    const [changed] = await tx.update(users).set({
      passwordHash: nextHash,
      mustChangePassword: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
      updatedAt: new Date(),
    }).where(and(
      eq(users.id, user.id),
      eq(users.passwordHash, fresh.passwordHash!),
      eq(users.mustChangePassword, true),
    )).returning({ id: users.id });
    if (!changed) return false;
    await tx.update(sessions).set({ isActive: false }).where(and(
      eq(sessions.userId, user.id), ne(sessions.id, session.sessionId!),
    ));
    return true;
  });
  if (!updated) return { ok: false, error: "Your password changed in another session. Sign in again." };

  await logAudit({
    organizationId: user.organizationId,
    userId: user.id,
    userName: user.name,
    action: "update",
    entityType: "user_password",
    entityId: user.id,
    summary: "Account owner replaced the temporary password after administrative recovery",
    after: { requiredPasswordChangeCompleted: true, otherSessionsRevoked: true },
  });

  const destination = user.role === "organization_owner"
    ? "/organization/account"
    : user.role === "transporter_user"
      ? "/portal"
      : user.role === "driver_training_admin"
        ? "/driver-training"
        : "/";
  return { ok: true, destination };
}
