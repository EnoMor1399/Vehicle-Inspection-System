import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const runner = readFileSync("scripts/apply-enterprise-upgrade.mjs", "utf8");
const migration = readFileSync("migrations/20260902_security_query_indexes.sql", "utf8");
const schedulingMigration = readFileSync("migrations/20261015_inspection_scheduling.sql", "utf8");
const administrationRoleMigration = readFileSync("migrations/20261016_admin_domain_roles.sql", "utf8");
const administrationAssignmentMigration = readFileSync("migrations/20261016_admin_domain_assignment.sql", "utf8");
const organizationOwnerRoleMigration = readFileSync("migrations/20261016_organization_owner_role.sql", "utf8");
const multiOrganizationMigration = readFileSync("migrations/20261016_multi_organization_subscriptions.sql", "utf8");

test("enterprise migration runner includes the security access-path migration", () => {
  assert.match(runner, /migrations\/20260902_security_query_indexes\.sql/);
});

test("security access-path migration is idempotent and targets high-frequency queries", () => {
  assert.match(migration, /CREATE INDEX IF NOT EXISTS login_attempt_email_failed_created_idx/);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS login_attempt_ip_failed_created_idx/);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS session_user_active_activity_idx/);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS audit_entity_created_idx/);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS notification_user_unread_created_idx/);
  assert.match(migration, /DROP INDEX IF EXISTS session_token_idx/);
  assert.match(migration, /DROP INDEX IF EXISTS api_key_hash_idx/);
});


test("enterprise migration runner includes inspection scheduling", () => {
  assert.match(runner, /migrations\/20261015_inspection_scheduling\.sql/);
});

test("inspection scheduling migration is idempotent and indexed for operational queues", () => {
  assert.match(schedulingMigration, /CREATE TABLE IF NOT EXISTS inspection_appointments/);
  assert.match(schedulingMigration, /CREATE INDEX IF NOT EXISTS inspection_appointment_location_scheduled_idx/);
  assert.match(schedulingMigration, /CREATE INDEX IF NOT EXISTS inspection_appointment_status_scheduled_idx/);
  assert.match(schedulingMigration, /linked_inspection_id varchar\(36\).*REFERENCES inspections\(id\)/);
});


test("enterprise migration runner includes administration-domain separation", () => {
  assert.match(runner, /migrations\/20261016_admin_domain_roles\.sql/);
  assert.match(runner, /migrations\/20261016_admin_domain_assignment\.sql/);
});

test("administration-domain migrations create explicit roles and database isolation guards", () => {
  assert.match(administrationRoleMigration, /vehicle_inspection_admin/);
  assert.match(administrationRoleMigration, /driver_training_admin/);
  assert.match(administrationAssignmentMigration, /role = 'driver_training_admin'/);
  assert.match(administrationAssignmentMigration, /role = 'vehicle_inspection_admin'/);
  assert.match(administrationAssignmentMigration, /users_single_operational_domain_chk/);
  assert.match(administrationAssignmentMigration, /users_role_domain_chk/);
  assert.match(administrationAssignmentMigration, /UPDATE sessions/);
  assert.match(administrationAssignmentMigration, /permissions = COALESCE\(permissions, '\{\}'::jsonb\) - '\*'/);
  assert.match(administrationAssignmentMigration, /vehicle_inspection_admin[\s\S]*driver_training_admin/);
  assert.match(administrationAssignmentMigration, /RAISE EXCEPTION/);
});


test("enterprise migration runner commits organization-owner role before multi-organization subscriptions", () => {
  const rolePosition = runner.indexOf("migrations/20261016_organization_owner_role.sql");
  const controlPlanePosition = runner.indexOf("migrations/20261016_multi_organization_subscriptions.sql");
  assert.ok(rolePosition >= 0);
  assert.ok(controlPlanePosition > rolePosition);
  assert.match(organizationOwnerRoleMigration, /organization_owner/);
});

test("multi-organization migration preserves RSL and provisions a fail-closed subscriber control plane", () => {
  assert.match(multiOrganizationMigration, /CREATE TABLE IF NOT EXISTS organizations/);
  assert.match(multiOrganizationMigration, /CREATE TABLE IF NOT EXISTS subscription_plans/);
  assert.match(multiOrganizationMigration, /CREATE TABLE IF NOT EXISTS organization_subscriptions/);
  assert.match(multiOrganizationMigration, /CREATE TABLE IF NOT EXISTS organization_invitations/);
  assert.match(multiOrganizationMigration, /CREATE TABLE IF NOT EXISTS organization_onboarding_requests/);
  assert.match(multiOrganizationMigration, /Road Safety Limited/);
  assert.match(multiOrganizationMigration, /operational_access_enabled/);
  assert.match(multiOrganizationMigration, /data_isolation_verified_at/);
  assert.match(multiOrganizationMigration, /ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id/);
  assert.match(multiOrganizationMigration, /ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS organization_id/);
  assert.match(multiOrganizationMigration, /organization_owner/);
  assert.match(multiOrganizationMigration, /users_single_operational_domain_chk/);
});
