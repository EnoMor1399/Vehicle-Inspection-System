"use server";

import { cookies, headers } from "next/headers";
import { db } from "@/db";
import { users, auditLogs } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { newId } from "@/lib/utils";
import { hashPassword, validatePasswordStrength, validateEmail } from "@/lib/password";
import { login as secureLogin, logout as secureLogout } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export type AuthResult =
  | { ok: true; userId: string; userName: string; role: string }
  | { ok: false; error: string; field?: string; requires2FA?: boolean };

export async function signIn(
  email: string,
  password: string,
  remember = false,
  twoFactorToken?: string
): Promise<AuthResult> {
  const normalized = email.trim().toLowerCase();

  if (!validateEmail(normalized)) {
    return { ok: false, error: "Please enter a valid email address", field: "email" };
  }
  if (!password) {
    return { ok: false, error: "Password is required", field: "password" };
  }

  // Get IP and user agent
  const headersList = await headers();
  const ipAddress = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() || headersList.get("x-real-ip") || "unknown";
  const userAgent = headersList.get("user-agent") || "unknown";

  const loginLimit = await rateLimit("login", ipAddress);
  if (!loginLimit.allowed) {
    return { ok: false, error: "Too many sign-in attempts. Please try again later." };
  }
  if (twoFactorToken) {
    const twoFactorLimit = await rateLimit("twoFactor", `${ipAddress}:${normalized}`);
    if (!twoFactorLimit.allowed) {
      return { ok: false, error: "Too many verification attempts. Please try again later." };
    }
  }

  // Use secure login function
  const result = await secureLogin(normalized, password, ipAddress, userAgent, twoFactorToken, remember);

  if (!result.success) {
    if (result.requires2FA) {
      return { ok: false, error: result.error || "Two-factor authentication required", requires2FA: true };
    }
    return { ok: false, error: result.error || "Login failed" };
  }

  // Set session cookie
  if (result.sessionToken) {
    const jar = await cookies();
    const maxAge = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 8; // 30 days or 8 hours
    jar.set("rsl_session_token", result.sessionToken, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge,
    });
  }

  return {
    ok: true,
    userId: result.user.id,
    userName: result.user.name,
    role: result.user.role,
  };
}

export async function signOut(): Promise<void> {
  await secureLogout();
}

export async function signUp(input: {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone?: string;
}): Promise<AuthResult> {
  const { name, email, password, confirmPassword, phone } = input;
  const normalized = email.trim().toLowerCase();

  if (!name || name.trim().length < 2) {
    return { ok: false, error: "Name must be at least 2 characters", field: "name" };
  }
  if (!validateEmail(normalized)) {
    return { ok: false, error: "Please enter a valid email address", field: "email" };
  }
  const strength = validatePasswordStrength(password);
  if (!strength.valid) {
    return { ok: false, error: strength.errors[0], field: "password" };
  }
  const { getSettings } = await import("@/lib/settings");
  const securitySettings = await getSettings();
  if (password.length < Math.max(12, securitySettings.passwordMinLength)) {
    return { ok: false, error: `Password must be at least ${Math.max(12, securitySettings.passwordMinLength)} characters`, field: "password" };
  }
  if (password !== confirmPassword) {
    return { ok: false, error: "Passwords do not match", field: "confirmPassword" };
  }

  const headersList = await headers();
  const ipAddress = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() || headersList.get("x-real-ip") || "unknown";
  const userAgent = headersList.get("user-agent") || "unknown";
  const signupLimit = await rateLimit("signup", `ip:${ipAddress}`);
  if (!signupLimit.allowed) {
    return { ok: false, error: "Too many account-creation attempts. Please try again later." };
  }

  const passwordHash = await hashPassword(password);
  const id = newId();
  const bootstrapEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();

  const created = await db.transaction(async (tx) => {
    // Serialise account bootstrap so concurrent sign-ups cannot create multiple
    // initial administrators or permanently consume the bootstrap slot.
    await tx.execute(sql`select pg_advisory_xact_lock(78654219)`);

    const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.email, normalized));
    if (existing) return { ok: false as const, error: "An account with this email already exists", field: "email" as const };

    const [superAdminCount] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.role, "super_admin"));
    const [userCount] = await tx.select({ n: sql<number>`count(*)::int` }).from(users);

    const noSuperAdmin = Number(superAdminCount?.n || 0) === 0;
    const isBootstrapIdentity = Boolean(bootstrapEmail && bootstrapEmail === normalized);
    const isDevelopmentFirstUser = process.env.NODE_ENV !== "production" && Number(userCount?.n || 0) === 0;
    const role = noSuperAdmin && (isBootstrapIdentity || isDevelopmentFirstUser) ? "super_admin" : "viewer";

    // If a production deployment has no administrator, only the configured
    // bootstrap identity may claim that role. Other accounts can safely exist
    // as viewers without blocking the administrator from registering later.
    if (process.env.NODE_ENV === "production" && noSuperAdmin && !bootstrapEmail) {
      return {
        ok: false as const,
        error: "Administrator bootstrap is not configured. Set BOOTSTRAP_ADMIN_EMAIL before creating the first production account.",
        field: "email" as const,
      };
    }

    await tx.insert(users).values({
      id,
      name: name.trim(),
      email: normalized,
      role,
      passwordHash,
      phone: phone?.trim() || null,
      isActive: true,
    });

    await tx.insert(auditLogs).values({
      id: newId(),
      userId: id,
      userName: name.trim(),
      action: "create",
      entityType: "user",
      entityId: id,
      entityLabel: normalized,
      summary: `New account created: ${name.trim()} (${normalized})`,
    });

    return { ok: true as const, role };
  });

  if (!created.ok) return created;

  // Auto sign in using the same revocable session mechanism as normal login.
  const { createSession } = await import("@/lib/security");
  const sessionToken = await createSession(id, ipAddress, userAgent, { remember: false });
  const jar = await cookies();
  jar.set("rsl_session_token", sessionToken, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 8,
  });

  await db.insert(auditLogs).values({
    id: newId(),
    userId: id,
    userName: name.trim(),
    action: "login",
    entityType: "user",
    entityId: id,
    entityLabel: normalized,
    summary: `${name.trim()} signed up and logged in`,
  });

  return { ok: true, userId: id, userName: name.trim(), role: created.role };
}
