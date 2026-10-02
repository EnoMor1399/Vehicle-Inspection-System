import "dotenv/config";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL || "";
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const expectedDatabase = process.env.EXPECTED_DATABASE_NAME || "Vehicle-Inspection-Enterprise";
const email = (process.env.E2E_USER_EMAIL || "e2e.inspector@vims.local").toLowerCase();
const password = process.env.E2E_USER_PASSWORD || "E2eOnly!Passw0rd2026";

const url = new URL(databaseUrl);
const client = new pg.Client({ connectionString: url.toString() });
await client.connect();

try {
  const target = await client.query("select current_database() as name");
  if (target.rows[0]?.name !== expectedDatabase) {
    throw new Error(`Refusing E2E seed against ${target.rows[0]?.name || "unknown"}; expected ${expectedDatabase}`);
  }

  const userId = "e2e0000-0000-4000-8000-000000000001";
  const locationId = "e2e0000-0000-4000-8000-000000000002";
  const transporterId = "e2e0000-0000-4000-8000-000000000003";
  const vehicleId = "e2e0000-0000-4000-8000-000000000004";
  const inspectionId = "e2e0000-0000-4000-8000-000000000005";
  const sessionId = "e2e0000-0000-4000-8000-000000000006";
  const participantId = "e2e0000-0000-4000-8000-000000000007";
  const passwordHash = await bcrypt.hash(password, 10);

  await client.query("begin");
  await client.query(
    `insert into locations (id, name, code, region, status)
     values ($1, 'E2E Test Station', 'E2E', 'Test Region', 'active')
     on conflict (id) do update set name = excluded.name, code = excluded.code, status = excluded.status`,
    [locationId],
  );
  await client.query(
    `insert into transporters (id, company_name, registration_number, status)
     values ($1, 'E2E Transport Ltd', 'E2E-REG', 'active')
     on conflict (id) do update set company_name = excluded.company_name, status = excluded.status`,
    [transporterId],
  );
  await client.query(
    `insert into users
      (id, name, email, role, password_hash, permissions, is_active, location_id, failed_login_attempts, two_factor_enabled)
     values ($1, 'E2E Inspector', $2, 'inspector', $3, $4::jsonb, true, $5, 0, false)
     on conflict (email) do update set
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
        training: true,
        vehicles: true,
        inspections: true,
        documents: true,
        reports: true,
      }),
      locationId,
    ],
  );
  await client.query(
    `insert into vehicles (id, transporter_id, registration_number, make, model, status)
     values ($1, $2, 'E2E-2026', 'TestMake', 'TestModel', 'active')
     on conflict (registration_number) do update set transporter_id = excluded.transporter_id, make = excluded.make, model = excluded.model`,
    [vehicleId, transporterId],
  );
  await client.query(
    `insert into inspections
      (id, inspection_number, vehicle_id, location_id, inspector_id, inspector_name, station, workflow_status, overall_result, status)
     values ($1, 'E2E-INSP-001', $2, $3, $4, 'E2E Inspector', 'E2E Test Station', 'completed', 'pass', 'completed')
     on conflict (inspection_number) do update set vehicle_id = excluded.vehicle_id, location_id = excluded.location_id`,
    [inspectionId, vehicleId, locationId, userId],
  );
  await client.query(
    `insert into training_sessions
      (id, reference_number, service_id, title, client_name, location_id, venue, start_at, end_at, status, created_by)
     values ($1, 'E2E-TRAIN-001', 'defensive-driving', 'E2E Defensive Driving', 'E2E Transport Ltd', $2, 'E2E Test Station', now(), now() + interval '1 day', 'scheduled', $3)
     on conflict (reference_number) do update set title = excluded.title, status = excluded.status`,
    [sessionId, locationId, userId],
  );
  await client.query(
    `insert into training_participants
      (id, session_id, full_name, company_name, employee_number, attendance_status, assessment_status, certificate_eligible, created_by)
     values ($1, $2, 'E2E Driver', 'E2E Transport Ltd', 'E2E-EMP-001', 'attended', 'pending', false, $3)
     on conflict (id) do update set full_name = excluded.full_name, attendance_status = excluded.attendance_status`,
    [participantId, sessionId, userId],
  );
  await client.query("commit");

  console.log(JSON.stringify({ email, passwordConfigured: Boolean(password), fixtureId: crypto.randomUUID() }));
} catch (error) {
  await client.query("rollback").catch(() => {});
  throw error;
} finally {
  await client.end();
}
