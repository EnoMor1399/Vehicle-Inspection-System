"use server";

import { getCurrentUser } from "@/lib/auth";
import { generateTwoFactorSecret, generateTwoFactorQRCodeURI, verifyTwoFactorToken, logSecurityEvent } from "@/lib/security";
import { encryptField, decryptField } from "@/lib/field-encryption";
import { rateLimit } from "@/lib/rate-limit";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function setup2FAAction(): Promise<{
  success: boolean;
  secret?: string;
  uri?: string;
  error?: string;
}> {
  const user = await getCurrentUser();
  if (user.twoFactorEnabled) {
    return { success: false, error: "Two-factor authentication is already enabled for this account" };
  }

  const limit = await rateLimit("twoFactor", `setup:${user.id}`);
  if (!limit.allowed) {
    await logSecurityEvent("2fa_setup_rate_limited", "warning", {
      userId: user.id,
      description: "Two-factor enrollment setup was rate limited",
    });
    return { success: false, error: "Too many 2FA setup attempts. Try again later." };
  }

  try {
    const secret = generateTwoFactorSecret();
    const issuer = (process.env.TWO_FACTOR_ISSUER || "Vehicle Inspection Management System").slice(0, 100);
    const uri = generateTwoFactorQRCodeURI(user.email, secret, issuer);

    await db
      .update(users)
      .set({ twoFactorSecret: encryptField(secret), twoFactorEnabled: false, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    await logSecurityEvent("2fa_setup_started", "info", {
      userId: user.id,
      description: "Two-factor authentication setup initiated",
    });

    return { success: true, secret, uri };
  } catch {
    return { success: false, error: "Failed to generate 2FA secret" };
  }
}

export async function verify2FAAction(code: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const user = await getCurrentUser();

  if (user.twoFactorEnabled) {
    return { success: true };
  }
  if (!user.twoFactorSecret) {
    return { success: false, error: "2FA setup not initiated" };
  }

  const limit = await rateLimit("twoFactor", `enroll:${user.id}`);
  if (!limit.allowed) {
    await logSecurityEvent("2fa_enrollment_rate_limited", "warning", {
      userId: user.id,
      description: "Two-factor enrollment verification was rate limited",
    });
    return { success: false, error: "Too many verification attempts. Try again later." };
  }

  if (typeof code !== "string" || !/^\d{6,8}$/.test(code.trim())) {
    return { success: false, error: "Enter a valid authenticator code" };
  }

  const isValid = await verifyTwoFactorToken(decryptField(user.twoFactorSecret), code.trim());

  if (!isValid) {
    await logSecurityEvent("2fa_enrollment_failed", "warning", {
      userId: user.id,
      description: "Invalid code during two-factor enrollment",
    });
    return { success: false, error: "Invalid verification code" };
  }

  await db
    .update(users)
    .set({ twoFactorEnabled: true, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  await logSecurityEvent("2fa_enabled", "info", {
    userId: user.id,
    description: "Two-factor authentication enabled",
  });

  return { success: true };
}
