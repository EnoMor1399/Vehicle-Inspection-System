import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const migrationPath = resolve("migrations/20260820_enterprise_upgrade.sql");
const sql = await readFile(migrationPath, "utf8");
const client = new pg.Client({
  connectionString,
  ssl: /sslmode=require/i.test(connectionString) ? { rejectUnauthorized: false } : undefined,
});

await client.connect();
try {
  await client.query(sql);
  console.log("Enterprise database upgrade applied successfully.");
} finally {
  await client.end();
}
