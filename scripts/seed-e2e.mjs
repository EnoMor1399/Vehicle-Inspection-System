import "dotenv/config";
import crypto from "node:crypto";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import pg from "pg";
import { generateSecret } from "otplib";

const databaseUrl = process.env.DATABASE_URL || "";
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const expectedDatabase = process.env.EXPECTED_DATABASE_NAME || "Vehicle-Inspection-Enterprise";
const email = (process.env.E2E_USER_EMAIL || "e2e.inspector@vims.local").toLowerCase();
const trainingEmail = (process.env.E2E_TRAINING_USER_EMAIL || "e2e.training.admin@vims.local").toLowerCase();
const superAdminEmail = (process.env.E2E_SUPER_ADMIN_EMAIL || "e2e.platform.admin@vims.local").toLowerCase();
const tenantInspectionEmail = (process.env.E2E_TENANT_USER_EMAIL || "e2e.tenant.inspector@vims.local").toLowerCase();
const tenantTrainingEmail = (process.env.E2E_TENANT_TRAINING_USER_EMAIL || "e2e.tenant.training.admin@vims.local").toLowerCase();
const password = process.env.E2E_USER_PASSWORD || "E2eOnly!Passw0rd2026";
const trainingPassword = process.env.E2E_TRAINING_USER_PASSWORD || password;
const tenantPassword = process.env.E2E_TENANT_USER_PASSWORD || password;
const tenantTrainingPassword = process.env.E2E_TENANT_TRAINING_USER_PASSWORD || tenantPassword;

const url = new URL(databaseUrl);
const client = new pg.Client({ connectionString: url.toString() });
await client.connect();

try {
  const target = await client.query("select current_database() as name");
  if (target.rows[0]?.name !== expectedDatabase) {
    throw new Error(`Refusing E2E seed against ${target.rows[0]?.name || "unknown"}; expected ${expectedDatabase}`);
  }

  const organizationId = "00000000-0000-4000-8000-000000000101";
  const userId = "e2e0000-0000-4000-8000-000000000001";
  const trainingUserId = "e2e0000-0000-4000-8000-000000000008";
  const superAdminUserId = "e2e90000-0000-4000-8000-000000000001";
  const vehicleAdminUserId = "e2e20000-0000-4000-8000-000000000001";
  const vehicleAdminSessionId = "e2e20000-0000-4000-8000-000000000002";
  const locationId = "e2e0000-0000-4000-8000-000000000002";
  const transporterId = "e2e0000-0000-4000-8000-000000000003";
  const vehicleId = "e2e0000-0000-4000-8000-000000000004";
  const inspectionId = "e2e0000-0000-4000-8000-000000000005";
  const sessionId = "e2e0000-0000-4000-8000-000000000006";
  const participantId = "e2e0000-0000-4000-8000-000000000007";

  const tenantOrganizationId = "e2e10000-0000-4000-8000-000000000001";
  const tenantSubscriptionId = "e2e10000-0000-4000-8000-000000000002";
  const tenantInspectionUserId = "e2e10000-0000-4000-8000-000000000003";
  const tenantTrainingUserId = "e2e10000-0000-4000-8000-000000000004";
  const tenantLocationId = "e2e10000-0000-4000-8000-000000000005";
  const tenantTransporterId = "e2e10000-0000-4000-8000-000000000006";
  const tenantVehicleId = "e2e10000-0000-4000-8000-000000000007";
  const tenantInspectionId = "e2e10000-0000-4000-8000-000000000008";
  const tenantSessionId = "e2e10000-0000-4000-8000-000000000009";
  const tenantParticipantId = "e2e10000-0000-4000-8000-000000000010";

  const passwordHash = await bcrypt.hash(password, 10);
  const trainingPasswordHash = await bcrypt.hash(trainingPassword, 10);
  const tenantPasswordHash = await bcrypt.hash(tenantPassword, 10);
  const tenantTrainingPasswordHash = await bcrypt.hash(tenantTrainingPassword, 10);

  await client.query("begin");

  // A second fully operational subscriber is seeded so browser tests prove
  // tenant isolation rather than testing RSL in isolation.
  await client.query(
    `insert into organizations
      (id, name, slug, legal_name, country, email, enabled_modules, status, onboarding_stage,
       operational_access_enabled, data_isolation_verified_at)
     values
      ($1, 'E2E Tenant Safety Ltd', 'e2e-tenant-safety', 'E2E Tenant Safety Ltd', 'Ghana',
       'tenant@example.test', '["vehicle_inspection","driver_training","reports"]'::jsonb,
       'active', 'complete', true, now())
     on conflict (id) do update set
       name = excluded.name,
       slug = excluded.slug,
       enabled_modules = excluded.enabled_modules,
       status = 'active',
       onboarding_stage = 'complete',
       operational_access_enabled = true,
       data_isolation_verified_at = now(),
       updated_at = now()`,
    [tenantOrganizationId],
  );
  await client.query(
    `insert into system_settings
      (id, organization_id, company_name, company_short_name, tagline, country, email, footer_text)
     values
      ($1, $1, 'E2E Tenant Safety Ltd', 'E2E Tenant', 'Vehicle Inspection Management System',
       'Ghana', 'tenant@example.test', 'E2E Tenant Safety Ltd')
     on conflict (organization_id) do update set
       company_name = excluded.company_name,
       company_short_name = excluded.company_short_name,
       tagline = excluded.tagline,
       country = excluded.country,
       email = excluded.email,
       footer_text = excluded.footer_text,
       updated_at = now()`,
    [tenantOrganizationId],
  );
  await client.query(
    `insert into organization_subscriptions
      (id, organization_id, plan_id, status, provider, amount, currency, current_period_start, seats, notes)
     values
      ($1, $2, '00000000-0000-4000-8000-000000000202', 'active', 'manual', 0, 'GHS', now(), 10,
       'E2E second-organization isolation fixture')
     on conflict (id) do update set
       plan_id = excluded.plan_id,
       status = 'active',
       seats = excluded.seats,
       updated_at = now()`,
    [tenantSubscriptionId, tenantOrganizationId],
  );

  await client.query(
    `insert into locations (id, organization_id, name, code, region, status)
     values ($1, $2, 'E2E Test Station', 'E2E', 'Test Region', 'active')
     on conflict (id) do update set
       organization_id = excluded.organization_id,
       name = excluded.name,
       code = excluded.code,
       status = excluded.status`,
    [locationId, organizationId],
  );
  await client.query(
    `insert into transporters (id, organization_id, company_name, registration_number, status)
     values ($1, $2, 'E2E Transport Ltd', 'E2E-REG', 'active')
     on conflict (id) do update set
       organization_id = excluded.organization_id,
       company_name = excluded.company_name,
       status = excluded.status`,
    [transporterId, organizationId],
  );
  const testAuthenticatorSeed = generateSecret();
  writeFileSync(join(tmpdir(), "vims-e2e-authenticator-seed"), testAuthenticatorSeed, { mode: 0o600 });
  if (process.env.GITHUB_ENV) {
    const { appendFileSync } = await import("node:fs");
    appendFileSync(process.env.GITHUB_ENV, `E2E_PLATFORM_TOTP_SEED=${testAuthenticatorSeed}\n`);
  }
  // E2E-only identity used to exercise the SAME protected Super Admin sidebar
  // and read-only organization URLs that users open in production. This seed
  // runs exclusively against the isolated CI PostgreSQL service.
  await client.query(
    `insert into users
      (id, organization_id, name, email, role, password_hash, permissions, is_active, failed_login_attempts, two_factor_enabled, two_factor_secret)
     values ($1, $2, 'E2E Platform Administrator', $3, 'super_admin', $4, '{}'::jsonb, true, 0, true, $5)
     on conflict (email) do update set
       organization_id = excluded.organization_id,
       name = excluded.name,
       role = excluded.role,
       password_hash = excluded.password_hash,
       permissions = excluded.permissions,
       is_active = true,
       failed_login_attempts = 0,
       locked_until = null,
       two_factor_enabled = true,
       two_factor_secret = excluded.two_factor_secret`,
    [superAdminUserId, organizationId, superAdminEmail, passwordHash, testAuthenticatorSeed],
  );

  // Secure, short-lived browser fixture only. Never use this identity or
  // cookie outside the throwaway PostgreSQL CI service.
  const adminCookieToken = crypto.randomBytes(64).toString("hex");
  const adminCookieHash = crypto.createHash("sha256").update(adminCookieToken).digest("hex");
  await client.query(
    `insert into sessions
      (id, user_id, token, ip_address, is_active, expires_at, last_activity_at)
     values ('e2e90000-0000-4000-8000-000000000002', $1, $2, '127.0.0.1', true,
             now() + interval '30 minutes', now())
     on conflict (id) do update set
       user_id = excluded.user_id, token = excluded.token, is_active = true,
       expires_at = excluded.expires_at, last_activity_at = excluded.last_activity_at`,
    [superAdminUserId, adminCookieHash],
  );
  const adminCookieFile = join(tmpdir(), "vims-e2e-super-admin-session");
  writeFileSync(adminCookieFile, adminCookieToken, { mode: 0o600 });

  // Dedicated Vehicle Inspection Administrator fixture proves portal access
  // never depends on being the platform Super Admin. The tenant and credentials
  // exist ONLY inside the isolated PostgreSQL test service.
  await client.query(
    `insert into users
      (id, organization_id, name, email, role, password_hash, permissions,
       is_active, failed_login_attempts, two_factor_enabled, two_factor_secret)
     values ($1, $2, 'Tenant Vehicle Inspection Administrator',
             'e2e.vehicle.admin@vims.local', 'vehicle_inspection_admin',
             $3, '{"vehicle_inspection":true,"transporters":true}'::jsonb,
             true, 0, true, $4)
     on conflict (email) do update set
       organization_id = excluded.organization_id,
       role = excluded.role,
       permissions = excluded.permissions,
       is_active = true, failed_login_attempts = 0,
       locked_until = null, two_factor_enabled = true,
       two_factor_secret = excluded.two_factor_secret`,
    [vehicleAdminUserId, tenantOrganizationId, passwordHash, testAuthenticatorSeed],
  );
  const vehicleAdminToken = crypto.randomBytes(64).toString("hex");
  const vehicleAdminHash = crypto.createHash("sha256").update(vehicleAdminToken).digest("hex");
  await client.query(
    `insert into sessions
      (id, user_id, token, ip_address, is_active, expires_at, last_activity_at)
     values ($1, $2, $3, '127.0.0.1', true, now() + interval '30 minutes', now())
     on conflict (id) do update set
       user_id = excluded.user_id, token = excluded.token,
       is_active = true, expires_at = excluded.expires_at,
       last_activity_at = excluded.last_activity_at`,
    [vehicleAdminSessionId, vehicleAdminUserId, vehicleAdminHash],
  );
  writeFileSync(join(tmpdir(), "vims-e2e-vehicle-admin-session"), vehicleAdminToken, { mode: 0o600 });

  await client.query(
    `insert into users
      (id, organization_id, name, email, role, password_hash, permissions, is_active, location_id, failed_login_attempts, two_factor_enabled)
     values ($1, $6, 'E2E Inspector', $2, 'inspector', $3, $4::jsonb, true, $5, 0, false)
     on conflict (email) do update set
       organization_id = excluded.organization_id,
       name = excluded.name,
       role = excluded.role,
       password_hash = excluded.password_hash,
       permissions = excluded.permissions,
       is_active = true,
       location_id = excluded.location_id,
       failed_login_attempts = 0,
       locked_until = null,
       two_factor_enabled = false,
       two_factor_secret = null`,
    [
      userId,
      email,
      passwordHash,
      JSON.stringify({
        vehicle_inspection: true,
        training: false,
        vehicles: true,
        inspections: true,
        documents: true,
        reports: true,
      }),
      locationId,
      organizationId,
    ],
  );
  await client.query(
    `insert into users
      (id, organization_id, name, email, role, password_hash, permissions, is_active, location_id, failed_login_attempts, two_factor_enabled)
     values ($1, $5, 'E2E Training Administrator', $2, 'driver_training_admin', $3, $4::jsonb, true, null, 0, false)
     on conflict (email) do update set
       organization_id = excluded.organization_id,
       name = excluded.name,
       role = excluded.role,
       password_hash = excluded.password_hash,
       permissions = excluded.permissions,
       is_active = true,
       location_id = null,
       transporter_id = null,
       failed_login_attempts = 0,
       locked_until = null,
       two_factor_enabled = false,
       two_factor_secret = null`,
    [
      trainingUserId,
      trainingEmail,
      trainingPasswordHash,
      JSON.stringify({
        vehicle_inspection: false,
        training: true,
        training_manage: true,
        training_user_admin: true,
        training_assessment_review: true,
        training_commercials_manage: true,
        training_certificates_manage: true,
        training_compliance_manage: true,
        training_governance_manage: true,
      }),
      organizationId,
    ],
  );
  await client.query(
    `insert into vehicles (id, organization_id, transporter_id, registration_number, make, model, status)
     values ($1, $3, $2, 'E2E-2026', 'TestMake', 'TestModel', 'active')
     on conflict (organization_id, registration_number) do update set
       transporter_id = excluded.transporter_id,
       make = excluded.make,
       model = excluded.model`,
    [vehicleId, transporterId, organizationId],
  );
  await client.query(
    `insert into inspections
      (id, organization_id, inspection_number, vehicle_id, location_id, inspector_id, inspector_name, station, workflow_status, overall_result, status)
     values ($1, $5, 'E2E-INSP-001', $2, $3, $4, 'E2E Inspector', 'E2E Test Station', 'completed', 'pass', 'completed')
     on conflict (organization_id, inspection_number) do update set
       vehicle_id = excluded.vehicle_id,
       location_id = excluded.location_id`,
    [inspectionId, vehicleId, locationId, userId, organizationId],
  );
  await client.query(
    `insert into training_sessions
      (id, organization_id, reference_number, service_id, title, client_name, location_id, venue, start_at, end_at, status, created_by)
     values ($1, $4, 'E2E-TRAIN-001', 'defensive-driving', 'E2E Defensive Driving', 'E2E Transport Ltd', $2, 'E2E Test Station', now(), now() + interval '1 day', 'scheduled', $3)
     on conflict (organization_id, reference_number) do update set
       title = excluded.title,
       status = excluded.status`,
    [sessionId, locationId, trainingUserId, organizationId],
  );
  await client.query(
    `insert into training_participants
      (id, organization_id, session_id, full_name, company_name, employee_number, attendance_status, assessment_status, certificate_eligible, created_by)
     values ($1, $4, $2, 'E2E Driver', 'E2E Transport Ltd', 'E2E-EMP-001', 'attended', 'pending', false, $3)
     on conflict (id) do update set
       organization_id = excluded.organization_id,
       full_name = excluded.full_name,
       attendance_status = excluded.attendance_status`,
    [participantId, sessionId, trainingUserId, organizationId],
  );

  await client.query(
    `insert into locations (id, organization_id, name, code, region, status)
     values ($1, $2, 'Tenant Test Station', 'E2E', 'Tenant Region', 'active')
     on conflict (id) do update set
       organization_id = excluded.organization_id,
       name = excluded.name,
       code = excluded.code,
       region = excluded.region,
       status = excluded.status`,
    [tenantLocationId, tenantOrganizationId],
  );
  await client.query(
    `insert into transporters (id, organization_id, company_name, registration_number, status)
     values ($1, $2, 'Tenant Transport Ltd', 'TENANT-REG', 'active')
     on conflict (id) do update set
       organization_id = excluded.organization_id,
       company_name = excluded.company_name,
       registration_number = excluded.registration_number,
       status = excluded.status`,
    [tenantTransporterId, tenantOrganizationId],
  );
  await client.query(
    `insert into users
      (id, organization_id, name, email, role, password_hash, permissions, is_active, location_id, failed_login_attempts, two_factor_enabled)
     values ($1, $6, 'Tenant E2E Inspector', $2, 'inspector', $3, $4::jsonb, true, $5, 0, false)
     on conflict (email) do update set
       organization_id = excluded.organization_id,
       name = excluded.name,
       role = excluded.role,
       password_hash = excluded.password_hash,
       permissions = excluded.permissions,
       is_active = true,
       location_id = excluded.location_id,
       transporter_id = null,
       failed_login_attempts = 0,
       locked_until = null,
       two_factor_enabled = false,
       two_factor_secret = null`,
    [
      tenantInspectionUserId,
      tenantInspectionEmail,
      tenantPasswordHash,
      JSON.stringify({
        vehicle_inspection: true,
        training: false,
        vehicles: true,
        inspections: true,
        documents: true,
        reports: true,
      }),
      tenantLocationId,
      tenantOrganizationId,
    ],
  );
  await client.query(
    `insert into users
      (id, organization_id, name, email, role, password_hash, permissions, is_active, location_id, failed_login_attempts, two_factor_enabled)
     values ($1, $5, 'Tenant E2E Training Administrator', $2, 'driver_training_admin', $3, $4::jsonb, true, null, 0, false)
     on conflict (email) do update set
       organization_id = excluded.organization_id,
       name = excluded.name,
       role = excluded.role,
       password_hash = excluded.password_hash,
       permissions = excluded.permissions,
       is_active = true,
       location_id = null,
       transporter_id = null,
       failed_login_attempts = 0,
       locked_until = null,
       two_factor_enabled = false,
       two_factor_secret = null`,
    [
      tenantTrainingUserId,
      tenantTrainingEmail,
      tenantTrainingPasswordHash,
      JSON.stringify({
        vehicle_inspection: false,
        training: true,
        training_manage: true,
        training_user_admin: true,
        training_assessment_review: true,
        training_commercials_manage: true,
        training_certificates_manage: true,
        training_compliance_manage: true,
        training_governance_manage: true,
      }),
      tenantOrganizationId,
    ],
  );
  await client.query(
    `insert into vehicles (id, organization_id, transporter_id, registration_number, make, model, status)
     values ($1, $3, $2, 'TENANT-2026', 'TenantMake', 'TenantModel', 'active')
     on conflict (organization_id, registration_number) do update set
       transporter_id = excluded.transporter_id,
       make = excluded.make,
       model = excluded.model,
       status = excluded.status`,
    [tenantVehicleId, tenantTransporterId, tenantOrganizationId],
  );
  await client.query(
    `insert into inspections
      (id, organization_id, inspection_number, vehicle_id, location_id, inspector_id, inspector_name, station, workflow_status, overall_result, status)
     values ($1, $5, 'TENANT-INSP-001', $2, $3, $4, 'Tenant E2E Inspector', 'Tenant Test Station', 'completed', 'pass', 'completed')
     on conflict (organization_id, inspection_number) do update set
       vehicle_id = excluded.vehicle_id,
       location_id = excluded.location_id,
       inspector_id = excluded.inspector_id`,
    [tenantInspectionId, tenantVehicleId, tenantLocationId, tenantInspectionUserId, tenantOrganizationId],
  );
  await client.query(
    `insert into training_sessions
      (id, organization_id, reference_number, service_id, title, client_name, location_id, venue, start_at, end_at, status, created_by)
     values ($1, $4, 'TENANT-TRAIN-001', 'defensive-driving', 'Tenant Defensive Driving', 'Tenant Transport Ltd', $2, 'Tenant Test Station', now(), now() + interval '1 day', 'scheduled', $3)
     on conflict (organization_id, reference_number) do update set
       title = excluded.title,
       status = excluded.status,
       created_by = excluded.created_by`,
    [tenantSessionId, tenantLocationId, tenantTrainingUserId, tenantOrganizationId],
  );
  await client.query(
    `insert into training_participants
      (id, organization_id, session_id, full_name, company_name, employee_number, attendance_status, assessment_status, certificate_eligible, created_by)
     values ($1, $4, $2, 'Tenant E2E Driver', 'Tenant Transport Ltd', 'TENANT-EMP-001', 'attended', 'pending', false, $3)
     on conflict (id) do update set
       organization_id = excluded.organization_id,
       session_id = excluded.session_id,
       full_name = excluded.full_name,
       attendance_status = excluded.attendance_status`,
    [tenantParticipantId, tenantSessionId, tenantTrainingUserId, tenantOrganizationId],
  );

  async function expectTenantBoundaryRejection(sqlText, params, label) {
    await client.query("savepoint tenant_boundary_probe");
    try {
      await client.query(sqlText, params);
    } catch (error) {
      await client.query("rollback to savepoint tenant_boundary_probe");
      await client.query("release savepoint tenant_boundary_probe");
      if (/Cross-organization|tenant/i.test(error instanceof Error ? error.message : String(error))) {
        return;
      }
      throw error;
    }

    await client.query("rollback to savepoint tenant_boundary_probe");
    await client.query("release savepoint tenant_boundary_probe");
    throw new Error(`Tenant isolation probe unexpectedly allowed ${label}`);
  }

  await expectTenantBoundaryRejection(
    `insert into vehicles (id, organization_id, transporter_id, registration_number, make, status)
     values ('e2e19999-0000-4000-8000-000000000001', $1, $2, 'TENANT-CROSS-VEH', 'RejectMe', 'active')`,
    [tenantOrganizationId, transporterId],
    "a tenant vehicle to reference the RSL transporter",
  );
  await expectTenantBoundaryRejection(
    `insert into training_participants
      (id, organization_id, session_id, full_name, attendance_status, assessment_status, certificate_eligible, created_by)
     values ('e2e19999-0000-4000-8000-000000000002', $1, $2, 'Cross Tenant Driver', 'attended', 'pending', false, $3)`,
    [tenantOrganizationId, sessionId, tenantTrainingUserId],
    "a tenant participant to reference the RSL training session",
  );

  // Test delivery and strict targeting. These fixture notices exist ONLY in
  // the isolated PostgreSQL browser-test database.
  for (const [id, targetOrg, title] of [
    ["e2e20000-0000-4000-8000-000000000001", null, "E2E Platform Change Notice"],
    ["e2e20000-0000-4000-8000-000000000002", organizationId, "E2E RSL-Only Alert"],
    ["e2e20000-0000-4000-8000-000000000003", tenantOrganizationId, "E2E Tenant-Only Alert"],
  ]) {
    await client.query(
      `insert into platform_change_notices
        (id, organization_id, created_by, title, summary, impact, action_required,
         action_url, severity, status, publish_at, effective_at)
       values ($1, $2, $3, $4, 'Security update with advanced user notification.',
         'There may be a short service interruption.', 'Review your active work before the update.',
         '/guide', 'important', 'published', now() - interval '1 day', now() + interval '2 days')
       on conflict (id) do update set organization_id = excluded.organization_id,
         title = excluded.title, status = excluded.status, publish_at = excluded.publish_at`,
      [id, targetOrg, userId, title],
    );
  }
  await client.query(
    `insert into platform_change_notices
      (id, organization_id, created_by, title, summary, impact, action_required,
       severity, status, publish_at, effective_at)
     values ('e2e20000-0000-4000-8000-000000000004', null, $1, 'E2E Future Scheduled Notice',
       'Future delivery must not be visible yet.',
       'Service updates will be announced.', 'Read the instructions when published.',
       'critical', 'published', now() + interval '2 days', now() + interval '3 days')
     on conflict (id) do update set publish_at = excluded.publish_at, effective_at = excluded.effective_at`,
    [userId],
  );
  await expectTenantBoundaryRejection(
    `insert into platform_change_notice_receipts (id, notice_id, user_id, organization_id)
     values ('e2e29999-0000-4000-8000-000000000001',
       'e2e20000-0000-4000-8000-000000000003', $1, $2)`,
    [userId, organizationId],
    "a subscriber to acknowledge another organization's system notice",
  );

  await client.query("commit");

  console.log(JSON.stringify({
    email,
    trainingEmail,
    tenantInspectionEmail,
    tenantTrainingEmail,
    passwordConfigured: Boolean(password),
    trainingPasswordConfigured: Boolean(trainingPassword),
    tenantPasswordConfigured: Boolean(tenantPassword),
    tenantTrainingPasswordConfigured: Boolean(tenantTrainingPassword),
    fixtureId: crypto.randomUUID(),
  }));
} catch (error) {
  await client.query("rollback").catch(() => {});
  throw error;
} finally {
  await client.end();
}
