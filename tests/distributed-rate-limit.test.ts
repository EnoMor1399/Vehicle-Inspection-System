import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("production rate limiting has a shared PostgreSQL fallback", () => {
  const limiter = readFileSync("src/lib/rate-limit.ts", "utf8");
  const health = readFileSync("src/app/api/health/route.ts", "utf8");
  const migration = readFileSync("migrations/20261002_rate_limit_buckets.sql", "utf8");
  const retention = readFileSync("scripts/security-retention.mjs", "utf8");
  const preflight = readFileSync("scripts/preflight-check.ts", "utf8");

  assert.match(limiter, /backend: "upstash" \| "postgres" \| "memory"/);
  assert.match(limiter, /INSERT INTO rate_limit_buckets/);
  assert.match(limiter, /ON CONFLICT \(bucket_key\) DO UPDATE/);
  assert.match(limiter, /backend: "postgres"/);
  assert.match(limiter, /distributedRateLimitBackend/);

  assert.match(migration, /CREATE TABLE IF NOT EXISTS rate_limit_buckets/);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS rate_limit_reset_idx/);

  assert.match(health, /"rate_limit_buckets"/);
  assert.match(health, /backend: rateLimitBackend/);

  assert.match(retention, /delete from rate_limit_buckets/);
  assert.match(preflight, /PostgreSQL shared fallback/);
});
