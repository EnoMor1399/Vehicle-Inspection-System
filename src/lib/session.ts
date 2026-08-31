"use server";

import { cookies, headers } from "next/headers";
import { db } from "@/db";
import { users, auditLogs } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { newId } from "@/lib/utils";
import { hashPassword, validatePasswordStrength, validateEmail } from "@/lib/password";
import { login as secureLogin, logout as secureLogout } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { clientIpFromHeaders, normalizeUserAgent } from "@/lib/request-context";

const MAX_PASSWORD_INPUT_LENGTH = 256;
const MAX_EMAIL_LENGTH = 200;
const MAX_NAME_LENGTH = 200;
const MAX_PHONE_LENGTH = 50;

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

  if (normalized.length > MAX_EMAIL_LENGTH || !validateEmail(normalized)) {
    return { ok: false, error: "Please enter a valid email address", field: "email" };
  }
  if (!password) {
    return { ok: false, error: "Password is required", field: "password" };
  }
  if (password.length > MAX_PASSWORD_INPUT_LENGTH) {
    return { ok: false, error: "Invalid email or password", field: "password" };
  }

  const headersList = await headers();
  const ipAddress = clientIpFromHeaders(headersList);
  const userAgent = normalizeUserAgent(headersList.get("user-agent"));

  const loginLimit = await rateLimit("login", ipAddress);
  if (!loginLimit.allowed) {
    return { ok: false, error: "Too many sign-in attempts. Please try again later." };
  }
  if (twoFactorToken) {
    const twoFactorLimit = await rateLimit("twoFactor", `${ipAddress}:${normalized}`);
    if (!twoFactorLimit.allowed) {
      return { ok: false, error: "Too many verification attempts. Please try again later." };
    }
    if (!/^\d{6}$/.test(twoFactorToken)) {
      return { ok: false, error: "Enter a valid 6-digit authentication code" };
    }
  }

  const result = await secureLogin(normalized, password, ipAddress, userAgent, twoFactorToken, remember);

  if (!result.success) {
    if (result.requires2FA) {
      return { ok: false, error: result.error || "Two-factor authentication required", requires2FA: true };
    }
    return { ok: false, error: result.error || "Login failed" };
  }

  if (result.sessionToken) {
    const jar = await cookies();
    const maxAge = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 8;
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
  const normalizedName = name.trim();
  const normalizedPhone = phone?.trim() || "";

  if (normalizedName.length < 2 || normalizedName.length > MAX_NAME_LENGTH) {
    return { ok: false, error: `Name must be between 2 and ${MAX_NAME_LENGTH} characters`, field: "name" };
  }
  if (normalized.length > MAX_EMAIL_LENGTH || !validateEmail(normalized)) {
    return { ok: false, error: "Please enter a valid email address", field: "email" };
  }
  if (password.length > MAX_PASSWORD_INPUT_LENGTH || confirmPassword.length > MAX_PASSWORD_INPUT_LENGTH) {
    return { ok: false, error: `Password must not exceed ${MAX_PASSWORD_INPUT_LENGTH} characters`, field: "password" };
  }
  if (normalizedPhone.length > MAX_PHONE_LENGTH) {
    return { ok: false, error: `Phone number must not exceed ${MAX_PHONE_LENGTH} characters`, field: "phone" };
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
  const ipAddress = clientIpFromHeaders(headersList);
  const userAgent = normalizeUserAgent(headersList.get("user-agent"));
  const signupLimit = await rateLimit("signup", `ip:${ipAddress}`);
  if (!signupLimit.allowed) {
    return { ok: false, error: "Too many account-creation attempts. Please try again later." };
  }

  const passwordHash = await hashPassword(password);
  const id = newId();
  const bootstrapEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();

  const created = await db.transaction(async (tx) => {
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

    if (process.env.NODE_ENV === "production" && noSuperAdmin && !bootstrapEmail) {
      return {
        ok: false as const,
        error: "Administrator bootstrap is not configured. Set BOOTSTRAP_ADMIN_EMAIL before creating the first production account.",
        field: "email" as const,
      };
    }

    await tx.insert(users).values({
      id,
      name: normalizedName,
      email: normalized,
      role,
      passwordHash,
      phone: normalizedPhone || null,
      isActive: true,
    });

    await tx.insert(auditLogs).values({
      id: newId(),
      userId: id,
      userName: normalizedName,
      action: "create",
      entityType: "user",
      entityId: id,
      entityLabel: normalized,
      summary: `New account created: ${normalizedName} (${normalized})`,
    });

    return { ok: true as const, role };
  });

  if (!created.ok) return created;

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
    userName: normalizedName,
    action: "login",
    entityType: "user",
    entityId: id,
    entityLabel: normalized,
    summary: `${normalizedName} signed up and logged in`,
  });

  return { ok: true, userId: id, userName: normalizedName, role: created.role };
}
