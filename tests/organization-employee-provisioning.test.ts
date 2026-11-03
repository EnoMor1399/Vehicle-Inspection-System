import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  OPERATION_TTL_SECONDS,
  STEP_UP_TTL_SECONDS,
  mintOperationsCapability,
  verifyOperationsCapability,
} from "../src/lib/super-admin-operations-token";

const read = (path: string) => readFileSync(path, "utf8");

test("Super Admin operating context survives short tasks but stays bound to session and organization", () => {
  assert.equal(OPERATION_TTL_SECONDS, 12 * 60 * 60);
  assert.equal(STEP_UP_TTL_SECONDS, 2 * 60);
  const now = 1700000000000;
  const actorId = "aaaa0000-0000-4000-8000-000000000001";
  const sessionId = "aaaa0000-0000-4000-8000-000000000002";
  const organizationId = "aaaa0000-0000-4000-8000-000000000003";
  const sessionToken = "a".repeat(128);
  const previousSecret = process.env.SUPERADMIN_OPERATIONS_SIGNING_SECRET;
  process.env.SUPERADMIN_OPERATIONS_SIGNING_SECRET = "test-only-operations-signing-secret-not-for-production-12345";
  try {
  const token = mintOperationsCapability({
    purpose: "operate", actorId, sessionId, organizationId, sessionToken, now,
  });
  assert.ok(verifyOperationsCapability({
    token, purpose: "operate", actorId, sessionId, sessionToken,
    organizationId, now: now + 16 * 60 * 1000,
  }));
  assert.equal(verifyOperationsCapability({
    token, purpose: "operate", actorId, sessionId, sessionToken,
    organizationId, now: now + OPERATION_TTL_SECONDS * 1000,
  }), null);
  assert.equal(verifyOperationsCapability({
    token, purpose: "operate", actorId, sessionId,
    sessionToken: "b".repeat(128), organizationId, now,
  }), null);
  } finally {
    if (previousSecret === undefined) delete process.env.SUPERADMIN_OPERATIONS_SIGNING_SECRET;
    else process.env.SUPERADMIN_OPERATIONS_SIGNING_SECRET = previousSecret;
  }
});

test("inspection organization admins can create only staff within their own tenant", () => {
  const users = read("src/app/users/actions.ts");
  const screen = read("src/components/UsersWorkspaceView.tsx");
  const page = read("src/app/users/page.tsx");
  assert.match(users, /export async function createVehicleInspectionEmployee/);
  assert.match(users, /vehicle_inspection_admin/);
  assert.match(users, /EMPLOYEE_ROLES/);
  assert.doesNotMatch(users.slice(users.indexOf("const EMPLOYEE_ROLES"), users.indexOf("function employeeCreationError")), /super_admin|organization_owner|driver_training_admin/);
  assert.match(users, /organizationId: actor\.organizationId/);
  assert.match(users, /eq\(locations\.organizationId, actor\.organizationId\)/);
  assert.match(users, /\[DRIVER_TRAINING_ACCESS_KEY\]: false/);
  assert.match(users, /mustChangePassword: true/);
  assert.match(users, /validatePasswordStrength/);
  assert.match(users, /extractSubscriptionCapacityError/);
  assert.match(users, /entityType: "user"/);
  assert.match(screen, /action=\{createVehicleInspectionEmployee\}/);
  assert.match(screen, /canManage &&/);
  assert.match(page, /createError=\{typeof params\.createError/);
});
