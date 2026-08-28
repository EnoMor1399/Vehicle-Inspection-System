import { db } from "@/db";
import { sessions, securityEvents, loginAttempts } from "@/db/schema";
import { eq, and, gt, lt, desc, count, ne } from "drizzle-orm";
import { randomBytes, createHash } from "crypto";
import { generateSecret, generateURI, verify } from "otplib";

// ============ Two-Factor Authentication ============

export function generateTwoFactorSecret(): string {
  return generateSecret();
}

export function generateTwoFactorQRCodeURI(
  email: string,
  secret: string,
  issuer: string = "RSL VIMS"
): string {
  return generateURI({
    issuer,
    label: email,
    secret,
  });
}

export async function verifyTwoFactorToken(secret: string, token: string): Promise<boolean> {
  try {
    const result = await verify({ token, secret });
    return result.valid;
  } catch (error) {
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
  
  // Parse user agent for device info
  const deviceInfo = parseUserAgent(userAgent);
  
  await db.insert(sessions).values({
    id: randomBytes(16).toString("hex"),
    userId,
    token: hashToken(token),
    ipAddress,
    userAgent,
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
}> {
  const hashedToken = hashToken(token);
  
  const [session] = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.token, hashedToken),
        eq(sessions.isActive, true),
        gt(sessions.expiresAt, new Date())
      )
    )
    .limit(1);
  
  if (!session) {
    return { valid: false };
  }
  
  // Check for session inactivity timeout (30 minutes)
  const configuredTimeout = Number(process.env.SESSION_TIMEOUT_MINUTES || 30);
  const INACTIVITY_TIMEOUT = Math.min(24 * 60, Math.max(5, configuredTimeout)) * 60 * 1000;
  const lastActivity = session.lastActivityAt ? new Date(session.lastActivityAt).getTime() : Date.now();
  const now = Date.now();
  
  if (now - lastActivity > INACTIVITY_TIMEOUT) {
    // Session has been inactive for too long
    await db
      .update(sessions)
      .set({ isActive: false })
      .where(eq(sessions.id, session.id));
    
    await logSecurityEvent("session_timeout", "info", {
      userId: session.userId,
      ipAddress: session.ipAddress || undefined,
      userAgent: session.userAgent || undefined,
      description: "Session expired due to inactivity",
      data: { sessionId: session.id, inactivityMinutes: Math.floor((now - lastActivity) / 60000) },
    });
    
    return { valid: false };
  }
  
  // Throttle activity writes. Validation can run many times during a single page
  // request; writing on every check creates unnecessary database load.
  const ACTIVITY_WRITE_INTERVAL = 2 * 60 * 1000;
  if (now - lastActivity >= ACTIVITY_WRITE_INTERVAL) {
    await db
      .update(sessions)
      .set({ lastActivityAt: new Date(now) })
      .where(eq(sessions.id, session.id));
  }
  
  return {
    valid: true,
    userId: session.userId,
    sessionId: session.id,
  };
}

export async function revokeSession(sessionId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ isActive: false })
    .where(eq(sessions.id, sessionId));
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ isActive: false })
    .where(eq(sessions.userId, userId));
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
  await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, new Date()));
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
    data?: Record<string, any>;
  }
): Promise<void> {
  await db.insert(securityEvents).values({
    id: randomBytes(16).toString("hex"),
    userId: metadata.userId || null,
    eventType,
    severity,
    ipAddress: metadata.ipAddress || null,
    userAgent: metadata.userAgent || null,
    description: metadata.description || null,
    metadata: metadata.data || null,
    resolved: false,
  });
}

export async function getRecentSecurityEvents(limit: number = 50) {
  return await db
    .select()
    .from(securityEvents)
    .orderBy(desc(securityEvents.createdAt))
    .limit(limit);
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
  await db.insert(loginAttempts).values({
    id: randomBytes(16).toString("hex"),
    email,
    ipAddress,
    userAgent,
    success,
    twoFactorRequired,
    failureReason: failureReason || null,
  });
}

export async function getRecentFailedLogins(
  email: string,
  windowMs: number = 900000 // 15 minutes
): Promise<number> {
  const since = new Date(Date.now() - windowMs);
  
  const result = await db
    .select({ count: count() })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.email, email),
        eq(loginAttempts.success, false),
        gt(loginAttempts.createdAt, since)
      )
    );
  
  return result[0]?.count || 0;
}

export async function getFailedLoginsByIP(
  ipAddress: string,
  windowMs: number = 3600000 // 1 hour
): Promise<number> {
  const since = new Date(Date.now() - windowMs);
  
  const result = await db
    .select({ count: count() })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.ipAddress, ipAddress),
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
): Promise<{
  suspicious: boolean;
  reasons: string[];
}> {
  const reasons: string[] = [];
  
  // Check for rapid failed login attempts
  const failedAttempts = await getRecentFailedLogins(email, 900000); // 15 min
  if (failedAttempts >= 3) {
    reasons.push(`Multiple failed login attempts (${failedAttempts} in last 15 minutes)`);
  }
  
  // Check for high volume of failed attempts from IP
  const ipFailedAttempts = await getFailedLoginsByIP(ipAddress, 3600000); // 1 hour
  if (ipFailedAttempts >= 10) {
    reasons.push(`High volume of failed logins from IP (${ipFailedAttempts} in last hour)`);
  }
  
  // Check for unusual user agent (basic check)
  if (userAgent.includes("bot") || userAgent.includes("crawler") || userAgent.includes("spider")) {
    reasons.push("Suspicious user agent detected (bot/crawler)");
  }
  
  return {
    suspicious: reasons.length > 0,
    reasons,
  };
}

// ============ Utility Functions ============

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function parseUserAgent(userAgent: string): {
  browser?: string;
  os?: string;
  device?: string;
} {
  const info: { browser?: string; os?: string; device?: string } = {};
  
  // Simple parsing (in production, use a library like ua-parser-js)
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

// ============ Password Security ============

export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (password.length < 12) {
    errors.push("Password must be at least 12 characters long");
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
