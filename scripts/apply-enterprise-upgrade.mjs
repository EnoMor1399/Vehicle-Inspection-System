import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

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
];

const client = new pg.Client({
  connectionString,
  application_name: "vims-db-upgrade",
  connectionTimeoutMillis: 15_000,
  statement_timeout: 120_000,
});

await client.connect();
try {
  for (const migrationPath of migrationPaths) {
    const sql = await readFile(resolve(migrationPath), "utf8");
    await client.query(sql);
    console.log(`Applied ${migrationPath}`);
  }
  console.log("Enterprise database upgrades applied successfully.");
} finally {
  await client.end();
}
