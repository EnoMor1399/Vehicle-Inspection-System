import test from "node:test";
import assert from "node:assert/strict";
import { applyMemoryRateLimit, type MemoryRateEntry } from "../src/lib/rate-limit";
import {
  clientIpFromHeaders,
  normalizeClientIp,
  normalizeRequestId,
  normalizeUserAgent,
} from "../src/lib/request-context";

test("request context normalizes untrusted forwarding metadata", () => {
  assert.equal(normalizeClientIp(" 203.0.113.9, 10.0.0.1 "), "203.0.113.9");
  assert.equal(normalizeClientIp("[2001:db8::1]"), "2001:db8::1");
  assert.equal(normalizeClientIp("not-an-ip"), "unknown");

  const headers = new Headers({ "x-forwarded-for": "198.51.100.7, 10.0.0.2" });
  assert.equal(clientIpFromHeaders(headers), "198.51.100.7");
});

test("request IDs and user agents are bounded before logging or propagation", () => {
  assert.equal(normalizeRequestId("trace_123-abc", "fallback"), "trace_123-abc");
  assert.equal(normalizeRequestId("bad request id", "fallback-id"), "fallback-id");
  assert.equal(normalizeRequestId("x".repeat(200), "fallback-id"), "fallback-id");

  const userAgent = normalizeUserAgent(`Browser\u0000Agent ${"x".repeat(800)}`);
  assert.equal(userAgent.includes("\u0000"), false);
  assert.ok(userAgent.length <= 512);
});

test("memory rate-limit fallback remains bounded and enforces limits", () => {
  const store = new Map<string, MemoryRateEntry>();
  const config = { limit: 2, windowMs: 1_000 };

  const first = applyMemoryRateLimit(store, "api", "a", config, 1_000, 2);
  const second = applyMemoryRateLimit(store, "api", "a", config, 1_100, 2);
  const blocked = applyMemoryRateLimit(store, "api", "a", config, 1_200, 2);
  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(blocked.allowed, false);

  applyMemoryRateLimit(store, "api", "b", config, 1_300, 2);
  applyMemoryRateLimit(store, "api", "c", config, 1_400, 2);
  assert.equal(store.size, 2);
  assert.equal(store.has("api:a"), false);

  const reset = applyMemoryRateLimit(store, "api", "b", config, 2_500, 2);
  assert.equal(reset.allowed, true);
  assert.equal(reset.remaining, 1);
});
