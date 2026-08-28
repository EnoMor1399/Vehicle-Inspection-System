import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import pg from "pg";

const { Client } = pg;

const ADMIN_NAME = (process.env.SUPER_ADMIN_NAME || "Enoch Morgan").trim();
const ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL || "morganenoch1@gmail.com").trim().toLowerCase();
const ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || "";
const EXPECTED_CONFIRMATION = `RESET_OPERATIONAL_DATA:${ADMIN_EMAIL}`;
const RESET_CONFIRMATION = process.env.RESET_CONFIRMATION || "";

const RESET_TABLES = [
  "webhooks",
  "api_keys",
  "sessions",
  "security_events",
  "login_attempts",
  "notifications",
  "signatures",
  "documents",
  "import_jobs",
  "audit_logs",
  "daily_inspections",
  "rfid_tags",
  "inspections",
  "vehicles",
  "transporters",
  "users",
];

function fail(message) {
  console.error(`Cutover aborted: ${message}`);
  process.exit(1);
}

function validatePassword(password) {
  const errors = [];
  if (password.length < 12) errors.push("must contain at least 12 characters");
  if (password.length > 128) errors.push("must not exceed 128 characters");
  if (!/[A-Z]/.test(password)) errors.push("must include an uppercase letter");
  if (!/[a-z]/.test(password)) errors.push("must include a lowercase letter");
  if (!/[0-9]/.test(password)) errors.push("must include a number");
  if (!/[^A-Za-z0-9]/.test(password)) errors.push("must include a special character");
  if (/\s/.test(password)) errors.push("must not contain whitespace");
  return errors;
}

if (!process.env.DATABASE_URL) fail("DATABASE_URL is required");
if (!ADMIN_NAME) fail("SUPER_ADMIN_NAME is required");
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ADMIN_EMAIL)) fail("SUPER_ADMIN_EMAIL is invalid");
if (!ADMIN_PASSWORD) fail("SUPER_ADMIN_PASSWORD is required");

const passwordErrors = validatePassword(ADMIN_PASSWORD);
if (passwordErrors.length) fail(`SUPER_ADMIN_PASSWORD ${passwordErrors.join(", ")}`);
if (RESET_CONFIRMATION !== EXPECTED_CONFIRMATION) {
  fail(`confirmation mismatch; expected ${EXPECTED_CONFIRMATION}`);
}

const client = new Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock($1)", [78654220]);

  const requiredTables = ["system_settings", "locations", ...RESET_TABLES];
  const { rows: presentRows } = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [requiredTables]
  );
  const present = new Set(presentRows.map((row) => row.table_name));
  const missing = requiredTables.filter((table) => !present.has(table));
  if (missing.length) throw new Error(`required tables are missing: ${missing.join(", ")}`);

  const counts = {};
  for (const table of RESET_TABLES) {
    const { rows } = await client.query(`SELECT count(*)::int AS count FROM ${table}`);
    counts[table] = rows[0].count;
  }

  // system_settings is intentionally preserved. Clear its reference to users
  // before removing all previous accounts, then attribute it to the new owner.
  await client.query("UPDATE system_settings SET updated_by = NULL");

  for (const table of RESET_TABLES) {
    await client.query(`DELETE FROM ${table}`);
  }

  const adminId = crypto.randomUUID();
  const auditId = crypto.randomUUID();
  const bcryptRounds = Math.min(14, Math.max(10, Number(process.env.PASSWORD_BCRYPT_ROUNDS || 12)));
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, bcryptRounds);

  await client.query(
    `INSERT INTO users
      (id, name, email, role, password_hash, permissions, is_active,
       failed_login_attempts, two_factor_enabled, created_at, updated_at)
     VALUES ($1, $2, $3, 'super_admin', $4, $5::jsonb, true, 0, false, now(), now())`,
    [adminId, ADMIN_NAME, ADMIN_EMAIL, passwordHash, JSON.stringify({ "*": true })]
  );

  await client.query("UPDATE system_settings SET updated_by = $1", [adminId]);
  await client.query(
    `INSERT INTO audit_logs
      (id, user_id, user_name, action, entity_type, entity_id, entity_label, summary, created_at)
     VALUES ($1, $2, $3, 'create', 'user', $2, $4,
       'Production cutover created the sole Super Administrator after operational data reset', now())`,
    [auditId, adminId, ADMIN_NAME, ADMIN_EMAIL]
  );

  const { rows: verification } = await client.query(
    `SELECT count(*)::int AS total_users,
            count(*) FILTER (WHERE role = 'super_admin' AND is_active = true)::int AS active_super_admins,
            min(email) AS email
     FROM users`
  );
  const result = verification[0];
  if (result.total_users !== 1 || result.active_super_admins !== 1 || result.email !== ADMIN_EMAIL) {
    throw new Error("post-cutover administrator verification failed");
  }

  await client.query("COMMIT");
  console.log("Production cutover completed successfully.");
  console.log(`Super Administrator: ${ADMIN_NAME} <${ADMIN_EMAIL}>`);
  console.log(`Removed records: ${JSON.stringify(counts)}`);
  console.log("Preserved tables: system_settings, locations");
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  fail(error instanceof Error ? error.message : String(error));
} finally {
  await client.end().catch(() => {});
}
