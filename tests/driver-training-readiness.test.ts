import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  evaluateTrainingReadiness,
  instructorDeploymentState,
  trainingCredentialState,
  trainingInstructorProfileSchema,
  trainingSessionReadinessSchema,
} from "../src/lib/training-readiness-policy";

const USER_ID = "d34db33f-0000-4000-8000-000000000030";
const SESSION_ID = "d34db33f-0000-4000-8000-000000000031";

const completeReadiness = {
  instructorConfirmed: true,
  venueConfirmed: true,
  vehicleEquipmentReady: true,
  trainingMaterialsReady: true,
  participantListConfirmed: true,
  riskAssessmentComplete: true,
  emergencyPlanConfirmed: true,
  clientConfirmationReceived: true,
};

test("readiness evaluation requires every delivery control and no blocker", () => {
  const ready = evaluateTrainingReadiness({ ...completeReadiness, blockers: [] });
  assert.deepEqual(ready, { status: "ready", completed: 8, total: 8, percentage: 100 });

  const incomplete = evaluateTrainingReadiness({ ...completeReadiness, venueConfirmed: false, blockers: [] });
  assert.equal(incomplete.status, "not_ready");
  assert.equal(incomplete.completed, 7);
  assert.equal(incomplete.percentage, 88);

  const blocked = evaluateTrainingReadiness({ ...completeReadiness, blockers: ["Training vehicle unavailable"] });
  assert.equal(blocked.status, "blocked");
});

test("credential and instructor deployment states surface expiry and incomplete evidence", () => {
  const now = new Date("2026-09-11T12:00:00Z");
  assert.equal(trainingCredentialState([], now), "incomplete");
  assert.equal(trainingCredentialState(["2026-09-01"], now), "expired");
  assert.equal(trainingCredentialState(["2026-10-01"], now), "expiring");
  assert.equal(trainingCredentialState(["2027-01-01"], now), "current");

  assert.equal(instructorDeploymentState({ status: "inactive", trainerCertificationExpiry: "2027-01-01" }, now), "unavailable");
  assert.equal(instructorDeploymentState({ status: "active", trainerCertificationExpiry: "2026-09-01" }, now), "blocked");
  assert.equal(instructorDeploymentState({ status: "active", trainerCertificationExpiry: "2026-10-01" }, now), "attention");
  assert.equal(instructorDeploymentState({ status: "active" }, now), "incomplete");
  assert.equal(instructorDeploymentState({ status: "active", trainerCertificationExpiry: "2027-01-01" }, now), "ready");
});

test("instructor profile and readiness validation bound specialties, notes, dates and identifiers", () => {
  assert.equal(trainingInstructorProfileSchema.safeParse({
    userId: USER_ID,
    status: "active",
    specialties: "Defensive Driving, Off-Road Driving",
    trainerCertification: "Approved Driver Trainer",
    trainerCertificationExpiry: "2027-06-30",
    medicalFitnessExpiry: "2027-03-31",
  }).success, true);
  assert.equal(trainingInstructorProfileSchema.safeParse({ userId: "bad-id", status: "active" }).success, false);
  assert.equal(trainingInstructorProfileSchema.safeParse({ userId: USER_ID, status: "unknown" }).success, false);

  assert.equal(trainingSessionReadinessSchema.safeParse({
    sessionId: SESSION_ID,
    ...completeReadiness,
    blockers: "",
    notes: "Ready for delivery",
  }).success, true);
});

test("readiness migration constrains instructor status and creates unique session/profile backstops", () => {
  const migration = readFileSync("migrations/20260911_driver_training_readiness.sql", "utf8");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS training_instructor_profiles/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS training_session_readiness/);
  assert.match(migration, /training_instructor_status_chk/);
  assert.match(migration, /training_readiness_status_chk/);
  assert.match(migration, /training_instructor_user_uidx/);
  assert.match(migration, /training_instructor_code_uidx/);
  assert.match(migration, /training_readiness_session_uidx/);
  assert.match(migration, /jsonb_typeof\(blockers\) = 'array'/);
});

test("enterprise upgrade and verifier include readiness migration tables and indexes", () => {
  const runner = readFileSync("scripts/apply-enterprise-upgrade.mjs", "utf8");
  const verifier = readFileSync("scripts/verify-enterprise-upgrade.mjs", "utf8");
  assert.match(runner, /20260911_driver_training_readiness\.sql/);
  assert.match(verifier, /training_instructor_profiles/);
  assert.match(verifier, /training_session_readiness/);
  assert.match(verifier, /training_instructor_user_uidx/);
  assert.match(verifier, /training_readiness_session_uidx/);
});

test("server actions restrict instructor profiles to eligible Driver Training users and protect readiness confirmation", () => {
  const source = readFileSync("src/app/driver-training/readiness/actions.ts", "utf8");
  assert.match(source, /canManageTraining/);
  assert.match(source, /canServeAsInternalTrainingInstructor\(account\)/);
  assert.match(source, /Internal Instructor profiles can only be assigned to active Driver Training & Assessment users/);
  assert.match(source, /pg_advisory_xact_lock\(hashtext/);
  assert.match(source, /Assign an internal instructor before confirming instructor readiness/);
  assert.match(source, /profile\.status !== "active"/);
  assert.match(source, /The assigned Internal Instructor is not an active Driver Training & Assessment instructor/);
  assert.match(source, /instructorDeploymentState/);
  assert.match(source, /\["unavailable", "blocked", "incomplete"\]/);
  assert.match(source, /logAudit/);
});

test("readiness workspace exposes all eight controls and does not silently change lifecycle", () => {
  const source = readFileSync("src/app/driver-training/readiness/page.tsx", "utf8");
  for (const marker of [
    "Qualified instructor confirmed",
    "Venue / training area confirmed",
    "Vehicle / equipment ready",
    "Training materials ready",
    "Participant list confirmed",
    "Risk assessment complete",
    "Emergency plan confirmed",
    "Client confirmation received",
  ]) assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(source, /does not automatically change the session lifecycle/);
  assert.match(source, /Save readiness review/);
  assert.doesNotMatch(source, /updateTrainingSessionStatus/);
});

test("instructor register surfaces credential expiry and department navigation exposes both workspaces", () => {
  const instructorPage = readFileSync("src/app/driver-training/instructors/page.tsx", "utf8");
  const layout = readFileSync("src/app/driver-training/DriverTrainingNav.tsx", "utf8");
  assert.match(instructorPage, /Instructor Qualifications/);
  assert.match(instructorPage, /trainerCertificationExpiry/);
  assert.match(instructorPage, /medicalFitnessExpiry/);
  assert.match(instructorPage, /instructorDeploymentState/);
  assert.match(layout, /\/driver-training\/instructors/);
  assert.match(layout, /\/driver-training\/readiness/);
});
