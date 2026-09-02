import { cookies, headers } from "next/headers";
import { db } from "@/db";
import { users, apiKeys } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { validateSession } from "@/lib/security";
import { hasPermission } from "@/lib/auth";
import { hashApiKey, legacyApiKeyHash } from "@/lib/api-keys";
import { shouldRefreshApiKeyUsage } from "@/lib/api-key-usage";

export type ApiScope = "read" | "write" | "inspect" | "admin";

type AuthOptions = {
  scopes?: ApiScope[];
  permission?: string;
};

type Authenticated = {
  ok: true;
  user: typeof users.$inferSelect;
  authType: "api_key" | "session";
  scopes: string[];
};

type AuthFailure = { ok: false; status: number; message: string };

function scopesAllowed(granted: string[] | null | undefined, required: ApiScope[] = []): boolean {
  if (!required.length) return true;
  const set = new Set(granted || []);
  if (set.has("admin")) return true;
  return required.every((scope) => set.has(scope));
}

function userAllowed(user: typeof users.$inferSelect, permission?: string): boolean {
  return !permission || hasPermission(user, permission);
}

export async function authenticateApiRequest(options: AuthOptions = {}): Promise<Authenticated | AuthFailure> {
  try {
    const h = await headers();
    const authHeader = h.get("authorization") || "";
    const apiKeyHeader = h.get("x-api-key") || "";
    const apiKey = apiKeyHeader || authHeader.replace(/^Bearer\s+/i, "").trim();

    if (apiKey) {
      const currentHash = hashApiKey(apiKey);
      const legacyHash = legacyApiKeyHash(apiKey);
      const [row] = await db
        .select({ key: apiKeys, user: users })
        .from(apiKeys)
        .innerJoin(users, eq(users.id, apiKeys.userId))
        .where(or(eq(apiKeys.keyHash, currentHash), eq(apiKeys.keyHash, legacyHash)))
        .limit(1);

      if (!row) return { ok: false, status: 401, message: "Invalid API key" };
      const { key: keyRow, user } = row;

      if (!keyRow.isActive) return { ok: false, status: 401, message: "API key revoked" };
      if (keyRow.expiresAt && new Date(keyRow.expiresAt) <= new Date()) {
        return { ok: false, status: 401, message: "API key expired" };
      }
      if (!scopesAllowed(keyRow.scopes, options.scopes)) {
        return { ok: false, status: 403, message: "API key does not have the required scope" };
      }
      if (!user.isActive) return { ok: false, status: 401, message: "API key owner is inactive" };
      if (user.role === "transporter_user") {
        return { ok: false, status: 403, message: "Transporter portal accounts cannot access the internal integration API" };
      }
      if (!userAllowed(user, options.permission)) {
        return { ok: false, status: 403, message: "User does not have permission for this resource" };
      }

      const now = new Date();
      const upgradingLegacyHash = keyRow.keyHash === legacyHash && currentHash !== legacyHash;
      if (upgradingLegacyHash || shouldRefreshApiKeyUsage(keyRow.lastUsedAt, now)) {
        try {
          await db
            .update(apiKeys)
            .set({
              lastUsedAt: now,
              // Transparently upgrade legacy unsalted hashes after a successful use.
              ...(upgradingLegacyHash ? { keyHash: currentHash } : {}),
            })
            .where(eq(apiKeys.id, keyRow.id));
        } catch (error) {
          // Usage telemetry must not turn a valid authenticated request into an outage.
          // Never log the raw API key or either key hash.
          const message = error instanceof Error ? error.message : "unknown error";
          console.warn(`[api-auth] API key usage metadata refresh failed: ${message}`);
        }
      }

      return { ok: true, user, authType: "api_key", scopes: keyRow.scopes || [] };
    }

    const jar = await cookies();
    const sessionToken = jar.get("rsl_session_token")?.value;
    if (sessionToken) {
      const session = await validateSession(sessionToken);
      const user = session.user;
      if (session.valid && session.userId && user?.isActive) {
        if (user.role === "transporter_user") {
          return { ok: false, status: 403, message: "Transporter portal accounts cannot access the internal integration API" };
        }
        if (!userAllowed(user, options.permission)) {
          return { ok: false, status: 403, message: "You do not have permission for this resource" };
        }
        // Browser sessions inherit the user's permissions rather than API-key scopes.
        return { ok: true, user, authType: "session", scopes: ["read", "write", "inspect"] };
      }
    }

    return { ok: false, status: 401, message: "Authentication required" };
  } catch {
    return { ok: false, status: 500, message: "Authentication error" };
  }
}

export function json(data: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(data, { status, headers });
}

export function apiError(status: number, message: string, details?: unknown) {
  return Response.json({ error: { status, message, details } }, { status });
}
