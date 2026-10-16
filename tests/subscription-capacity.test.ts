import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(path: string) {
  return readFileSync(path, "utf8");
}

test("capacity policy measures active plan usage per organization", () => {
  const policy = source("src/lib/subscription-capacity.ts");
  assert.match(policy, /eq\(users\.organizationId, organizationId\)/);
  assert.match(policy, /eq\(locations\.organizationId, organizationId\)/);
  assert.match(policy, /eq\(vehicles\.organizationId, organizationId\)/);
  assert.match(policy, /eq\(inspections\.organizationId, organizationId\)/);
  assert.match(policy, /ne\(locations\.status, "inactive"\)/);
  assert.match(policy, /ne\(vehicles\.status, "decommissioned"\)/);
  assert.match(policy, /maxInspectionsPerMonth/);
  assert.match(policy, /Subscription limit reached/);
});

test("vehicle station and inspection creation run friendly capacity preflight checks", () => {
  const vehicles = source("src/app/vehicles/server.ts");
  const stations = source("src/app/locations/actions.ts");
  const inspections = source("src/app/inspections/server.ts");

  assert.match(vehicles, /assertSubscriptionCapacityAvailable\(user\.organizationId, "vehicles"\)/);
  assert.match(stations, /assertSubscriptionCapacityAvailable\(user\.organizationId, "stations"\)/);
  assert.match(inspections, /assertSubscriptionCapacityAvailable\(user\.organizationId, "monthly_inspections", inspectedAt\)/);
  assert.match(vehicles, /extractSubscriptionCapacityError/);
  assert.match(stations, /extractSubscriptionCapacityError/);
  assert.match(inspections, /extractSubscriptionCapacityError/);
});

test("database capacity guards protect all billable resources under concurrency", () => {
  const migration = source("migrations/20261016_subscription_capacity_guards.sql");
  for (const resource of ["users", "stations", "vehicles", "monthly_inspections"]) {
    assert.match(migration, new RegExp(`'${resource}'`));
  }
  assert.match(migration, /hashtextextended\(NEW\.organization_id::text \|\| ':' \|\| resource, 0\)/);
  assert.match(migration, /ORDER BY os\.created_at DESC/);
  assert.match(migration, /latest_status NOT IN \('trialing', 'active', 'grace'\)/);
});

test("organization account displays real usage against plan limits", () => {
  const page = source("src/app/organization/account/page.tsx");
  assert.match(page, /getOrganizationCapacitySnapshot\(user\.organizationId\)/);
  assert.match(page, /capacity\.usage\.users/);
  assert.match(page, /capacity\.usage\.stations/);
  assert.match(page, /capacity\.usage\.vehicles/);
  assert.match(page, /capacity\.usage\.monthlyInspections/);
  assert.match(page, /Capacity overview/);
});

test("database verifier requires all capacity guard triggers", () => {
  const verifier = source("scripts/verify-enterprise-upgrade.mjs");
  assert.match(verifier, /requiredSubscriptionCapacityTriggers/);
  assert.match(verifier, /users_subscription_capacity_guard/);
  assert.match(verifier, /locations_subscription_capacity_guard/);
  assert.match(verifier, /vehicles_subscription_capacity_guard/);
  assert.match(verifier, /inspections_subscription_capacity_guard/);
  assert.match(verifier, /missingCapacityTriggers/);
});
