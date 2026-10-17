"use server";

import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { supportSessions, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { decryptField } from "@/lib/field-encryption";
import { getOrganizationSubscriptionState } from "@/lib/organization-access";
import { rateLimit } from "@/lib/rate-limit";
import { clientIpFromHeaders } from "@/lib/request-context";
import { validateSession, verifyTwoFactorToken } from "@/lib/security";
import { SUPPORT_COOKIE_NAME, SUPPORT_TTL_SECONDS, SUPPORT_GUARD_COOKIE_SECONDS } from "@/lib/support-session";
import { newId } from "@/lib/utils";

export async function beginUserSupportView(input: {
  userId: string;
  reason: string;
  authenticationCode: string;
}): Promise<{ ok: true; destination: string }> {
  const actor = await getCurrentUser();
  if (actor.role !== "super_admin" || !actor.isActive || !actor.twoFactorEnabled || !actor.twoFactorSecret) {
    throw new Error("Only a Super Administrator with MFA may begin a support view");
  }
  const jar = await cookies();
  if (jar.has(SUPPORT_COOKIE_NAME)) {
    throw new Error("Exit the current support session before starting another");
  }
  if (typeof input.userId !== "string" || !/^[A-Za-z0-9-]{1,64}$/.test(input.userId)) {
    throw new Error("Invalid account identifier");
  }
  const reason = typeof input.reason === "string"
    ? input.reason.trim().replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 500)
    : "";
  if (reason.length < 12) throw new Error("Enter a support reason of at least 12 characters");

  const originalSessionToken = jar.get("rsl_session_token")?.value;
  if (!originalSessionToken) throw new Error("Sign in again to continue");
  const original = await validateSession(originalSessionToken);
  if (!original.valid || !original.sessionId || original.userId !== actor.id) {
    throw new Error("Your administrator login has expired");
  }

  const requestHeaders = await headers();
  const ip = clientIpFromHeaders(requestHeaders);
  const limiter = await rateLimit("twoFactor", `support:${actor.id}:${ip}`);
  if (!limiter.allowed) throw new Error("Too many support verification attempts. Try again later");
  if (typeof input.authenticationCode !== "string" || !/^\d{6,8}$/.test(input.authenticationCode.trim())) {
    throw new Error("Enter your authenticator code");
  }
  const verified = await verifyTwoFactorToken(
    decryptField(actor.twoFactorSecret), input.authenticationCode.trim(),
  );
  if (!verified) throw new Error("The authenticator code was not accepted");

  const [target] = await db.select({
    id: users.id, name: users.name, role: users.role, organizationId: users.organizationId, isActive: users.isActive,
  }).from(users).where(eq(users.id, input.userId)).limit(1);
  if (!target || !target.isActive || target.id === actor.id || target.role === "super_admin") {
    throw new Error("This account cannot be opened in support mode");
  }
  const subscription = await getOrganizationSubscriptionState(target.organizationId);
  if (!subscription.operationalAccess) {
    throw new Error("This subscriber workspace is not currently available");
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + SUPPORT_TTL_SECONDS * 1000);
  const now = new Date();
  await db.transaction(async (tx) => {
    // The actor retains their original authenticated session; the target never gets a login session.
    await tx.update(supportSessions).set({ endedAt: now })
      .where(and(eq(supportSessions.actorSessionId, original.sessionId!), isNull(supportSessions.endedAt)));
    await tx.insert(supportSessions).values({
      id: newId(),
      tokenHash,
      actorUserId: actor.id,
      actorSessionId: original.sessionId!,
      targetUserId: target.id,
      organizationId: target.organizationId,
      reason,
      ipAddress: ip,
      expiresAt,
    });
  });

  // The support_sessions record is the durable actor/subject/reason audit evidence.
  await logAudit({
    organizationId: target.organizationId,
    userId: actor.id,
    userName: actor.name,
    action: "login",
    entityType: "support_view",
    entityId: target.id,
    summary: "Super Administrator began a read-only support view",
    after: { actorId: actor.id, targetUserId: target.id, reason, expiresAt: expiresAt.toISOString() },
  });

  jar.set(SUPPORT_COOKIE_NAME, token, {
    path: "/", httpOnly: true, sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: SUPPORT_GUARD_COOKIE_SECONDS,
  });
  const destination = target.role === "organization_owner"
    ? "/organization/account"
    : target.role === "transporter_user"
      ? "/portal"
      : target.role === "driver_training_admin"
        ? "/driver-training"
        : "/";
  return { ok: true, destination };
}

// Used only by the same-origin POST route, never exposed as an unrestricted server action.
export async function finishUserSupportView(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SUPPORT_COOKIE_NAME)?.value;
  if (!token) return;
  const hashed = createHash("sha256").update(token).digest("hex");
  const original = jar.get("rsl_session_token")?.value;
  const actorSession = original ? await validateSession(original) : null;
  if (!actorSession?.valid || !actorSession.sessionId || !actorSession.userId) return;
  const [record] = await db.update(supportSessions)
    .set({ endedAt: new Date() })
    .where(and(
      eq(supportSessions.tokenHash, hashed),
      eq(supportSessions.actorSessionId, actorSession.sessionId),
      eq(supportSessions.actorUserId, actorSession.userId),
      isNull(supportSessions.endedAt),
    ))
    .returning({
      organizationId: supportSessions.organizationId,
      targetUserId: supportSessions.targetUserId,
    });
  if (record) {
    await logAudit({
      organizationId: record.organizationId,
      userId: actorSession.userId,
      userName: actorSession.user?.name,
      action: "logout",
      entityType: "support_view",
      entityId: record.targetUserId,
      summary: "Super Administrator ended a read-only support view",
      after: { actorId: actorSession.userId, targetUserId: record.targetUserId },
    });
  }
}
