import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  accessAreaLabel,
  canAccessDriverTraining,
  canAccessVehicleInspection,
  hasCrossDomainAccess,
} from "../src/lib/system-access";

test("administration roles are isolated to their own operational domains", () => {
  const inspectionAdmin = {
    role: "vehicle_inspection_admin",
    permissions: { vehicle_inspection: true, training: false },
  };
  const trainingAdmin = {
    role: "driver_training_admin",
    permissions: { vehicle_inspection: false, training: true },
  };

  assert.equal(canAccessVehicleInspection(inspectionAdmin), true);
  assert.equal(canAccessDriverTraining(inspectionAdmin), false);
  assert.equal(canAccessVehicleInspection(trainingAdmin), false);
  assert.equal(canAccessDriverTraining(trainingAdmin), true);
  assert.equal(hasCrossDomainAccess(inspectionAdmin), false);
  assert.equal(hasCrossDomainAccess(trainingAdmin), false);
  assert.equal(accessAreaLabel(inspectionAdmin), "Vehicle Inspection");
  assert.equal(accessAreaLabel(trainingAdmin), "Driver Training & Assessment");
});

test("Super Administrator is the only default cross-domain governance role", () => {
  const superAdmin = { role: "super_admin", permissions: { "*": true } };
  assert.equal(canAccessVehicleInspection(superAdmin), true);
  assert.equal(canAccessDriverTraining(superAdmin), true);
  assert.equal(hasCrossDomainAccess(superAdmin), true);
  assert.equal(accessAreaLabel(superAdmin), "Enterprise oversight");
});

test("specialist inspector and instructor roles cannot cross domains by role fallback", () => {
  assert.equal(canAccessVehicleInspection({ role: "inspector", permissions: {} }), true);
  assert.equal(canAccessDriverTraining({ role: "inspector", permissions: {} }), false);
  assert.equal(canAccessVehicleInspection({ role: "instructor", permissions: {} }), false);
  assert.equal(canAccessDriverTraining({ role: "instructor", permissions: {} }), true);
});

test("user mutation policy rejects legacy admin assignment and enforces one domain", () => {
  const source = readFileSync("src/app/users/actions.ts", "utf8");
  assert.match(source, /requestedRole === "admin"/);
  assert.match(source, /legacy Administrator role can no longer be assigned/);
  assert.match(source, /vehicle_inspection_admin/);
  assert.match(source, /driver_training_admin/);
  assert.match(source, /vehicleInspectionAccess === driverTrainingAccess/);
  assert.match(source, /exactly one domain/);
  assert.match(source, /\["\*"\]: _discardWildcard/);
});

test("domain-specific administration is reflected in route and navigation boundaries", () => {
  const shell = readFileSync("src/components/AppShell.tsx", "utf8");
  const trainingLayout = readFileSync("src/app/driver-training/layout.tsx", "utf8");
  const trainingNav = readFileSync("src/app/driver-training/DriverTrainingNav.tsx", "utf8");

  assert.match(shell, /Vehicle Inspection Administration/);
  assert.match(shell, /Driver Training & Assessment/);
  assert.match(shell, /Vehicle Inspection Administrator/);
  assert.match(shell, /Driver Training Administrator/);
  assert.match(trainingLayout, /requireDriverTrainingUser/);
  assert.match(trainingLayout, /canManageTrainingUsers/);
  assert.match(trainingNav, /adminOnly: true/);
  assert.match(trainingNav, /canManageUsers/);
});
