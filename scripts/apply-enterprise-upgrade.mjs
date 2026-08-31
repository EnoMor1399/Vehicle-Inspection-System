import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const migrationPaths = [
  "migrations/20260820_enterprise_upgrade.sql",
  "migrations/20260823_enterprise_v22_hardening.sql",
  "migrations/20260830_user_theme_preferences.sql",
  "migrations/20260831_performance_indexes.sql",
];

const client = new pg.Client({
  connectionString,
  ssl: /sslmode=require/i.test(connectionString) ? { rejectUnauthorized: false } : undefined,
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
