import assert from "node:assert/strict";
import test from "node:test";
import {
  CANONICAL_APPLICATION_DATABASE,
  assertExpectedApplicationDatabase,
  databaseNameFromConnectionString,
  expectedApplicationDatabase,
} from "../src/lib/database-contract";

test("reads and decodes the database name from a PostgreSQL URL", () => {
  assert.equal(
    databaseNameFromConnectionString(
      "postgresql://user:pass@example.neon.tech/Vehicle-Inspection-Enterprise?sslmode=require",
    ),
    CANONICAL_APPLICATION_DATABASE,
  );
});

test("returns null for an invalid connection string", () => {
  assert.equal(databaseNameFromConnectionString("not-a-url"), null);
});

test("defaults Vercel production to the canonical application database", () => {
  assert.equal(
    expectedApplicationDatabase({ VERCEL_ENV: "production" }),
    CANONICAL_APPLICATION_DATABASE,
  );
});

test("does not force a database target for ordinary local development", () => {
  assert.equal(expectedApplicationDatabase({ NODE_ENV: "development" }), null);
});

test("allows an explicit expected database override", () => {
  assert.equal(
    expectedApplicationDatabase({ EXPECTED_DATABASE_NAME: "vims_preview" }),
    "vims_preview",
  );
});

test("rejects a production connection string that targets the wrong database", () => {
  assert.throws(
    () =>
      assertExpectedApplicationDatabase(
        "postgresql://user:pass@example.neon.tech/neondb?sslmode=require",
        { VERCEL_ENV: "production" },
      ),
    /canonical VIMS application database/,
  );
});

test("accepts the canonical production application database", () => {
  assert.doesNotThrow(() =>
    assertExpectedApplicationDatabase(
      "postgresql://user:pass@example.neon.tech/Vehicle-Inspection-Enterprise?sslmode=require",
      { VERCEL_ENV: "production" },
    ),
  );
});
