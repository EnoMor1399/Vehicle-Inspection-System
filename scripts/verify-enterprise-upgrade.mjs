import "dotenv/config";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

function normalizePostgresSslMode(value) {
  try {
    const url = new URL(value);
    if (url.searchParams.get("sslmode")?.toLowerCase() === "require") {
      url.searchParams.set("sslmode", "verify-full");
    }
    return url.toString();
  } catch {
    return value;
  }
}

const requiredTables = [
  "training_sessions",
  "training_participants",
  "training_assessments",
  "training_certificates",
  "training_compliance_cases",
  "training_compliance_events",
];

const requiredIndexes = [
  "login_attempt_email_failed_created_idx",
  "login_attempt_ip_failed_created_idx",
  "session_user_active_activity_idx",
  "audit_entity_created_idx",
  "audit_user_created_idx",
  "notification_user_unread_created_idx",
  "training_session_reference_uidx",
  "training_session_status_start_idx",
  "training_participant_session_idx",
  "training_assessment_participant_idx",
  "training_certificate_number_uidx",
  "training_certificate_verification_uidx",
  "training_compliance_participant_idx",
  "training_compliance_certificate_idx",
  "training_compliance_status_due_idx",
  "training_compliance_assigned_idx",
  "training_compliance_event_case_created_idx",
  "training_compliance_active_case_uidx",
];

const redundantIndexes = ["session_token_idx", "api_key_hash_idx"];

const client = new pg.Client({
  connectionString: normalizePostgresSslMode(databaseUrl),
  application_name: "vims-db-upgrade-verifier",
  connectionTimeoutMillis: 15_000,
  statement_timeout: 30_000,
});

await client.connect();
try {
  const readiness = await client.query(
    "SELECT current_database() AS database_name, current_user AS role_name, current_setting('server_version_num')::int AS server_version_num",
  );

  const tableResult = await client.query(
    `SELECT tablename
       FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename = ANY($1::text[])`,
    [requiredTables],
  );
  const presentTables = new Set(tableResult.rows.map((row) => row.tablename));
  const missingTables = requiredTables.filter((name) => !presentTables.has(name));

  const { rows } = await client.query(
    `SELECT indexname
       FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = ANY($1::text[])`,
    [[...requiredIndexes, ...redundantIndexes]],
  );

  const present = new Set(rows.map((row) => row.indexname));
  const missing = requiredIndexes.filter((name) => !present.has(name));
  const redundantStillPresent = redundantIndexes.filter((name) => present.has(name));

  const metadata = readiness.rows[0];
  console.log(
    JSON.stringify({
      database: metadata?.database_name ?? "unknown",
      serverVersionNum: metadata?.server_version_num ?? null,
      requiredTablesVerified: requiredTables.length - missingTables.length,
      requiredTablesExpected: requiredTables.length,
      requiredIndexesVerified: requiredIndexes.length - missing.length,
      requiredIndexesExpected: requiredIndexes.length,
      redundantIndexesRemaining: redundantStillPresent.length,
    }),
  );

  if (missingTables.length > 0 || missing.length > 0 || redundantStillPresent.length > 0) {
    if (missingTables.length > 0) {
      console.error(`Missing required tables: ${missingTables.join(", ")}`);
    }
    if (missing.length > 0) {
      console.error(`Missing required indexes: ${missing.join(", ")}`);
    }
    if (redundantStillPresent.length > 0) {
      console.error(`Redundant indexes still present: ${redundantStillPresent.join(", ")}`);
    }
    process.exitCode = 1;
  } else {
    console.log("Enterprise database upgrade verification passed.");
  }
} finally {
  await client.end();
}
