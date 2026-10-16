import "dotenv/config";
import pg from "pg";
import { hashAuditPayload } from "../src/lib/audit-chain";

const databaseUrl = process.env.DATABASE_URL || "";
const expectedDatabase = (process.env.EXPECTED_DATABASE_NAME || "Vehicle-Inspection-Enterprise").trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required");

function normalizeDatabaseUrl(value: string) {
  const url = new URL(value);
  if (url.searchParams.get("sslmode")?.toLowerCase() === "require") url.searchParams.set("sslmode", "verify-full");
  return url.toString();
}

const client = new pg.Client({
  connectionString: normalizeDatabaseUrl(databaseUrl),
  application_name: "vims-audit-chain-verifier",
  connectionTimeoutMillis: 15_000,
  statement_timeout: 30_000,
});

await client.connect();
try {
  const target = await client.query("select current_database() as name");
  const actual = target.rows[0]?.name || "";
  if (expectedDatabase && actual !== expectedDatabase) {
    throw new Error(`Refusing audit verification against database ${actual}; expected ${expectedDatabase}`);
  }

  const { rows } = await client.query(`
    select id, organization_id, user_id, user_name, action, entity_type, entity_id, entity_label,
           summary, before, after, ip_address, previous_hash, event_hash, created_at
      from audit_logs
     order by organization_id asc, created_at asc, id asc
  `);

  const states = new Map<string, { chainStarted: boolean; expectedPreviousHash: string | null; verified: number }>();
  let verified = 0;
  const violations: string[] = [];

  for (const row of rows) {
    const organizationId = row.organization_id || "__legacy_unassigned__";
    const state = states.get(organizationId) || {
      chainStarted: false,
      expectedPreviousHash: null,
      verified: 0,
    };

    if (!row.event_hash) {
      if (state.chainStarted) {
        violations.push(`Unchained audit event after chain start in organization ${organizationId}: ${row.id}`);
      }
      states.set(organizationId, state);
      continue;
    }

    state.chainStarted = true;
    const createdAt = new Date(row.created_at).toISOString();
    if ((row.previous_hash || null) !== state.expectedPreviousHash) {
      violations.push(`Previous hash mismatch for ${row.id} in organization ${organizationId}`);
    }

    const calculated = hashAuditPayload({
      id: row.id,
      userId: row.user_id ?? null,
      userName: row.user_name ?? null,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id ?? null,
      entityLabel: row.entity_label ?? null,
      summary: row.summary ?? null,
      before: row.before ?? null,
      after: row.after ?? null,
      ipAddress: row.ip_address ?? null,
      createdAt,
      previousHash: row.previous_hash ?? null,
    });

    if (calculated !== row.event_hash) {
      violations.push(`Event hash mismatch for ${row.id} in organization ${organizationId}`);
    }
    state.expectedPreviousHash = row.event_hash;
    state.verified += 1;
    states.set(organizationId, state);
    verified += 1;
  }

  console.log(JSON.stringify({
    database: actual,
    auditRows: rows.length,
    organizationsVerified: states.size,
    chainedRowsVerified: verified,
    violations: violations.length,
  }, null, 2));
  if (violations.length) {
    console.error(violations.slice(0, 25).join("\n"));
    process.exitCode = 1;
  }
} finally {
  await client.end();
}
