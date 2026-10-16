import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("operational route guards enforce subscription module entitlements", () => {
  const source = readFileSync("src/lib/require-auth.ts", "utf8");

  assert.match(source, /requireOrganizationModuleForUser/);
  assert.match(source, /hasOrganizationModule/);
  assert.match(source, /"vehicle_inspection"/);
  assert.match(source, /"driver_training"/);
  assert.match(source, /resource === "reports"/);
  assert.match(source, /subscription-access\?module=/);
});

test("navigation only exposes modules included in the organization plan", () => {
  const layout = readFileSync("src/app/layout.tsx", "utf8");
  const shell = readFileSync("src/components/AppShell.tsx", "utf8");

  assert.match(layout, /getOrganizationSubscriptionState/);
  assert.match(layout, /hasOrganizationModule\(organizationState, "vehicle_inspection"\)/);
  assert.match(layout, /hasOrganizationModule\(organizationState, "driver_training"\)/);
  assert.match(layout, /hasOrganizationModule\(organizationState, "reports"\)/);
  assert.match(layout, /hasPermission\(user, "settings"\) && hasOrganizationModule\(organizationState, "api"\)/);
  assert.match(shell, /resource: "api_module"/);
});

test("integration API rejects organizations without API entitlement", () => {
  const source = readFileSync("src/lib/api-auth.ts", "utf8");

  assert.match(source, /apiSubscriptionAllowed/);
  assert.match(source, /state\.operationalAccess/);
  assert.match(source, /hasOrganizationModule\(state, "api"\)/);
  assert.match(source, /subscription does not include API & Integrations/);
});

test("API key management requires the API module", () => {
  const page = readFileSync("src/app/api-docs/page.tsx", "utf8");
  const server = readFileSync("src/app/api-docs/server.ts", "utf8");

  assert.match(page, /requireOrganizationModule\("api"\)/);
  assert.match(server, /requireOrganizationModule\("api"\)/);
  assert.match(server, /organizationId: user\.organizationId/);
});

test("subscription lifecycle blocks unsafe plan downgrades", () => {
  const source = readFileSync("src/lib/organization-control-plane.ts", "utf8");

  assert.match(source, /getOrganizationPlanUsage/);
  assert.match(source, /usage\.users > targetPlan\.maxUsers/);
  assert.match(source, /usage\.stations > targetPlan\.maxStations/);
  assert.match(source, /usage\.vehicles > targetPlan\.maxVehicles/);
  assert.match(source, /usage\.monthlyInspections > targetPlan\.maxInspectionsPerMonth/);
  assert.match(source, /Plan change blocked:/);
  assert.match(source, /Reduce usage or choose a larger plan/);
});

test("plan and status changes update entitlements and revoke active sessions", () => {
  const source = readFileSync("src/lib/organization-control-plane.ts", "utf8");

  assert.match(source, /enabledModules: targetPlan\.modules/);
  assert.match(source, /planChanged \|\| statusChanged/);
  assert.match(source, /update\(sessions\)/);
  assert.match(source, /isActive: false/);
});

test("platform subscription management exposes plan, status and billing lifecycle controls", () => {
  const actions = readFileSync("src/app/platform/organizations/actions.ts", "utf8");
  const detail = readFileSync("src/app/platform/organizations/[id]/page.tsx", "utf8");
  const form = readFileSync("src/app/platform/organizations/[id]/SubscriptionLifecycleForm.tsx", "utf8");
  const registry = readFileSync("src/app/platform/organizations/page.tsx", "utf8");

  assert.match(actions, /updateSubscriberSubscription/);
  assert.match(actions, /trialing[\s\S]*active[\s\S]*past_due[\s\S]*grace[\s\S]*suspended[\s\S]*cancelled[\s\S]*expired/);
  assert.match(detail, /Subscription lifecycle/);
  assert.match(detail, /Downgrade protection/);
  assert.match(form, /cancelAtPeriodEnd/);
  assert.match(form, /Current period end/);
  assert.match(form, /Grace period ends/);
  assert.match(registry, /platform\/organizations\/\$\{organization\.id\}/);
});

test("subscription access page explains unavailable modules without exposing operational data", () => {
  const source = readFileSync("src/app/subscription-access/page.tsx", "utf8");

  assert.match(source, /Subscription Access/);
  assert.match(source, /Having a user role does not override the organization plan/);
  assert.match(source, /Included modules/);
  assert.doesNotMatch(source, /from\(vehicles\)|from\(inspections\)|from\(trainingSessions\)/);
});
