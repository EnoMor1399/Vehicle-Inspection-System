import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canServeAsInternalTrainingInstructor } from "../src/lib/training-access";

test("Internal Instructor eligibility requires an active Driver Training account", () => {
  assert.equal(canServeAsInternalTrainingInstructor({
    role: "inspector",
    permissions: { training: true },
    isActive: true,
  }), true);

  assert.equal(canServeAsInternalTrainingInstructor({
    role: "inspector",
    permissions: { vehicle_inspection: true, training: false },
    isActive: true,
  }), false);

  assert.equal(canServeAsInternalTrainingInstructor({
    role: "inspector",
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
