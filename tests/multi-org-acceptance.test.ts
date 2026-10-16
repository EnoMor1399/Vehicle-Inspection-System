import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const seed = readFileSync("scripts/seed-e2e.mjs", "utf8");
const browser = readFileSync("tests/e2e/critical-workflows.spec.ts", "utf8");
const workflow = readFileSync(".github/workflows/e2e.yml", "utf8");

test("E2E seed provisions a second operational subscriber with isolated records", () => {
  assert.match(seed, /E2E Tenant Safety Ltd/);
  assert.match(seed, /tenantOrganizationId/);
  assert.match(seed, /TENANT-2026/);
  assert.match(seed, /TENANT-INSP-001/);
  assert.match(seed, /TENANT-TRAIN-001/);
  assert.match(seed, /operational_access_enabled/);
  assert.match(seed, /data_isolation_verified_at/);
  assert.match(seed, /00000000-0000-4000-8000-000000000202/);
});

test("E2E seed actively probes database cross-organization guards", () => {
  assert.match(seed, /expectTenantBoundaryRejection/);
  assert.match(seed, /TENANT-CROSS-VEH/);
  assert.match(seed, /RSL transporter/);
  assert.match(seed, /RSL training session/);
  assert.match(seed, /Cross-organization\|tenant/);
});

test("browser acceptance verifies bidirectional core and training isolation", () => {
  assert.match(browser, /separate subscriber organizations cannot see each other's operational records/);
  assert.match(browser, /TENANT-2026/);
  assert.match(browser, /TENANT-INSP-001/);
  assert.match(browser, /TENANT-TRAIN-001/);
  assert.match(browser, /tenantVehicleResponse/);
  assert.match(browser, /rslVehicleResponse/);
  assert.match(browser, /toHaveCount\(0\)/);
});

test("workflow supplies credentials for both subscriber organizations", () => {
  assert.match(workflow, /E2E_TENANT_USER_EMAIL/);
  assert.match(workflow, /E2E_TENANT_USER_PASSWORD/);
  assert.match(workflow, /E2E_TENANT_TRAINING_USER_EMAIL/);
  assert.match(workflow, /E2E_TENANT_TRAINING_USER_PASSWORD/);
});
