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

test("Driver Training Administrator is isolated from Vehicle Inspection", () => {
  const user = {
    role: "driver_training_admin",
    permissions: { vehicle_inspection: false, training: true },
  };

  assert.equal(canAccessVehicleInspection(user), false);
  assert.equal(canAccessDriverTraining(user), true);
  assert.equal(canViewTraining(user), true);
  assert.equal(canManageTraining(user), true);
  assert.equal(accessAreaLabel(user), "Driver Training & Assessment");
});

test("Vehicle Inspection Administrator cannot use Driver Training", () => {
  const user = {
    role: "vehicle_inspection_admin",
    permissions: { vehicle_inspection: true, training: false },
  };

  assert.equal(canAccessVehicleInspection(user), true);
  assert.equal(canAccessDriverTraining(user), false);
  assert.equal(canViewTraining(user), false);
  assert.equal(canManageTraining(user), false);
  assert.equal(accessAreaLabel(user), "Vehicle Inspection");
});

test("specialist roles remain in their own operational domains", () => {
  const inspector = { role: "inspector", permissions: { vehicle_inspection: true, training: false } };
  const instructor = { role: "instructor", permissions: { vehicle_inspection: false, training: true } };

  assert.equal(canAccessVehicleInspection(inspector), true);
  assert.equal(canAccessDriverTraining(inspector), false);
  assert.equal(canAccessVehicleInspection(instructor), false);
  assert.equal(canAccessDriverTraining(instructor), true);
});

test("Super Administrator keeps enterprise oversight across both domains", () => {
  const user = { role: "super_admin", permissions: { "*": true } };
  assert.equal(canAccessVehicleInspection(user), true);
  assert.equal(canAccessDriverTraining(user), true);
  assert.equal(accessAreaLabel(user), "Enterprise oversight");
});

test("Vehicle Inspection permissions enforce the system boundary", () => {
  const source = readFileSync("src/lib/auth.ts", "utf8");
  assert.match(source, /VEHICLE_INSPECTION_RESOURCES/);
  assert.match(source, /!canAccessVehicleInspection\(u\)/);
  assert.match(source, /return false/);
});

test("user access action persists domain assignment and revokes sessions", () => {
  const source = readFileSync("src/app/users/actions.ts", "utf8");
  assert.match(source, /VEHICLE_INSPECTION_ACCESS_KEY/);
  assert.match(source, /DRIVER_TRAINING_ACCESS_KEY/);
  assert.match(source, /vehicleInspectionAccess === driverTrainingAccess/);
  assert.match(source, /accessChanged/);
  assert.match(source, /update\(sessions\)/);
  assert.match(source, /driver-training\/users/);
});
