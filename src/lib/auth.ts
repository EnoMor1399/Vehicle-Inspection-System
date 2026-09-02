import { cookies } from "next/headers";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Administrator",
  admin: "Administrator",
  operations_manager: "Operations Manager",
  supervisor: "Supervisor",
  inspector: "Inspector",
  data_entry: "Data Entry Officer",
  auditor: "Auditor",
  compliance_officer: "Compliance Officer",
  viewer: "Viewer",
  transporter_user: "Transporter Portal User",
};

export async function getCurrentUser() {
  const jar = await cookies();
  const sessionToken = jar.get("rsl_session_token")?.value;

  if (!sessionToken) throw new Error("Authentication required");

  const { validateSession } = await import("./security");
  const session = await validateSession(sessionToken);
  if (!session.valid || !session.userId || !session.user?.isActive) {
    throw new Error("Authentication required");
  }

  return session.user;
}

export async function login(
  email: string,
  password: string,
  ipAddress: string,
  userAgent: string,
  twoFactorToken?: string,
  remember = false
): Promise<{
  success: boolean;
  requires2FA?: boolean;
  user?: any;
  sessionToken?: string;
  error?: string;
}> {
  const { verifyPassword } = await import("./password");
  const {
    logLoginAttempt,
    logSecurityEvent,
    detectSuspiciousActivity,
    createSession,
    verifyTwoFactorToken,
  } = await import("./security");

  // Resolve the account and suspicious-login signals concurrently. The two
  // checks are independent and this removes one sequential database wait from
  // every sign-in attempt.
  const [[user], suspicious] = await Promise.all([
    db.select().from(users).where(eq(users.email, email)).limit(1),
    detectSuspiciousActivity(email, ipAddress, userAgent),
  ]);

  if (suspicious.suspicious) {
    await logSecurityEvent("suspicious_login_attempt", "warning", {
      ipAddress,
      userAgent,
      description: `Suspicious login attempt for ${email}: ${suspicious.reasons.join(", ")}`,
      data: { reasons: suspicious.reasons },
    });
  }

  if (!user) {
    await logLoginAttempt(email, ipAddress, userAgent, false, "user_not_found");
    await logSecurityEvent("login_failed", "info", {
      ipAddress,
      userAgent,
      description: `Failed login attempt for non-existent email: ${email}`,
    });
    return { success: false, error: "Invalid email or password" };
  }

  if (!user.isActive) {
    await logLoginAttempt(email, ipAddress, userAgent, false, "account_disabled");
    return { success: false, error: "Account is disabled" };
  }

  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    const lockedMinutes = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60_000);
    await logLoginAttempt(email, ipAddress, userAgent, false, "account_locked");
    return { success: false, error: `Account is locked. Try again in ${lockedMinutes} minutes.` };
  }

  if (!user.passwordHash) {
    await logLoginAttempt(email, ipAddress, userAgent, false, "no_password_set");
    return { success: false, error: "Invalid email or password" };
  }

  const passwordValid = await verifyPassword(password, user.passwordHash);

  if (!passwordValid) {
    const { getSettings } = await import("./settings");
    const securitySettings = await getSettings();
    const configuredMaxAttempts = Number(securitySettings.maxFailedAttempts || process.env.MAX_LOGIN_ATTEMPTS || 5);
    const configuredLockoutMinutes = Number(securitySettings.lockoutDurationMinutes || process.env.ACCOUNT_LOCKOUT_MINUTES || 15);
    const maxAttempts = Math.min(100, Math.max(1, Number.isFinite(configuredMaxAttempts) ? configuredMaxAttempts : 5));
    const lockoutMinutes = Math.min(24 * 60, Math.max(1, Number.isFinite(configuredLockoutMinutes) ? configuredLockoutMinutes : 15));
    const nextLockUntil = new Date(Date.now() + lockoutMinutes * 60_000);

    // Increment in PostgreSQL rather than from the previously-read user row.
    // Concurrent failed requests therefore serialize on the row and cannot
    // overwrite one another with the same counter value.
    const [lockState] = await db
      .update(users)
      .set({
        failedLoginAttempts: sql<number>`${users.failedLoginAttempts} + 1`,
        lockedUntil: sql<Date | null>`case
          when ${users.failedLoginAttempts} + 1 >= ${maxAttempts} then ${nextLockUntil}
          else ${users.lockedUntil}
        end`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .returning({
        failedAttempts: users.failedLoginAttempts,
        lockedUntil: users.lockedUntil,
      });

    const failedAttempts = Number(lockState?.failedAttempts || 1);
    await logLoginAttempt(email, ipAddress, userAgent, false, "invalid_password");

    if (lockState?.lockedUntil && new Date(lockState.lockedUntil) > new Date()) {
      await logSecurityEvent("account_locked", "warning", {
        userId: user.id,
        ipAddress,
        userAgent,
        description: `Account locked after ${failedAttempts} failed login attempts`,
      });
    }

    return { success: false, error: "Invalid email or password" };
  }

  const privileged2FARequired = process.env.REQUIRE_PRIVILEGED_2FA === "true"
    && ["super_admin", "admin", "supervisor"].includes(user.role);
  if (privileged2FARequired && (!user.twoFactorEnabled || !user.twoFactorSecret)) {
    await logSecurityEvent("2fa_enrollment_required", "warning", {
      userId: user.id,
      ipAddress,
      userAgent,
      description: "Privileged account blocked because organization policy requires 2FA enrollment",
    });
    return { success: false, error: "Two-factor authentication enrollment is required by organization policy. Contact an administrator if you cannot enroll." };
  }

  if (user.twoFactorEnabled && user.twoFactorSecret) {
    if (!twoFactorToken) {
      await logLoginAttempt(email, ipAddress, userAgent, false, "2fa_required", true);
      return { success: false, requires2FA: true, error: "Two-factor authentication required" };
    }

    const { decryptField } = await import("./field-encryption");
    const tokenValid = await verifyTwoFactorToken(decryptField(user.twoFactorSecret), twoFactorToken);

    if (!tokenValid) {
      await logLoginAttempt(email, ipAddress, userAgent, false, "invalid_2fa_token", true);
      await logSecurityEvent("2fa_failed", "warning", {
        userId: user.id,
        ipAddress,
        userAgent,
        description: "Invalid 2FA token provided",
      });
      return { success: false, error: "Invalid two-factor authentication code" };
    }
  }

  await db
    .update(users)
    .set({
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      lastIp: ipAddress,
      lastUserAgent: userAgent,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  const sessionToken = await createSession(user.id, ipAddress, userAgent, { remember });

  await logLoginAttempt(email, ipAddress, userAgent, true, undefined, user.twoFactorEnabled);
  await logSecurityEvent("login_success", "info", {
    userId: user.id,
    ipAddress,
    userAgent,
    description: `Successful login for ${email}`,
    data: { twoFactorUsed: user.twoFactorEnabled },
  });

  return { success: true, user, sessionToken };
}

export async function logout(sessionId?: string): Promise<void> {
  const jar = await cookies();
  const sessionToken = jar.get("rsl_session_token")?.value;

  if (sessionToken) {
    const { validateSession, revokeSession, logSecurityEvent } = await import("./security");
    const session = await validateSession(sessionToken);

    if (session.valid && session.sessionId) {
      await revokeSession(session.sessionId);
      await logSecurityEvent("logout", "info", {
        userId: session.userId,
        description: "User logged out",
      });
    }
  }

  jar.delete("rsl_session_token");
  jar.delete("rsl_user_id");
}

const ROLE_MATRIX: Record<string, Record<string, boolean>> = {
  super_admin: { "*": true },
  admin: { transporters: true, vehicles: true, inspections: true, approve: true, reports: true, users: true, documents: true, locations: true, import: true, notifications: true, audit: true, settings: true },
  operations_manager: { transporters: true, vehicles: true, inspections: true, reports: true, locations: true, documents: true, notifications: true },
  supervisor: { transporters: true, vehicles: true, inspections: true, reports: true, approve: true, documents: true },
  inspector: { vehicles: true, inspections: true, documents: true },
  data_entry: { vehicles: true, transporters: true, import: true, documents: true },
  auditor: { reports: true, audit: true, documents: true },
  compliance_officer: { reports: true, vehicles: true, inspections: true, documents: true, notifications: true },
  viewer: {},
  transporter_user: {},
};

type UserLike = string | { role: string; permissions?: any };
function normalize(u: UserLike): { role: string; permissions: any } {
  if (typeof u === "string") return { role: u, permissions: null };
  return { role: u.role, permissions: u.permissions };
}

export function hasPermission(user: UserLike, resource: string): boolean {
  const u = normalize(user);
  if (u.permissions && typeof u.permissions === "object") {
    if ((u.permissions as Record<string, boolean>)["*"]) return true;
    if ((u.permissions as Record<string, boolean>)[resource] !== undefined) {
      return !!(u.permissions as Record<string, boolean>)[resource];
    }
  }
  const defaults = ROLE_MATRIX[u.role] || {};
  if (defaults["*"]) return true;
  return !!defaults[resource];
}

export function canEditVehicles(user: UserLike) { return hasPermission(user, "vehicles"); }
export function canEditTransporters(user: UserLike) { return hasPermission(user, "transporters"); }
export function canManageInspections(user: UserLike) { return hasPermission(user, "inspections"); }
export function canApprove(user: UserLike) { return hasPermission(user, "approve"); }
export function canImport(user: UserLike) { return hasPermission(user, "import"); }
export function canManageUsers(user: UserLike) { return hasPermission(user, "users"); }
export function canManageLocations(user: UserLike) { return hasPermission(user, "locations"); }
export function canViewReports(user: UserLike) { return hasPermission(user, "reports"); }
export function canViewAudit(user: UserLike) { return hasPermission(user, "audit"); }

export function canAccessTransporterScope(
  user: { role: string; transporterId?: string | null },
  transporterId?: string | null
): boolean {
  if (user.role !== "transporter_user") return true;
  return Boolean(user.transporterId && transporterId && user.transporterId === transporterId);
}
