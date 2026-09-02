import test from "node:test";
import assert from "node:assert/strict";
import { buildContentSecurityPolicy } from "../src/lib/csp";
import { sanitizeTelemetryUrl } from "../src/lib/telemetry";
import { validateEmail, validatePasswordStrength } from "../src/lib/password";

const nonce = "0123456789abcdef0123456789abcdef";

test("CSP permits scripts only through the request nonce", () => {
  const policy = buildContentSecurityPolicy(nonce, true);
  assert.match(policy, new RegExp(`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`));
  assert.match(policy, /script-src-attr 'none'/);
  assert.doesNotMatch(policy, /script-src[^;]*'unsafe-inline'/);
  assert.match(policy, /upgrade-insecure-requests/);
});

test("CSP rejects unsafe nonce input", () => {
  assert.throws(() => buildContentSecurityPolicy("bad; nonce\nvalue", true), /Invalid CSP nonce/);
});

test("telemetry URLs drop query parameters and fragments", () => {
  assert.equal(
    sanitizeTelemetryUrl("https://vehicle-inspection-system-sigma.vercel.app/login?token=secret#step"),
    "https://vehicle-inspection-system-sigma.vercel.app/login"
  );
  assert.equal(sanitizeTelemetryUrl("/reports?filter=private#chart"), "/reports");
  assert.equal(sanitizeTelemetryUrl("javascript:alert(1)"), undefined);
});

test("password and email security validators retain expected behavior", () => {
  assert.equal(validatePasswordStrength("Password123!").valid, false);
  assert.equal(validatePasswordStrength("Strong-Unique-Password-2026!").valid, true);
  assert.equal(validatePasswordStrength("Strong Password 2026!").valid, false);
  assert.equal(validatePasswordStrength(`A1!${"x".repeat(126)}`).valid, false);
  assert.equal(validatePasswordStrength("password123!").valid, false);
  assert.equal(validateEmail("user@example.com"), true);
  assert.equal(validateEmail("invalid-address"), false);
});
