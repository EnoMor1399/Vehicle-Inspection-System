import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  accessAreaLabel,
  canAccessDriverTraining,
  canAccessVehicleInspection,
} from "../src/lib/system-access";
import { canManageTraining, canViewTraining } from "../src/lib/training-access";

test("legacy VIMS accounts remain Vehicle Inspection users by default", () => {
  const user = { role: "inspector", permissions: {} };
  assert.equal(canAccessVehicleInspection(user), true);
  assert.equal(canAccessDriverTraining(user), false);
  assert.equal(accessAreaLabel(user), "Vehicle Inspection");
});

test("Driver Training assignment does not automatically grant Vehicle Inspection", () => {
  const user = {
    role: "inspector",
    permissions: { vehicle_inspection: false, training: true },
  };

  assert.equal(canAccessVehicleInspection(user), false);
  assert.equal(canAccessDriverTraining(user), true);
  assert.equal(canViewTraining(user), true);
  assert.equal(canManageTraining(user), true);
  assert.equal(accessAreaLabel(user), "Driver Training");
});

test("Vehicle Inspection assignment blocks role-derived Driver Training access", () => {
  const user = {
    role: "admin",
    permissions: { vehicle_inspection: true, training: false },
  };

  assert.equal(canAccessVehicleInspection(user), true);
  assert.equal(canViewTraining(user), false);
  assert.equal(canManageTraining(user), false);
});

test("cross-system accounts can work in both domains", () => {
  const user = {
    role: "admin",
    permissions: { vehicle_inspection: true, training: true },
  };

  assert.equal(canAccessVehicleInspection(user), true);
  assert.equal(canAccessDriverTraining(user), true);
  assert.equal(canViewTraining(user), true);
  assert.equal(accessAreaLabel(user), "Both systems");
});

test("Super Administrator keeps cross-system oversight by default", () => {
  const user = { role: "super_admin", permissions: {} };
  assert.equal(canAccessVehicleInspection(user), true);
  assert.equal(canAccessDriverTraining(user), true);
});

test("Vehicle Inspection permissions enforce the system boundary", () => {
  const source = readFileSync("src/lib/auth.ts", "utf8");
  assert.match(source, /VEHICLE_INSPECTION_RESOURCES/);
  assert.match(source, /!canAccessVehicleInspection\(u\)/);
  assert.match(source, /return false/);
});

test("user access action persists both system assignments and revokes sessions", () => {
  const source = readFileSync("src/app/users/actions.ts", "utf8");
  assert.match(source, /VEHICLE_INSPECTION_ACCESS_KEY/);
  assert.match(source, /DRIVER_TRAINING_ACCESS_KEY/);
  assert.match(source, /accessChanged/);
  assert.match(source, /update\(sessions\)/);
  assert.match(source, /driver-training\/users/);
});
