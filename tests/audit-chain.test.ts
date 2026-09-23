import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("new audit events are tamper-evident and serialized", () => {
  const audit = readFileSync("src/lib/audit.ts", "utf8");
  const chain = readFileSync("src/lib/audit-chain.ts", "utf8");
  const schema = readFileSync("src/db/schema.ts", "utf8");
  const migration = readFileSync("migrations/20260921_audit_hash_chain.sql", "utf8");
  const verifier = readFileSync("scripts/verify-audit-chain.ts", "utf8");
  const packageJson = readFileSync("package.json", "utf8");

  assert.match(chain, /createHash\("sha256"\)/);
  assert.match(chain, /Object\.entries\(value as Record<string, unknown>\)/);
  assert.match(audit, /hashAuditPayload/);
  assert.match(audit, /isNotNull\(auditLogs\.eventHash\)/);
  assert.match(audit, /previousTime \+ 1/);
  assert.match(audit, /pg_advisory_xact_lock\(78654229\)/);
  assert.match(audit, /previousHash/);
  assert.match(audit, /eventHash/);
  assert.match(schema, /previousHash: varchar\("previous_hash"/);
  assert.match(schema, /eventHash: varchar\("event_hash"/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS previous_hash/);
  assert.match(migration, /audit_event_hash_idx/);
  assert.match(verifier, /Previous hash mismatch/);
  assert.match(verifier, /Event hash mismatch/);
  assert.match(verifier, /Unchained audit event after chain start/);
  assert.match(packageJson, /"audit:verify"/);
});
