import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isValidOrganizationId } from "@/lib/organization-id";

export const OPERATION_COOKIE_NAME = "vims_superadmin_operations";
export const STEP_UP_COOKIE_NAME = "vims_superadmin_stepup";
export const OPERATION_TTL_SECONDS = 15 * 60;
export const STEP_UP_TTL_SECONDS = 2 * 60;

export type OperationCapability = {
  v: 1;
  purpose: "operate" | "stepup";
  actorId: string;
  sessionId: string;
  organizationId: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};

const HEX_SESSION_ID = /^[A-Za-z0-9-]{16,64}$/;
const SAFE_ACTOR_ID = /^[A-Za-z0-9-]{16,64}$/;

function capabilityKey(sessionToken: string): Buffer {
  // Defense in depth: a compromised login token must not permit minting
  // arbitrary MFA-elevated scopes. Authentication is bound to the revocable
  // login session AND an independent server-only signing secret.
  // Never derive signing authority solely from a browser-held cookie.
  if (!/^[0-9a-f]{128}$/i.test(sessionToken)) throw new Error("Invalid login session");
  const signingSecret = process.env.SUPERADMIN_OPERATIONS_SIGNING_SECRET || process.env.SESSION_SECRET;
  if (!signingSecret || signingSecret.length < 32) throw new Error("Operations signing secret is not configured");
  return createHmac("sha256", signingSecret)
    .update("vims-superadmin-operations-v1")
    .update(sessionToken)
    .digest();
}

export function mintOperationsCapability(input: {
  purpose: OperationCapability["purpose"];
  actorId: string;
  sessionId: string;
  organizationId: string;
  sessionToken: string;
  now?: number;
}): string {
  const now = input.now ?? Date.now();
  if (!SAFE_ACTOR_ID.test(input.actorId) || !HEX_SESSION_ID.test(input.sessionId)
    || !isValidOrganizationId(input.organizationId)) throw new Error("Invalid operations identity");
  const ttl = input.purpose === "operate" ? OPERATION_TTL_SECONDS : STEP_UP_TTL_SECONDS;
  const payload: OperationCapability = {
    v: 1, purpose: input.purpose, actorId: input.actorId,
    sessionId: input.sessionId, organizationId: input.organizationId,
    issuedAt: now, expiresAt: now + ttl * 1000,
    nonce: randomBytes(16).toString("hex"),
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", capabilityKey(input.sessionToken))
    .update(data).digest("base64url");
  return `${data}.${mac}`;
}

export function verifyOperationsCapability(input: {
  token: string;
  purpose: OperationCapability["purpose"];
  actorId: string;
  sessionId: string;
  sessionToken: string;
  organizationId?: string;
  now?: number;
}): OperationCapability | null {
  try {
    if (typeof input.token !== "string" || input.token.length > 1200) return null;
    const [data, mac, extra] = input.token.split(".");
    if (!data || !mac || extra || data.length > 950 || mac.length > 100) return null;
    const expected = createHmac("sha256", capabilityKey(input.sessionToken))
      .update(data).digest();
    const actual = Buffer.from(mac, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as OperationCapability;
    const now = input.now ?? Date.now();
    const ttlMs = (input.purpose === "operate" ? OPERATION_TTL_SECONDS : STEP_UP_TTL_SECONDS) * 1000;
    if (payload.v !== 1 || payload.purpose !== input.purpose
      || payload.actorId !== input.actorId || payload.sessionId !== input.sessionId
      || !isValidOrganizationId(payload.organizationId)
      || (input.organizationId && payload.organizationId !== input.organizationId)
      || !Number.isSafeInteger(payload.issuedAt) || !Number.isSafeInteger(payload.expiresAt)
      || payload.issuedAt > now + 5000 || payload.expiresAt <= now
      || payload.expiresAt - payload.issuedAt > ttlMs
      || now - payload.issuedAt > ttlMs
      || !/^[0-9a-f]{32}$/.test(payload.nonce)
    ) return null;
    return payload;
  } catch { return null; }
}

export type ScopedWriteRisk = "routine" | "high";

// Deliberately fail closed. Only native operational workspaces can write under
// cross-company mode; platform administration is always handled separately.
// All imports/exports, user changes, approvals, financial actions, records
// removal, and unknown operations require fresh MFA step-up.
export function classifyScopedWrite(pathname: string): ScopedWriteRisk {
  if (/^\/(?:vehicles|transporters)\/new\/?$/.test(pathname)) return "routine";
  // Inspection decisions, certifications, signed pre-trip checks and schedule
  // reassignment can carry compliance consequences, so they require step-up.
  // Edit forms may also expose deletion/decommission actions, so their
  // entire POST is high risk instead of relying on UI button labels.
  return "high";
}

const REVIEWED_OPERATION_PATHS = ["/vehicles", "/transporters", "/inspections",
  "/daily-inspections", "/schedule", "/locations", "/driver-training",
  "/reports", "/compliance", "/predictive", "/powerbi", "/rfid",
  "/users", "/documents", "/import", "/settings", "/audit",
  "/notifications", "/portal", "/apps", "/api-docs", "/guide"] as const;

export function isAuthorizedOperationPage(pathname: string): boolean {
  if (pathname === "/") return true;
  return REVIEWED_OPERATION_PATHS.some((prefix) =>
    pathname === prefix || pathname.startsWith(prefix + "/"));
}
