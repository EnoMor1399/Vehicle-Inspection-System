import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isUserRole, validateDelegatedRoleChange } from "../src/lib/user-access-policy";

test("recognized VIMS roles are validated centrally", () => {
  assert.equal(isUserRole("super_admin"), true);
  assert.equal(isUserRole("inspector"), true);
  assert.equal(isUserRole("unknown_role"), false);
});

test("delegated user managers cannot assign roles above their own", () => {
  assert.equal(validateDelegatedRoleChange("viewer", "viewer", "admin").ok, false);
  assert.equal(validateDelegatedRoleChange("operations_manager", "viewer", "admin").ok, false);
  assert.equal(validateDelegatedRoleChange("admin", "viewer", "operations_manager").ok, true);
  assert.equal(validateDelegatedRoleChange("admin", "admin", "admin").ok, true);
});

test("only Super Administrators may touch Super Administrator access", () => {
  assert.equal(validateDelegatedRoleChange("admin", "super_admin", "super_admin").ok, false);
  assert.equal(validateDelegatedRoleChange("admin", "viewer", "super_admin").ok, false);
  assert.equal(validateDelegatedRoleChange("super_admin", "super_admin", "admin").ok, true);
});

test("user access action serializes last-admin checks and session revocation", () => {
  const source = readFileSync("src/app/users/actions.ts", "utf8");
  assert.match(source, /pg_advisory_xact_lock\(78654223\)/);
  assert.match(source, /role = 'super_admin' and is_active = true for update/);
  assert.match(source, /tx\s*\.update\(sessions\)/);
  assert.match(source, /sessionsRevoked/);
});
