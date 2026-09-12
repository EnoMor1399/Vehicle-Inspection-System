import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canServeAsInternalTrainingInstructor } from "../src/lib/training-access";

test("Internal Instructor eligibility requires an active Driver Training account", () => {
  assert.equal(canServeAsInternalTrainingInstructor({
    role: "instructor",
    permissions: { training: true, training_manage: true },
    isActive: true,
  }), true);

  // Legacy training inspectors remain eligible for compatibility.
  assert.equal(canServeAsInternalTrainingInstructor({
    role: "inspector",
    permissions: { training: true },
    isActive: true,
  }), true);

  assert.equal(canServeAsInternalTrainingInstructor({
    role: "instructor",
    permissions: { vehicle_inspection: true, training: false },
    isActive: true,
  }), false);

  assert.equal(canServeAsInternalTrainingInstructor({
    role: "instructor",
    permissions: { training: true },
    isActive: false,
  }), false);

  assert.equal(canServeAsInternalTrainingInstructor({
    role: "transporter_user",
    permissions: { training: true },
    isActive: true,
  }), false);
});

test("Training session selector only uses active Internal Instructor profiles", () => {
  const source = readFileSync("src/app/driver-training/sessions/page.tsx", "utf8");
  assert.match(source, /trainingInstructorProfiles/);
  assert.match(source, /innerJoin\(users, eq\(users\.id, trainingInstructorProfiles\.userId\)\)/);
  assert.match(source, /profileStatus === "active"/);
  assert.match(source, /canServeAsInternalTrainingInstructor\(account\)/);
  assert.match(source, /Only active Driver Training users with an Internal Instructor profile are listed/);
});

test("Instructor administration only shows eligible Driver Training accounts", () => {
  const source = readFileSync("src/app/driver-training/instructors/page.tsx", "utf8");
  assert.match(source, /internalUserRows\.filter\(\(account\) => canServeAsInternalTrainingInstructor\(account\)\)/);
  assert.match(source, /profileRows\.filter/);
  assert.match(source, /Only active Driver Training & Assessment users are available for Internal Instructor assignment/);
  assert.match(source, /Only instructor profiles linked to active Driver Training & Assessment users are shown/);
});

test("session creation rejects accounts outside the Internal Instructor boundary", () => {
  const source = readFileSync("src/app/driver-training/actions.ts", "utf8");
  assert.match(source, /canServeAsInternalTrainingInstructor\(instructor\)/);
  assert.match(source, /profile\?\.status !== "active"/);
  assert.match(source, /Selected Internal Instructor must be an active Driver Training & Assessment user with an active instructor profile/);
});

test("instructor profile and readiness actions enforce Driver Training assignment", () => {
  const source = readFileSync("src/app/driver-training/readiness/actions.ts", "utf8");
  assert.match(source, /canServeAsInternalTrainingInstructor\(account\)/);
  assert.match(source, /Internal Instructor profiles can only be assigned to active Driver Training & Assessment users/);
  assert.match(source, /profile\.status !== "active"/);
  assert.match(source, /The assigned Internal Instructor is not an active Driver Training & Assessment instructor/);
});
