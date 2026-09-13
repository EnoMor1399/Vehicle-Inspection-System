import test from "node:test";
import assert from "node:assert/strict";
import { normalizePostgresConnectionString } from "../src/lib/database-url";

test("serverless Neon connections are routed through the transaction pooler", () => {
  const input = "postgresql://user:pass@ep-example-123.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require";
  const output = normalizePostgresConnectionString(input, { preferNeonPooler: true });
  const parsed = new URL(output);

  assert.equal(parsed.hostname, "ep-example-123-pooler.c-2.us-west-2.aws.neon.tech");
  assert.equal(parsed.searchParams.get("sslmode"), "verify-full");
});

test("already pooled Neon connections remain unchanged", () => {
  const input = "postgresql://user:pass@ep-example-123-pooler.c-2.us-west-2.aws.neon.tech/neondb?sslmode=verify-full";
  const output = normalizePostgresConnectionString(input, { preferNeonPooler: true });
  const parsed = new URL(output);

  assert.equal(parsed.hostname, "ep-example-123-pooler.c-2.us-west-2.aws.neon.tech");
  assert.equal(parsed.searchParams.get("sslmode"), "verify-full");
});

test("non-Neon database hosts are not rewritten", () => {
  const input = "postgresql://user:pass@db.internal.example.com/app?sslmode=require";
  const output = normalizePostgresConnectionString(input, { preferNeonPooler: true });
  const parsed = new URL(output);

  assert.equal(parsed.hostname, "db.internal.example.com");
  assert.equal(parsed.searchParams.get("sslmode"), "verify-full");
});

test("Neon pooler routing can be disabled explicitly", () => {
  const input = "postgresql://user:pass@ep-example-123.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require";
  const output = normalizePostgresConnectionString(input, { preferNeonPooler: false });
  const parsed = new URL(output);

  assert.equal(parsed.hostname, "ep-example-123.c-2.us-west-2.aws.neon.tech");
  assert.equal(parsed.searchParams.get("sslmode"), "verify-full");
});

test("invalid connection strings are preserved for pg to validate", () => {
  const input = "not-a-postgres-url";
  assert.equal(normalizePostgresConnectionString(input, { preferNeonPooler: true }), input);
});
