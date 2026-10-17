import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = (path: string) => readFileSync(path, "utf8");

function listedTables(input: string) {
  const match = input.match(/FOREACH table_name IN ARRAY ARRAY\[([\s\S]*?)\]/);
  assert.ok(match, "Expected migration tenant-table manifest");
  return [...match[1].matchAll(/'([a-z_]+)'/g)].map((entry) => entry[1]);
}

test("tenant isolation cutover applies to every required production table", () => {
  const control = src("src/lib/organization-control-plane.ts");
  const match = control.match(/const TENANT_DATA_PLANE_TABLES = \[([\s\S]*?)\] as const;/);
  assert.ok(match);
  const expected = [...match[1].matchAll(/"([a-z_]+)"/g)].map((entry) => entry[1]);
  const actual = listedTables(src("migrations/20261016_tenant_data_plane_fail_closed.sql"));
  assert.equal(expected.length, 49);
  assert.deepEqual([...expected].sort(), [...actual].sort());
  assert.match(src("migrations/20261016_tenant_data_plane_fail_closed.sql"), /ALTER COLUMN organization_id DROP DEFAULT/);
});

test("legacy core and training migrations cannot reintroduce a tenant default", () => {
  for (const file of [
    "migrations/20261016_tenant_data_plane_core.sql",
    "migrations/20261016_tenant_data_plane_training.sql",
  ]) {
    const sql = src(file);
    assert.doesNotMatch(sql, /ALTER COLUMN organization_id SET DEFAULT/);
    assert.doesNotMatch(sql, /ADD COLUMN IF NOT EXISTS organization_id varchar\(36\) DEFAULT/);
    assert.match(sql, /ALTER COLUMN organization_id DROP DEFAULT/);
    assert.match(sql, /ALTER COLUMN organization_id SET NOT NULL/);
    assert.match(sql, /WHERE organization_id IS NULL/);
  }
});

test("future subscriber onboarding is fail-closed on tenant schema drift", () => {
  const control = src("src/lib/organization-control-plane.ts");
  const begin = control.indexOf("export async function convertOnboardingRequest");
  const end = control.indexOf("export async function createOrganizationAdministratorInvitation", begin);
  const approval = control.slice(begin, end);
  assert.ok(approval.indexOf("verifyTenantDataPlaneReadiness()") < approval.indexOf("tx.insert(organizations)"));
  assert.match(approval, /if \(!isolation.ready\)/);
  assert.match(approval, /Subscriber onboarding is paused until tenant isolation is verified/);
});

test("activation is blocked before submission when global database guards fail", () => {
  const control = src("src/lib/organization-control-plane.ts");
  const controls = src("src/app/platform/organizations/[id]/ActivationReadinessControls.tsx");
  const begin = control.indexOf("export async function getOrganizationActivationReadiness");
  const end = control.indexOf("export async function reissueOrganizationOwnerInvitation", begin);
  const section = control.slice(begin, end);
  assert.match(section, /verifyTenantDataPlaneReadiness\(\)/);
  assert.match(section, /&& isolation.ready/);
  assert.match(section, /\s+isolation,/);
  assert.match(controls, /Database tenant isolation/);
  assert.match(controls, /!readiness.canAttemptActivation/);
  assert.match(controls, /Database isolation will be checked again on submission/);
  assert.match(control, /const isolation = await verifyTenantDataPlaneReadiness\(\)/);
});

test("upgrade is not reported successful until fail-closed schema is independently verified", () => {
  const runner = src("scripts/apply-enterprise-upgrade.mjs");
  assert.match(runner, /tenant_data_plane_fail_closed\.sql/);
  assert.match(runner, /column_default IS NULL/);
  assert.match(runner, /is_nullable = 'NO'/);
  assert.match(runner, /Tenant isolation cutover incomplete/);
});
