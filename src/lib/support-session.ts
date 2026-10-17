import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { supportSessions, users } from "@/db/schema";
import { validateSession } from "@/lib/security";

export const SUPPORT_COOKIE_NAME = "vims_support_token";
export const SUPPORT_TTL_SECONDS = 15 * 60;

type AuthenticatedSession = Awaited<ReturnType<typeof validateSession>>;

export function supportMethodAllowed(method: string, path: string): boolean {
  // Exit is handled by an independent route using the original actor session.
  return method === "GET" || method === "HEAD"
    || (method === "POST" && path === "/api/support-session/end");
}

export async function resolveSupportSession(token: string, session: AuthenticatedSession) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error("Invalid support session");
  if (!session.valid || !session.sessionId || !session.userId || !session.user
      || session.user.role !== "super_admin" || !session.user.isActive
      || !session.user.twoFactorEnabled) throw new Error("Support authorization expired");

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const [record] = await db.select({
    support: supportSessions,
    target: users,
  }).from(supportSessions)
    .innerJoin(users, eq(users.id, supportSessions.targetUserId))
    .where(and(
      eq(supportSessions.tokenHash, tokenHash),
      eq(supportSessions.actorSessionId, session.sessionId),
      eq(supportSessions.actorUserId, session.userId),
      isNull(supportSessions.endedAt),
      gt(supportSessions.expiresAt, new Date()),
    )).limit(1);

  if (!record || !record.target.isActive || record.target.role === "super_admin"
      || record.support.organizationId !== record.target.organizationId) {
    throw new Error("Support session expired or was revoked");
  }
  return { actor: session.user, target: record.target, support: record.support };
}

export async function effectiveUserForRequest(session: AuthenticatedSession, supportToken?: string) {
  if (!session.valid || !session.user) throw new Error("Authentication required");
  if (!supportToken) return { user: session.user, support: null };
  const requestHeaders = await headers();
  // Defense-in-depth: server functions reject writes even if middleware is bypassed.
  if (!supportMethodAllowed(requestHeaders.get("x-vims-request-method") || "", requestHeaders.get("x-vims-request-path") || "")) {
    throw new Error("Support sessions are read-only");
  }
  const active = await resolveSupportSession(supportToken, session);
  return { user: active.target, support: active };
}

export async function getActiveSupportContext() {
  const jar = await cookies();
  const token = jar.get(SUPPORT_COOKIE_NAME)?.value;
  if (!token) return null;
  const original = jar.get("rsl_session_token")?.value;
  if (!original) return null;
  const session = await validateSession(original);
  return resolveSupportSession(token, session);
}
