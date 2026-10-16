import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("subscriber onboarding is fail-closed until tenant isolation is verified", () => {
  const access = readFileSync("src/lib/organization-access.ts", "utf8");
  const control = readFileSync("src/lib/organization-control-plane.ts", "utf8");

  assert.match(access, /operationalAccessEnabled/);
  assert.match(access, /dataIsolationVerifiedAt/);
  assert.match(access, /workspace_provisioning/);
  assert.match(control, /status: "provisioning"/);
  assert.match(control, /operationalAccessEnabled: false/);
});

test("subscription requests are validated, rate limited and honeypot protected", () => {
  const source = readFileSync("src/app/subscribe/actions.ts", "utf8");
  assert.match(source, /onboardingSchema/);
  assert.match(source, /website/);
  assert.match(source, /rateLimit\("signup"/);
  assert.match(source, /sourceIpHash/);
});

test("subscriber invitation tokens are hashed before persistence", () => {
  const source = readFileSync("src/lib/organization-control-plane.ts", "utf8");
  assert.match(source, /createHash\("sha256"\)/);
  assert.match(source, /tokenHash: invitationHash\(invitationToken\)/);
  assert.match(source, /tokenHash: invitationHash\(token\)/);
  assert.doesNotMatch(source, /token:\s*invitationToken/);
});

test("subscriber user directories and mutations enforce organization boundaries", () => {
  const inspectionUsers = readFileSync("src/app/users/page.tsx", "utf8");
  const inspectionActions = readFileSync("src/app/users/actions.ts", "utf8");
  const trainingUsers = readFileSync("src/app/driver-training/users/page.tsx", "utf8");
  const trainingActions = readFileSync("src/app/driver-training/users/actions.ts", "utf8");

  assert.match(inspectionUsers, /eq\(users\.organizationId, user\.organizationId\)/);
  assert.match(trainingUsers, /eq\(users\.organizationId, user\.organizationId\)/);
  assert.match(inspectionActions, /target\.organizationId !== actor\.organizationId/);
  assert.match(trainingActions, /organizationId: actor\.organizationId/);
  assert.match(trainingActions, /subscription user limit/);
});

test("organization settings and branding are scoped by organization identity", () => {
  const settings = readFileSync("src/lib/settings.ts", "utf8");
  const layout = readFileSync("src/app/layout.tsx", "utf8");
  const settingsAction = readFileSync("src/app/settings/server.ts", "utf8");

  assert.match(settings, /systemSettings\.organizationId/);
  assert.match(settings, /getSettings\(organizationId/);
  assert.match(layout, /getSettings\(shellUser\?\.organizationId\)/);
  assert.match(settingsAction, /getSettings\(user\.organizationId\)/);
  assert.match(settingsAction, /updateSettings\(parsed\.data, user\.id, user\.organizationId\)/);
});

test("Organization Owner is distinct from operational administrator roles", () => {
  const auth = readFileSync("src/lib/auth.ts", "utf8");
  const access = readFileSync("src/lib/system-access.ts", "utf8");
  const shell = readFileSync("src/components/AppShell.tsx", "utf8");

  assert.match(auth, /organization_owner: "Organization Owner"/);
  assert.match(auth, /organization_owner: \{\}/);
  assert.match(access, /user\.role === "organization_owner"/);
  assert.match(shell, /Organization Account/);
  assert.match(shell, /Subscriber Companies/);
});

test("operational routes enforce subscription readiness centrally", () => {
  const source = readFileSync("src/lib/require-auth.ts", "utf8");
  assert.match(source, /getOrganizationSubscriptionState/);
  assert.match(source, /requireWorkspaceUser/);
  assert.match(source, /redirect\("\/workspace-setup"\)/);
  assert.match(source, /organization_owner.*organization\/account/s);
});

test("public invitation and subscription routes render without the authenticated app shell", () => {
  const source = readFileSync("src/components/AppShell.tsx", "utf8");
  assert.match(source, /"\/subscribe"/);
  assert.match(source, /pathname\.startsWith\("\/invite\/"\)/);
});
