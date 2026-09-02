import test from "node:test";
import assert from "node:assert/strict";
import { systemSettingsUpdateSchema } from "../src/lib/settings-policy";

test("settings policy preserves the enterprise password and session floor", () => {
  assert.equal(systemSettingsUpdateSchema.safeParse({ passwordMinLength: 12 }).success, true);
  assert.equal(systemSettingsUpdateSchema.safeParse({ passwordMinLength: 11 }).success, false);
  assert.equal(systemSettingsUpdateSchema.safeParse({ sessionTimeoutMinutes: 5 }).success, true);
  assert.equal(systemSettingsUpdateSchema.safeParse({ sessionTimeoutMinutes: 4 }).success, false);
  assert.equal(systemSettingsUpdateSchema.safeParse({ maxFailedAttempts: 20 }).success, true);
  assert.equal(systemSettingsUpdateSchema.safeParse({ maxFailedAttempts: 21 }).success, false);
});

test("settings policy accepts valid brand colors and rejects CSS injection forms", () => {
  assert.equal(systemSettingsUpdateSchema.safeParse({ themeColor: "#0f172a", accentColor: "#F59E0B" }).success, true);
  assert.equal(systemSettingsUpdateSchema.safeParse({ themeColor: "red; background:url(javascript:alert(1))" }).success, false);
  assert.equal(systemSettingsUpdateSchema.safeParse({ accentColor: "var(--evil)" }).success, false);
});

test("settings policy rejects active SVG logos and allows bounded raster data URLs", () => {
  const png = "data:image/png;base64,iVBORw0KGgo=";
  const svg = "data:image/svg+xml;base64,PHN2Zz48c2NyaXB0PmFsZXJ0KDEpPC9zY3JpcHQ+PC9zdmc+";
  assert.equal(systemSettingsUpdateSchema.safeParse({ logoDataUrl: png }).success, true);
  assert.equal(systemSettingsUpdateSchema.safeParse({ logoDataUrl: svg }).success, false);
});

test("settings policy restricts URLs and email fields", () => {
  assert.equal(systemSettingsUpdateSchema.safeParse({ website: "https://vims.example.com", email: "ops@example.com" }).success, true);
  assert.equal(systemSettingsUpdateSchema.safeParse({ website: "javascript:alert(1)" }).success, false);
  assert.equal(systemSettingsUpdateSchema.safeParse({ logoUrl: "data:text/html,<script>alert(1)</script>" }).success, false);
  assert.equal(systemSettingsUpdateSchema.safeParse({ email: "not-an-email" }).success, false);
});

test("settings policy rejects unexpected settings keys", () => {
  assert.equal(systemSettingsUpdateSchema.safeParse({ companyName: "Road Safety Limited", arbitraryAdminFlag: true }).success, false);
});
