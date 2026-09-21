import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("privileged users can authenticate only to reach mandatory enrollment", () => {
  const auth = readFileSync("src/lib/auth.ts", "utf8");
  const boundary = readFileSync("src/lib/require-auth.ts", "utf8");
  const setupPage = readFileSync("src/app/security/setup-2fa/page.tsx", "utf8");

  assert.match(auth, /operations_manager/);
  assert.match(auth, /2fa_enrollment_required/);
  assert.doesNotMatch(auth, /return \{ success: false, error: "Two-factor authentication enrollment is required by organization policy/);
  assert.match(boundary, /PRIVILEGED_2FA_ROLES/);
  assert.match(boundary, /redirect\("\/security\/setup-2fa\?required=1"\)/);
  assert.match(setupPage, /allowPendingPrivileged2FA: true/);
});
