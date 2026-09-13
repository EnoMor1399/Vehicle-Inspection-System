import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schemaSource = readFileSync(new URL("../src/db/schema.ts", import.meta.url), "utf8");
const migrationSources = [
  readFileSync(new URL("../migrations/20260831_performance_indexes.sql", import.meta.url), "utf8"),
  readFileSync(new URL("../migrations/20260902_security_query_indexes.sql", import.meta.url), "utf8"),
];

function extractIndexNames(pattern: RegExp) {
  return migrationSources.flatMap((source) => [...source.matchAll(pattern)].map((match) => match[1]));
}

test("Drizzle schema declares indexes created by guarded performance/security migrations", () => {
  const createdIndexes = extractIndexNames(/CREATE INDEX IF NOT EXISTS\s+([a-zA-Z0-9_]+)/g);

  assert.ok(createdIndexes.length > 0, "expected migration index definitions to be discovered");
  for (const indexName of createdIndexes) {
    assert.match(
      schemaSource,
      new RegExp(`index\\(["']${indexName}["']\\)`),
      `Drizzle schema is missing migrated index ${indexName}`,
    );
  }
});

test("Drizzle schema does not redeclare indexes explicitly removed by security migration", () => {
  const droppedIndexes = extractIndexNames(/DROP INDEX IF EXISTS\s+([a-zA-Z0-9_]+)/g);

  assert.ok(droppedIndexes.length > 0, "expected dropped migration indexes to be discovered");
  for (const indexName of droppedIndexes) {
    assert.doesNotMatch(
      schemaSource,
      new RegExp(`index\\(["']${indexName}["']\\)`),
      `Drizzle schema still declares removed index ${indexName}`,
    );
  }
});
