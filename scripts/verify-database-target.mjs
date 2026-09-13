import "dotenv/config";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const expectedDatabaseName =
  process.env.EXPECTED_DATABASE_NAME?.trim() || "Vehicle-Inspection-Enterprise";

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

const client = new pg.Client({
  connectionString: normalizePostgresSslMode(databaseUrl),
  application_name: "vims-database-target-verifier",
  connectionTimeoutMillis: 15_000,
  statement_timeout: 15_000,
});

await client.connect();
try {
  const result = await client.query("SELECT current_database() AS database_name");
  const actualDatabaseName = result.rows[0]?.database_name;
  if (actualDatabaseName !== expectedDatabaseName) {
    throw new Error(
      `VIMS database target mismatch: expected "${expectedDatabaseName}" but connected to "${actualDatabaseName || "unknown"}".`,
    );
  }

  console.log(`VIMS database target verified: ${expectedDatabaseName}`);
} finally {
  await client.end();
}
