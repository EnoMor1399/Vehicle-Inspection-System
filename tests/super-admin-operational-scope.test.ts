import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  classifyScopedWrite, isAuthorizedOperationPage,
  mintOperationsCapability, verifyOperationsCapability,
  OPERATION_TTL_SECONDS, STEP_UP_TTL_SECONDS,
} from "../src/lib/super-admin-operations-token";

// Unit-only signing secret; no production key is written to source control.
process.env.SESSION_SECRET ||= "vims-ci-only-operations-test-secret-not-for-deployment";
const actorId = "e2e90000-0000-4000-8000-000000000001";
const sessionId = "e2e90000-0000-4000-8000-000000000002";
const organizationId = "e2e10000-0000-4000-8000-000000000001";
const otherOrganizationId = "00000000-0000-4000-8000-000000000101";
const sessionToken = randomBytes(64).toString("hex");
const now = 1_793_000_000_000;
const read = (p: string) => readFileSync(p, "utf8");

test("Super Admin company capabilities are bound to the real actor, login and organization", () => {
  const token = mintOperationsCapability({
    purpose: "operate", actorId, sessionId, organizationId, sessionToken, now,
  });
  const base = {
    token, purpose: "operate" as const, actorId, sessionId, sessionToken, now: now + 60_000,
  };
  const capability = verifyOperationsCapability(base);
  assert.equal(capability?.organizationId, organizationId);
  assert.equal(capability?.actorId, actorId);
  assert.equal(capability?.expiresAt, now + OPERATION_TTL_SECONDS * 1000);
  assert.equal(verifyOperationsCapability({ ...base, actorId: "00000000-0000-4000-8000-000000000011" }), null);
  assert.equal(verifyOperationsCapability({ ...base, sessionId: "00000000-0000-4000-8000-000000000011" }), null);
  assert.equal(verifyOperationsCapability({ ...base, organizationId: otherOrganizationId }), null);
  assert.equal(verifyOperationsCapability({ ...base, sessionToken: randomBytes(64).toString("hex") }), null);
  const originalSecret = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = "vims-ci-other-independent-signature-key-string";
  assert.equal(verifyOperationsCapability(base), null,
    "Changing the independent server-only secret must invalidate a stolen session cookie");
  process.env.SESSION_SECRET = originalSecret;
  assert.equal(verifyOperationsCapability({ ...base, now: now + OPERATION_TTL_SECONDS * 1000 }), null);
  assert.equal(verifyOperationsCapability({ ...base, token: token.slice(0, -2) + "AA" }), null);
  assert.equal(verifyOperationsCapability({ ...base, token: "invalid.token" }), null);
});

test("high-risk step-up expires quickly and is never usable as an operations grant", () => {
  const token = mintOperationsCapability({
    purpose: "stepup", actorId, sessionId, organizationId, sessionToken, now,
  });
  const context = { token, actorId, sessionId, sessionToken, now: now + 30_000 };
  assert.equal(verifyOperationsCapability({ ...context, purpose: "stepup" })?.expiresAt,
    now + STEP_UP_TTL_SECONDS * 1000);
  assert.equal(verifyOperationsCapability({ ...context, purpose: "operate" }), null);
  assert.equal(verifyOperationsCapability({ ...context, purpose: "stepup", now: now + STEP_UP_TTL_SECONDS * 1000 }), null);
});

test("routine writes are restricted to known forms and everything else requires extra MFA", () => {
  for (const pathname of [
    "/vehicles/new", "/transporters/new", "/inspections/new",
    "/daily-inspections/new", "/schedule",
  ]) assert.equal(classifyScopedWrite(pathname), "routine");
  for (const pathname of [
    "/vehicles/e2e/edit", "/transporters/e2e/edit", "/users",
    "/settings", "/import", "/inspections/e2e", "/daily-inspections/e2e",
    "/locations", "/driver-training", "/notifications", "/organization/account",
  ]) assert.equal(classifyScopedWrite(pathname), "high");
  for (const pathname of ["/api/v1/vehicles", "/api/payments",
    "/platform/organizations", "/security/2fa", "/auth/logout"]) {
    assert.equal(isAuthorizedOperationPage(pathname), false);
  }
  assert.equal(isAuthorizedOperationPage("/vehicles/new"), true);
});

test("authorization validates signed scope server-side, checks MFA, and never uses sidebar storage for permission", () => {
  const actions = read("src/lib/super-admin-operations-actions.ts");
  const resolver = read("src/lib/super-admin-operations.ts");
  const proxy = read("src/proxy.ts");
  const auth = read("src/lib/auth.ts");
  const requireAuth = read("src/lib/require-auth.ts");
  const ui = read("src/components/SuperAdminOperationControls.tsx");
  assert.match(actions, /await validateSession\(loginToken\)/);
  assert.match(actions, /await verifyFreshMFA\(actor, input\.authenticationCode\)/);
  assert.match(actions, /await getOrganizationSubscriptionState\(organizationId\)/);
  assert.match(actions, /required: true/);
  assert.match(resolver, /verifyOperationsCapability\(/);
  assert.match(resolver, /organizationId: capability\.organizationId/);
  assert.match(resolver, /return \{ \.\.\.session\.user!, organizationId: context\.organizationId \}/);
  assert.match(resolver, /await requireOperationAudit\(/);
  assert.match(resolver, /context\.stepUpExpiresAt/);
  assert.doesNotMatch(resolver, /sessionStorage|localStorage/);
  assert.match(auth, /operationalUserForRequest\(/);
  assert.match(requireAuth, /operationalUserForRequest\(/);
  assert.match(proxy, /request\.cookies\.has\("vims_superadmin_operations"\)/);
  assert.match(proxy, /pathname\.startsWith\("\/api\/"\)/);
  assert.match(ui, /Enable organization operations/);
  assert.match(ui, /Authorize sensitive operations/);
  assert.match(ui, /Exit company operations/);
});

test("privileged audit requests fail closed without interfering with ordinary audit behavior", () => {
  const code = read("src/lib/audit.ts");
  assert.match(code, /required\?: boolean/);
  assert.match(code, /if \(input\.required\) throw new Error/);
  const resolver = read("src/lib/super-admin-operations.ts");
  assert.match(resolver, /required: true/);
});

test("all operations endpoints enforce same-origin policy and start/step-up support only POST", () => {
  for (const endpoint of ["start", "elevate", "end"]) {
    const route = read(`src/app/api/platform/operations/${endpoint}/route.ts`);
    assert.match(route, /trustedOperationsOrigin\(request\)/);
    assert.match(route, /export async function POST\(/);
    assert.match(route, /status: 405/);
  }
});
