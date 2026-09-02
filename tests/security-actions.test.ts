import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("2FA enrollment uses the dedicated rate limit and does not silently rotate enabled secrets", () => {
  const source = readFileSync("src/app/security/setup-2fa/setup-actions.ts", "utf8");
  assert.match(source, /user\.twoFactorEnabled/);
  assert.match(source, /rateLimit\("twoFactor", `setup:\$\{user\.id\}`\)/);
  assert.match(source, /rateLimit\("twoFactor", `enroll:\$\{user\.id\}`\)/);
  assert.match(source, /twoFactorEnabled: false/);
});

test("session and notification mutations bound attacker-controlled identifiers", () => {
  const sessionSource = readFileSync("src/app/security/actions.ts", "utf8");
  const notificationSource = readFileSync("src/app/notifications/actions.ts", "utf8");
  assert.match(sessionSource, /sessionId\.length > 128/);
  assert.match(notificationSource, /id\.length > 64/);
});

test("API key actions strictly validate scopes and owner-bound revocation", () => {
  const source = readFileSync("src/app/api-docs/server.ts", "utf8");
  assert.match(source, /z\.array\(z\.enum\(\["read", "write", "inspect", "admin"\]\)\)\.min\(1\)\.max\(4\)/);
  assert.match(source, /eq\(apiKeys\.userId, user\.id\)/);
  assert.match(source, /id\.length > 64/);
});
