import { db } from "@/db";
import { sessions, securityEvents, loginAttempts, users } from "@/db/schema";
import { eq, and, gt, lt, desc, count, ne } from "drizzle-orm";
import { randomBytes, createHash } from "crypto";
import { generateSecret, generateURI, verify } from "otplib";
import { normalizeClientIp, normalizeUserAgent } from "@/lib/request-context";

export { validatePasswordStrength } from "./password";

const MAX_SECURITY_DESCRIPTION_LENGTH = 2_000;
const MAX_SECURITY_METADATA_BYTES = 16_000;
const MAX_SECURITY_EVENTS_PAGE = 200;

function boundedText(value: string | null | undefined, maxLength: number): string | null {
  if (!value) return null;
  const normalized = value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function boundedSecurityMetadata(data?: Record<string, unknown>): Record<string, unknown> | null {
  if (!data) return null;
  try {
    const serialized = JSON.stringify(data);
    if (serialized.length <= MAX_SECURITY_METADATA_BYTES) return data;
    return { truncated: true, originalSize: serialized.length };
  } catch {
    return { dropped: true, reason: "non_serializable" };
  }
}

function warnTelemetryFailure(area: string, error: unknown): void {
  const message = error instanceof Error ? error.message : "unknown error";
  console.warn(`[security] ${area} failed: ${message}`);
}

// ============ Two-Factor Authentication ============

export function generateTwoFactorSecret(): string {
  return generateSecret();
}

export function generateTwoFactorQRCodeURI(
  email: string,
  secret: string,
  issuer: string = "RSL VIMS"
): string {
  return generateURI({ issuer, label: email, secret });
}

export async function verifyTwoFactorToken(secret: string, token: string): Promise<boolean> {
  try {
    const result = await verify({ token, secret });
    return result.valid;
  } catch {
    return false;
  }
}

// ============ Session Management ============

export async function createSession(
  userId: string,
  ipAddress: string,
  userAgent: string,
  options: { remember?: boolean } = {}
): Promise<string> {
  const token = randomBytes(64).toString("hex");
  const ttlMs = options.remember ? 30 * 24 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + ttlMs);
  const safeIp = normalizeClientIp(ipAddress);
  const safeUserAgent = normalizeUserAgent(userAgent);
  const deviceInfo = parseUserAgent(safeUserAgent);

  await db.insert(sessions).values({
    id: randomBytes(16).toString("hex"),
    userId,
    token: hashToken(token),
    ipAddress: safeIp,
    userAgent: safeUserAgent,
    deviceInfo,
    isActive: true,
    expiresAt,
    lastActivityAt: new Date(),
  });

  return token;
}

export async function validateSession(token: string): Promise<{
  valid: boolean;
  userId?: string;
  sessionId?: string;
  user?: typeof users.$inferSelect;
}> {
  const hashedToken = hashToken(token);

  // Resolve the session and its owner in one database round-trip. This also
  // means a disabled account can no longer retain a technically valid session.
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.token, hashedToken),
        eq(sessions.isActive, true),
        gt(sessions.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!row) return { valid: false };
  const { session, user } = row;

  if (!user.isActive) {
    try {
      await db.update(sessions).set({ isActive: false }).where(eq(sessions.id, session.id));
    } catch (error) {
      warnTelemetryFailure("inactive-session revocation", error);
    }
    await logSecurityEvent("session_revoked_inactive_user", "warning", {
      userId: user.id,
      ipAddress: session.ipAddress || undefined,
      userAgent: session.userAgent || undefined,
      description: "Session rejected because the owning account is inactive",
      data: { sessionId: session.id },
    });
    return { valid: false };
  }

  const configuredTimeout = Number(process.env.SESSION_TIMEOUT_MINUTES || 30);
  const inactivityTimeout = Math.min(24 * 60, Math.max(5, Number.isFinite(configuredTimeout) ? configuredTimeout : 30)) * 60 * 1000;
  const lastActivity = session.lastActivityAt ? new Date(session.lastActivityAt).getTime() : Date.now();
  const now = Date.now();

  if (now - lastActivity > inactivityTimeout) {
    try {
      await db
        .update(sessions)
        .set({ isActive: false })
        .where(eq(sessions.id, session.id));
    } catch (error) {
      warnTelemetryFailure("expired-session revocation", error);
    }

    await logSecurityEvent("session_timeout", "info", {
      userId: session.userId,
      ipAddress: session.ipAddress || undefined,
      userAgent: session.userAgent || undefined,
      description: "Session expired due to inactivity",
      data: { sessionId: session.id, inactivityMinutes: Math.floor((now - lastActivity) / 60_000) },
    });

    return { valid: false };
  }

  const activityWriteInterval = 2 * 60 * 1000;
  if (now - lastActivity >= activityWriteInterval) {
    try {
      await db
        .update(sessions)
        .set({ lastActivityAt: new Date(now) })
        .where(eq(sessions.id, session.id));
    } catch (error) {
      // Activity telemetry should not invalidate an otherwise valid session.
      warnTelemetryFailure("session activity refresh", error);
    }
  }

  return { valid: true, userId: session.userId, sessionId: session.id, user };
}

export async function revokeSession(sessionId: string): Promise<void> {
  await db.update(sessions).set({ isActive: false }).where(eq(sessions.id, sessionId));
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await db.update(sessions).set({ isActive: false }).where(eq(sessions.userId, userId));
}

export async function revokeAllOtherUserSessions(userId: string, currentSessionId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ isActive: false })
    .where(and(eq(sessions.userId, userId), ne(sessions.id, currentSessionId)));
}

export async function getUserActiveSessions(userId: string) {
  return await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        eq(sessions.isActive, true),
        gt(sessions.expiresAt, new Date())
      )
    )
    .orderBy(desc(sessions.lastActivityAt));
}

export async function cleanExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

// ============ Security Events ============

export async function logSecurityEvent(
  eventType: string,
  severity: "info" | "warning" | "critical" = "info",
  metadata: {
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    description?: string;
    data?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    const safeEventType = boundedText(eventType, 50) || "security_event";
    await db.insert(securityEvents).values({
      id: randomBytes(16).toString("hex"),
      userId: boundedText(metadata.userId, 36),
      eventType: safeEventType,
      severity,
      ipAddress: metadata.ipAddress ? normalizeClientIp(metadata.ipAddress) : null,
      userAgent: metadata.userAgent ? normalizeUserAgent(metadata.userAgent) : null,
      description: boundedText(metadata.description, MAX_SECURITY_DESCRIPTION_LENGTH),
      metadata: boundedSecurityMetadata(metadata.data),
      resolved: false,
    });
  } catch (error) {
    // Security telemetry is important, but a telemetry-table failure must not
    // convert a valid authentication/session decision into an application outage.
    warnTelemetryFailure("security-event persistence", error);
  }
}

export async function getRecentSecurityEvents(limit: number = 50) {
  const safeLimit = Number.isFinite(limit)
    ? Math.min(MAX_SECURITY_EVENTS_PAGE, Math.max(1, Math.floor(limit)))
    : 50;
  return await db
    .select()
    .from(securityEvents)
    .orderBy(desc(securityEvents.createdAt))
    .limit(safeLimit);
}

// ============ Login Attempt Tracking ============

export async function logLoginAttempt(
  email: string,
  ipAddress: string,
  userAgent: string,
  success: boolean,
  failureReason?: string,
  twoFactorRequired: boolean = false
): Promise<void> {
  try {
    await db.insert(loginAttempts).values({
      id: randomBytes(16).toString("hex"),
      email: (boundedText(email.toLowerCase(), 200) || "unknown").slice(0, 200),
      ipAddress: normalizeClientIp(ipAddress),
      userAgent: normalizeUserAgent(userAgent),
      success,
      twoFactorRequired,
      failureReason: boundedText(failureReason, 100),
    });
  } catch (error) {
    warnTelemetryFailure("login-attempt persistence", error);
  }
}

export async function getRecentFailedLogins(
  email: string,
  windowMs: number = 900_000
): Promise<number> {
  const safeWindow = Math.min(24 * 60 * 60 * 1000, Math.max(1_000, windowMs));
  const since = new Date(Date.now() - safeWindow);
  const result = await db
    .select({ count: count() })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.email, email.slice(0, 200).toLowerCase()),
        eq(loginAttempts.success, false),
        gt(loginAttempts.createdAt, since)
      )
    );
  return result[0]?.count || 0;
}

export async function getFailedLoginsByIP(
  ipAddress: string,
  windowMs: number = 3_600_000
): Promise<number> {
  const safeWindow = Math.min(24 * 60 * 60 * 1000, Math.max(1_000, windowMs));
  const since = new Date(Date.now() - safeWindow);
  const result = await db
    .select({ count: count() })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.ipAddress, normalizeClientIp(ipAddress)),
        eq(loginAttempts.success, false),
        gt(loginAttempts.createdAt, since)
      )
    );
  return result[0]?.count || 0;
}

// ============ Intrusion Detection ============

export async function detectSuspiciousActivity(
  email: string,
  ipAddress: string,
  userAgent: string
): Promise<{ suspicious: boolean; reasons: string[] }> {
  const reasons: string[] = [];
  const [failedAttempts, ipFailedAttempts] = await Promise.all([
    getRecentFailedLogins(email, 900_000).catch((error) => {
      warnTelemetryFailure("failed-login email lookup", error);
      return 0;
    }),
    getFailedLoginsByIP(ipAddress, 3_600_000).catch((error) => {
      warnTelemetryFailure("failed-login IP lookup", error);
      return 0;
    }),
  ]);

  if (failedAttempts >= 3) {
    reasons.push(`Multiple failed login attempts (${failedAttempts} in last 15 minutes)`);
  }
  if (ipFailedAttempts >= 10) {
    reasons.push(`High volume of failed logins from IP (${ipFailedAttempts} in last hour)`);
  }

  const lowerUserAgent = normalizeUserAgent(userAgent).toLowerCase();
  if (lowerUserAgent.includes("bot") || lowerUserAgent.includes("crawler") || lowerUserAgent.includes("spider")) {
    reasons.push("Suspicious user agent detected (bot/crawler)");
  }

  return { suspicious: reasons.length > 0, reasons };
}

// ============ Utility Functions ============

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function parseUserAgent(userAgent: string): { browser?: string; os?: string; device?: string } {
  const info: { browser?: string; os?: string; device?: string } = {};

  if (userAgent.includes("Chrome")) info.browser = "Chrome";
  else if (userAgent.includes("Firefox")) info.browser = "Firefox";
  else if (userAgent.includes("Safari")) info.browser = "Safari";
  else if (userAgent.includes("Edge")) info.browser = "Edge";

  if (userAgent.includes("Windows")) info.os = "Windows";
  else if (userAgent.includes("Mac")) info.os = "macOS";
  else if (userAgent.includes("Linux")) info.os = "Linux";
  else if (userAgent.includes("Android")) info.os = "Android";
  else if (userAgent.includes("iOS") || userAgent.includes("iPhone")) info.os = "iOS";

  if (userAgent.includes("Mobile")) info.device = "Mobile";
  else if (userAgent.includes("Tablet")) info.device = "Tablet";
  else info.device = "Desktop";

  return info;
}
