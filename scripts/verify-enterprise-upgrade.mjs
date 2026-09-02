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

const requiredIndexes = [
  "login_attempt_email_failed_created_idx",
  "login_attempt_ip_failed_created_idx",
  "session_user_active_activity_idx",
  "audit_entity_created_idx",
  "audit_user_created_idx",
  "notification_user_unread_created_idx",
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
      requiredIndexesVerified: requiredIndexes.length - missing.length,
      requiredIndexesExpected: requiredIndexes.length,
      redundantIndexesRemaining: redundantStillPresent.length,
    }),
  );

  if (missing.length > 0 || redundantStillPresent.length > 0) {
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
