import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const runner = readFileSync("scripts/apply-enterprise-upgrade.mjs", "utf8");
const migration = readFileSync("migrations/20260902_security_query_indexes.sql", "utf8");

test("enterprise migration runner includes the security access-path migration", () => {
  assert.match(runner, /migrations\/20260902_security_query_indexes\.sql/);
});

test("security access-path migration is idempotent and targets high-frequency queries", () => {
  assert.match(migration, /CREATE INDEX IF NOT EXISTS login_attempt_email_failed_created_idx/);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS login_attempt_ip_failed_created_idx/);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS session_user_active_activity_idx/);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS audit_entity_created_idx/);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS notification_user_unread_created_idx/);
  assert.match(migration, /DROP INDEX IF EXISTS session_token_idx/);
  assert.match(migration, /DROP INDEX IF EXISTS api_key_hash_idx/);
});
