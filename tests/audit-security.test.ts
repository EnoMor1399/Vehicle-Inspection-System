import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeAuditPayload, sanitizeAuditText } from "../src/lib/audit-sanitizer";

test("audit payload redacts nested credentials and tokens", () => {
  const sanitized = sanitizeAuditPayload({
    email: "user@example.com",
    passwordHash: "hash-value",
    profile: {
      apiKey: "api-secret",
      nested: {
        twoFactorSecret: "totp-secret",
        authorization: "Bearer sensitive",
      },
    },
  }) as Record<string, any>;

  assert.equal(sanitized.email, "user@example.com");
  assert.equal(sanitized.passwordHash, "[REDACTED]");
  assert.equal(sanitized.profile.apiKey, "[REDACTED]");
  assert.equal(sanitized.profile.nested.twoFactorSecret, "[REDACTED]");
  assert.equal(sanitized.profile.nested.authorization, "[REDACTED]");
});

test("audit payload handles cycles and excessive arrays safely", () => {
  const cyclic: Record<string, unknown> = { name: "vehicle" };
  cyclic.self = cyclic;

  const sanitized = sanitizeAuditPayload({
    cyclic,
    values: Array.from({ length: 120 }, (_, index) => index),
  }) as Record<string, any>;

  assert.equal(sanitized.cyclic.self, "[CIRCULAR]");
  assert.equal(sanitized.values.length, 101);
  assert.match(String(sanitized.values.at(-1)), /TRUNCATED 20 ITEMS/);
});

test("audit text removes control characters and enforces bounds", () => {
  assert.equal(sanitizeAuditText("  user\n\tname  ", 20), "user name");
  assert.equal(sanitizeAuditText("abcdefghijklmnopqrstuvwxyz", 8), "abcdefgh");
  assert.equal(sanitizeAuditText("   ", 10), null);
});
