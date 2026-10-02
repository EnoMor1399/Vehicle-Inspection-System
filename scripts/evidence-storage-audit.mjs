import "dotenv/config";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL || "";
const expectedDatabase = (process.env.EXPECTED_DATABASE_NAME || "Vehicle-Inspection-Enterprise").trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required");

function normalizeDatabaseUrl(value) {
  const url = new URL(value);
  if (url.searchParams.get("sslmode")?.toLowerCase() === "require") {
    url.searchParams.set("sslmode", "verify-full");
  }
  return url.toString();
}

const client = new pg.Client({
  connectionString: normalizeDatabaseUrl(databaseUrl),
  application_name: "vims-evidence-storage-audit",
  connectionTimeoutMillis: 15_000,
  statement_timeout: 30_000,
});

await client.connect();
try {
  const target = await client.query("select current_database() as name");
  const actual = target.rows[0]?.name || "";
  if (expectedDatabase && actual !== expectedDatabase) {
    throw new Error(`Refusing storage audit against database ${actual}; expected ${expectedDatabase}`);
  }

  const result = await client.query(`
    select
      (select count(*)::int from inspections where inspector_signature like 'data:image/%') as inspection_inspector_data_signatures,
      (select count(*)::int from inspections where supervisor_signature like 'data:image/%') as inspection_supervisor_data_signatures,
      (select count(*)::int from signatures where data_url like 'data:image/%') as signature_table_data_urls,
      (select count(*)::int from daily_inspections where driver_signature like 'data:image/%') as daily_driver_data_signatures,
      (select count(*)::int from training_assessments where assessor_signature like 'data:image/%') as training_assessor_data_signatures,
      (select count(*)::int from training_assessments where reviewer_signature like 'data:image/%') as training_reviewer_data_signatures,
      (select count(*)::int from training_assessments where assessor_signature like 'https://%.private.blob.vercel-storage.com/%') as training_assessor_private_blob,
      (select count(*)::int from training_assessments where reviewer_signature like 'https://%.private.blob.vercel-storage.com/%') as training_reviewer_private_blob,
      (select count(*)::int from inspections where section_data::text like '%data:image/%') as inspections_with_embedded_photos,
      (select count(*)::int from daily_inspections where checklist::text like '%data:image/%') as daily_inspections_with_embedded_photos,
      (select coalesce(sum(octet_length(section_data::text)),0)::bigint from inspections where section_data::text like '%data:image/%') as inspection_embedded_payload_bytes,
      (select coalesce(sum(octet_length(checklist::text)),0)::bigint from daily_inspections where checklist::text like '%data:image/%') as daily_embedded_payload_bytes
  `);

  console.log(JSON.stringify({
    database: actual,
    generatedAt: new Date().toISOString(),
    ...result.rows[0],
    recommendation: "Migrate new evidence to authenticated private object storage first; backfill historical data in bounded batches after verification.",
  }, null, 2));
} finally {
  await client.end();
}
