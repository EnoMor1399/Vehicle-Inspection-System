"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { revokeSession, revokeAllOtherUserSessions, validateSession, logSecurityEvent } from "@/lib/security";

export async function revokeSessionAction(formData: FormData) {
  const user = await getCurrentUser();
  const sessionId = String(formData.get("sessionId") || "").trim();
  if (!sessionId || sessionId.length > 128) throw new Error("Session ID is invalid");

  const { db } = await import("@/db");
  const { sessions } = await import("@/db/schema");
  const { and, eq } = await import("drizzle-orm");
  const [owned] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, user.id)))
    .limit(1);
  if (!owned) throw new Error("Session not found");

  await revokeSession(sessionId);
  await logSecurityEvent("session_revoked", "info", { userId: user.id, description: "A session was revoked from the security dashboard" });
  revalidatePath("/security");
}

export async function revokeAllSessionsAction() {
  const user = await getCurrentUser();
  const jar = await cookies();
  const token = jar.get("rsl_session_token")?.value;
  if (!token) throw new Error("Current session not found");

  const current = await validateSession(token);
  if (!current.valid || !current.sessionId || current.userId !== user.id) {
    throw new Error("Current session is invalid");
  }

  await revokeAllOtherUserSessions(user.id, current.sessionId);
  await logSecurityEvent("other_sessions_revoked", "info", {
    userId: user.id,
    description: "All other active sessions were revoked",
  });
  revalidatePath("/security");
}
