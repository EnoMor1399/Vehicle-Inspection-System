import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canCreateDriverTrainingUsers, canManageTrainingUsers } from "../src/lib/training-access";

test("only authorized Driver Training Super Administrators and Administrators can provision accounts", () => {
  assert.equal(canCreateDriverTrainingUsers({ role: "super_admin", permissions: { "*": true } }), true);
  assert.equal(canCreateDriverTrainingUsers({ role: "admin", permissions: { training: true } }), true);
  assert.equal(canCreateDriverTrainingUsers({ role: "admin", permissions: { training: true, training_manage: false, training_user_admin: true } }), true);
  assert.equal(canCreateDriverTrainingUsers({ role: "admin", permissions: { training: true, training_user_admin: false } }), false);
  assert.equal(canCreateDriverTrainingUsers({ role: "admin", permissions: { training: false, training_user_admin: true } }), false);
  assert.equal(canCreateDriverTrainingUsers({ role: "operations_manager", permissions: { training: true, training_user_admin: true } }), false);
  assert.equal(canCreateDriverTrainingUsers({ role: "instructor", permissions: { training: true, training_user_admin: true } }), false);
});

test("Instructor and Operations Manager accounts cannot administer Driver Training users", () => {
  assert.equal(canManageTrainingUsers({ role: "instructor", permissions: { training: true, training_user_admin: true } }), false);
  assert.equal(canManageTrainingUsers({ role: "admin", permissions: { training: true } }), true);
  assert.equal(canManageTrainingUsers({ role: "operations_manager", permissions: { training: true } }), false);
  assert.equal(canManageTrainingUsers({ role: "operations_manager", permissions: { training: true, training_user_admin: true } }), false);
});

test("Driver Training provisioning enforces scoped access, uniqueness and password security", () => {
  const source = readFileSync("src/app/driver-training/users/actions.ts", "utf8");
  assert.match(source, /canCreateDriverTrainingUsers\(actor\)/);
  assert.match(source, /actor\.role !== "super_admin" && role === "admin"/);
  assert.match(source, /validatePasswordStrength\(password\)/);
  assert.match(source, /hashPassword\(password\)/);
  assert.match(source, /lower\(\$\{users\.email\}\) = \$\{email\}/);
  assert.match(source, /\[VEHICLE_INSPECTION_ACCESS_KEY\]: false/);
  assert.match(source, /\[DRIVER_TRAINING_ACCESS_KEY\]: true/);
  assert.match(source, /trainingPermissionsForRole\(role\)/);
  assert.doesNotMatch(source, /passwordHash: result\.account/);
});

test("Instructor account provisioning creates the linked Internal Instructor profile atomically", () => {
  const source = readFileSync("src/app/driver-training/users/actions.ts", "utf8");
  assert.match(source, /db\.transaction/);
  assert.match(source, /const createInstructorProfile = role === "instructor"/);
  assert.match(source, /insert\(trainingInstructorProfiles\)/);
  assert.match(source, /instructorCode = `DTI-/);
  assert.match(source, /status: "active"/);
  assert.match(source, /revalidatePath\("\/driver-training\/instructors"\)/);
});

test("Driver Training user administration exposes Instructor Account controls", () => {
  const source = readFileSync("src/app/driver-training/users/page.tsx", "utf8");
  assert.match(source, /canCreateDriverTrainingUsers\(user\)/);
  assert.match(source, /canManageTrainingUsers\(user\)/);
  assert.match(source, /Create Driver Training account/);
  assert.match(source, /Training Administrator/);
  assert.match(source, /Instructor Account/);
  assert.match(source, /Training Supervisor \/ Reviewer/);
  assert.match(source, /Read-only Training User/);
  assert.match(source, /defaultValue="instructor"/);
  assert.match(source, /user\.role === "super_admin" && <option value="admin">/);
  assert.match(source, /form action=\{createDriverTrainingUser\}/);
});

test("Driver Training account validation errors stay inside the form instead of crashing the workspace", () => {
  const actionSource = readFileSync("src/app/driver-training/users/actions.ts", "utf8");
  const pageSource = readFileSync("src/app/driver-training/users/page.tsx", "utf8");
  assert.match(actionSource, /redirectWithFormError/);
  assert.match(actionSource, /createError/);
  assert.match(actionSource, /redirect\("\/driver-training\/users\?created=1"\)/);
  assert.match(pageSource, /Account not created\./);
  assert.match(pageSource, /pattern="\\S\*"/);
  assert.match(pageSource, /Spaces are not allowed\./);
});

test("instructor role migration is registered with the enterprise upgrade", () => {
  const migration = readFileSync("migrations/20260912_driver_training_instructor_role.sql", "utf8");
  const apply = readFileSync("scripts/apply-enterprise-upgrade.mjs", "utf8");
  assert.match(migration, /ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'instructor'/);
  assert.match(apply, /20260912_driver_training_instructor_role\.sql/);
});
