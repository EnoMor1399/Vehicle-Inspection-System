"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { issueApiKey } from "@/lib/api-keys";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

type ApiScope = "read" | "write" | "inspect" | "admin";

const VALID_SCOPES = new Set<ApiScope>(["read", "write", "inspect", "admin"]);
const VALID_EXPIRY_DAYS = new Set([7, 30, 90, 180, 365]);

export async function generateApiKeyAction(input: {
  name: string;
  scopes: string[];
  expiresInDays: number | null;
}): Promise<
  | {
      ok: true;
      key: {
        id: string;
        raw: string;
        prefix: string;
        name: string;
        scopes: ApiScope[];
        expiresAt: string | null;
      };
    }
  | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!hasPermission(user, "settings")) {
    return { ok: false, error: "You do not have permission to generate API keys." };
  }

  const name = input.name.trim();
  if (name.length < 3 || name.length > 100) {
    return { ok: false, error: "Key name must be between 3 and 100 characters." };
  }

  const scopes = [...new Set(input.scopes)]
    .filter((scope): scope is ApiScope => VALID_SCOPES.has(scope as ApiScope));

  if (!scopes.length) {
    return { ok: false, error: "Select at least one API scope." };
  }

  if (scopes.includes("admin") && user.role !== "super_admin") {
    return { ok: false, error: "Only a Super Administrator can issue an Admin-scoped API key." };
  }

  if (input.expiresInDays !== null && !VALID_EXPIRY_DAYS.has(input.expiresInDays)) {
    return { ok: false, error: "Choose a supported key expiry period." };
  }

  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  try {
    const issued = await issueApiKey({
      userId: user.id,
      name,
      scopes,
      expiresAt,
    });

    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "create",
      entityType: "api_key",
      entityId: issued.id,
      entityLabel: name,
      summary: `Generated API key ${issued.prefix}…`,
      after: {
        prefix: issued.prefix,
        scopes,
        expiresAt: expiresAt?.toISOString() || null,
      },
    });

    revalidatePath("/api-docs");

    return {
      ok: true,
      key: {
        id: issued.id,
        raw: issued.raw,
        prefix: issued.prefix,
        name,
        scopes,
        expiresAt: expiresAt?.toISOString() || null,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate API key.";
    if (message.includes("API_KEY_SALT")) {
      return {
        ok: false,
        error: "API key security is not configured in production. Add API_KEY_SALT to the deployment environment and redeploy.",
      };
    }
    return { ok: false, error: "Unable to generate the API key. Please try again." };
  }
}

export async function revokeApiKeyAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!hasPermission(user, "settings")) {
    return { ok: false, error: "You do not have permission to revoke API keys." };
  }

  const [key] = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      isActive: apiKeys.isActive,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, user.id)))
    .limit(1);

  if (!key) {
    return { ok: false, error: "API key not found." };
  }

  if (!key.isActive) {
    return { ok: true };
  }

  await db
    .update(apiKeys)
    .set({ isActive: false })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, user.id)));

  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "update",
    entityType: "api_key",
    entityId: key.id,
    entityLabel: key.name,
    summary: `Revoked API key ${key.keyPrefix}…`,
    before: { isActive: true },
    after: { isActive: false },
  });

  revalidatePath("/api-docs");
  return { ok: true };
}
