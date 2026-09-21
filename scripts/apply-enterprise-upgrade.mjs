import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const expectedDatabaseName =
  process.env.EXPECTED_DATABASE_NAME?.trim() || "Vehicle-Inspection-Enterprise";

function normalizePostgresSslMode(value) {
  try {
    const url = new URL(value);
    // Preserve pg's current certificate verification behavior explicitly so a
    // future pg major release cannot weaken sslmode=require semantics.
    if (url.searchParams.get("sslmode")?.toLowerCase() === "require") {
      url.searchParams.set("sslmode", "verify-full");
    }
    return url.toString();
  } catch {
    return value;
  }
}

const connectionString = normalizePostgresSslMode(databaseUrl);

const migrationPaths = [
  "migrations/20260820_enterprise_upgrade.sql",
  "migrations/20260823_enterprise_v22_hardening.sql",
  "migrations/20260830_user_theme_preferences.sql",
  "migrations/20260831_performance_indexes.sql",
  "migrations/20260902_security_query_indexes.sql",
  "migrations/20260911_driver_training_operations.sql",
  "migrations/20260911_driver_training_compliance.sql",
  "migrations/20260911_driver_training_readiness.sql",
  "migrations/20260911_driver_training_evidence.sql",
  "migrations/20260911_driver_training_quality.sql",
  "migrations/20260911_driver_training_curriculum.sql",
  "migrations/20260911_driver_training_logistics.sql",
  "migrations/20260911_driver_training_requests.sql",
  "migrations/20260911_driver_training_development.sql",
  "migrations/20260911_driver_training_safety.sql",
  "migrations/20260911_driver_training_commercials.sql",
  "migrations/20260911_driver_training_accreditation.sql",
  "migrations/20260911_driver_training_communications.sql",
  "migrations/20260912_driver_training_assessment_template.sql",
  "migrations/20260912_driver_training_assessment_governance.sql",
  "migrations/20260912_driver_training_instructor_role.sql",
  "migrations/20260916_driver_training_composite_scores.sql",
  "migrations/20260919_driver_training_digital_signatures.sql",
  "migrations/20260921_audit_hash_chain.sql",
];

const client = new pg.Client({
  connectionString,
  application_name: "vims-db-upgrade",
  connectionTimeoutMillis: 15_000,
  statement_timeout: 120_000,
});

await client.connect();
try {
  const target = await client.query("SELECT current_database() AS database_name");
  const actualDatabaseName = target.rows[0]?.database_name;
  if (actualDatabaseName !== expectedDatabaseName) {
    throw new Error(
      `Refusing to apply VIMS migrations: expected database "${expectedDatabaseName}" but connected to "${actualDatabaseName || "unknown"}".`,
    );
  }

  console.log(`Verified migration target database: ${expectedDatabaseName}`);

  for (const migrationPath of migrationPaths) {
    const sql = await readFile(resolve(migrationPath), "utf8");
    await client.query(sql);
    console.log(`Applied ${migrationPath}`);
  }
  console.log("Enterprise database upgrades applied successfully.");
} finally {
  await client.end();
}
