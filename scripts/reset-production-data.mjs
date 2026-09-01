import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import pg from "pg";

const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL || "";
const ADMIN_NAME = (process.env.SUPER_ADMIN_NAME || "").trim();
const ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL || "").trim().toLowerCase();
const ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || "";
const CUTOVER_MODE = (process.env.CUTOVER_MODE || "preview").trim().toLowerCase();
const RESET_CONFIRMATION = process.env.RESET_CONFIRMATION || "";
const RESET_DESTRUCTIVE_ACK = process.env.RESET_DESTRUCTIVE_ACK || "";
const EXPECTED_CONFIRMATION = `RESET_OPERATIONAL_DATA:${ADMIN_EMAIL}`;
const EXPECTED_DESTRUCTIVE_ACK = "I_UNDERSTAND_THIS_DELETES_OPERATIONAL_DATA";

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

function normalizeDatabaseUrl(value) {
  try {
    const url = new URL(value);
    if (url.searchParams.get("sslmode") === "require") {
      url.searchParams.set("sslmode", "verify-full");
    }
    return url.toString();
  } catch {
    fail("DATABASE_URL is invalid");
  }
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

if (!DATABASE_URL) fail("DATABASE_URL is required");
if (!ADMIN_NAME) fail("SUPER_ADMIN_NAME is required");
if (!ADMIN_EMAIL || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ADMIN_EMAIL)) fail("SUPER_ADMIN_EMAIL is invalid");
if (!new Set(["preview", "execute"]).has(CUTOVER_MODE)) fail("CUTOVER_MODE must be preview or execute");

if (CUTOVER_MODE === "execute") {
  if (!ADMIN_PASSWORD) fail("SUPER_ADMIN_PASSWORD is required for execute mode");
  const passwordErrors = validatePassword(ADMIN_PASSWORD);
  if (passwordErrors.length) fail(`SUPER_ADMIN_PASSWORD ${passwordErrors.join(", ")}`);
  if (RESET_CONFIRMATION !== EXPECTED_CONFIRMATION) fail("confirmation mismatch");
  if (RESET_DESTRUCTIVE_ACK !== EXPECTED_DESTRUCTIVE_ACK) fail("destructive-action acknowledgement mismatch");
}

const client = new Client({ connectionString: normalizeDatabaseUrl(DATABASE_URL) });

async function assertRequiredTables() {
  const requiredTables = ["system_settings", "locations", ...RESET_TABLES];
  const { rows: presentRows } = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [requiredTables]
  );
  const present = new Set(presentRows.map((row) => row.table_name));
  const missing = requiredTables.filter((table) => !present.has(table));
  if (missing.length) throw new Error(`required tables are missing: ${missing.join(", ")}`);
}

async function countResetRecords() {
  const counts = {};
  for (const table of RESET_TABLES) {
    const { rows } = await client.query(`SELECT count(*)::int AS count FROM ${table}`);
    counts[table] = rows[0].count;
  }
  return counts;
}

try {
  await client.connect();
  await assertRequiredTables();

  if (CUTOVER_MODE === "preview") {
    const counts = await countResetRecords();
    console.log(JSON.stringify({
      mode: "preview",
      targetAdministrator: { name: ADMIN_NAME, email: ADMIN_EMAIL },
      recordsThatWouldBeRemoved: counts,
      preservedTables: ["system_settings", "locations"],
      executed: false,
    }, null, 2));
  } else {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [78654220]);

    const counts = await countResetRecords();

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
    console.log(JSON.stringify({
      mode: "execute",
      success: true,
      targetAdministrator: { name: ADMIN_NAME, email: ADMIN_EMAIL },
      removedRecords: counts,
      preservedTables: ["system_settings", "locations"],
    }, null, 2));
  }
} catch (error) {
  if (CUTOVER_MODE === "execute") await client.query("ROLLBACK").catch(() => {});
  fail(error instanceof Error ? error.message : String(error));
} finally {
  await client.end().catch(() => {});
}
