import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("security retention is bounded, target-checked and production protected", () => {
  const script = readFileSync("scripts/security-retention.mjs", "utf8");
  const workflow = readFileSync(".github/workflows/security-retention.yml", "utf8");

  assert.match(script, /EXPECTED_DATABASE_NAME/);
  assert.match(script, /RETENTION_MODE/);
  assert.match(script, /update sessions set is_active = false/);
  assert.match(script, /delete from login_attempts/);
  assert.match(script, /resolved = true/);
  assert.match(script, /read_at is not null/);
  assert.match(workflow, /environment: production/);
  assert.match(workflow, /secrets\.DATABASE_URL/);
  assert.match(workflow, /schedule:/);
});
