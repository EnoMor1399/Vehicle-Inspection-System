import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildTrainingMatrixRequirementKey,
  canApproveTrainingCurriculumVersion,
  canBindCurriculumToSession,
  curriculumReviewState,
  trainingCurriculumSchema,
  trainingCurriculumVersionSchema,
  trainingMatrixRequirementSchema,
} from "../src/lib/training-curriculum-policy";

test("curriculum master accepts known services and controlled codes", () => {
  const valid = trainingCurriculumSchema.safeParse({
    code: "DDT-001",
    serviceId: "defensive-driving",
    title: "Defensive Driving Core Programme",
    status: "active",
  });
  assert.equal(valid.success, true);
  assert.equal(trainingCurriculumSchema.safeParse({ code: "bad code", serviceId: "defensive-driving", title: "Programme", status: "active" }).success, false);
  assert.equal(trainingCurriculumSchema.safeParse({ code: "ABC-001", serviceId: "unknown-service", title: "Programme", status: "active" }).success, false);
});

test("curriculum version requires modules, objectives, competencies and coherent dates", () => {
  const base = {
    curriculumId: "d34db33f-0000-4000-8000-000000000021",
    versionNumber: "1.0",
    effectiveFrom: "2026-09-15",
    reviewDueDate: "2027-09-15",
    totalHours: 8,
    theoryPassMark: 70,
    practicalPassMark: 75,
    minimumAttendanceMinutes: 360,
    learningObjectives: "Identify hazards\nApply safe following distance",
    competencies: "Hazard perception\nEmergency braking",
    modules: "Risk awareness\nVehicle control",
  };
  assert.equal(trainingCurriculumVersionSchema.safeParse(base).success, true);
  assert.equal(trainingCurriculumVersionSchema.safeParse({ ...base, reviewDueDate: "2026-09-01" }).success, false);
  assert.equal(trainingCurriculumVersionSchema.safeParse({ ...base, modules: "" }).success, false);
  assert.equal(trainingCurriculumVersionSchema.safeParse({ ...base, theoryPassMark: 101 }).success, false);
});

test("approval readiness rejects incomplete or non-draft versions", () => {
  const ready = {
    status: "draft",
    effectiveFrom: "2026-09-15",
    reviewDueDate: "2027-09-15",
    totalHours: "8.00",
    theoryPassMark: 70,
    practicalPassMark: 75,
    learningObjectives: ["Identify hazards"],
    competencies: ["Hazard perception"],
    modules: ["Risk awareness"],
  };
  assert.equal(canApproveTrainingCurriculumVersion(ready), true);
  assert.equal(canApproveTrainingCurriculumVersion({ ...ready, status: "approved" }), false);
  assert.equal(canApproveTrainingCurriculumVersion({ ...ready, competencies: [] }), false);
});

test("curriculum review state flags due-soon and overdue approved content", () => {
  const now = new Date("2026-09-11T12:00:00Z");
  assert.equal(curriculumReviewState("2026-09-10", now), "overdue");
  assert.equal(curriculumReviewState("2026-09-30", now), "due_soon");
  assert.equal(curriculumReviewState("2027-09-30", now), "current");
});

test("session curriculum binding requires scheduled status, approval and matching service", () => {
  assert.equal(canBindCurriculumToSession("scheduled", "approved", "defensive-driving", "defensive-driving"), true);
  assert.equal(canBindCurriculumToSession("in_progress", "approved", "defensive-driving", "defensive-driving"), false);
  assert.equal(canBindCurriculumToSession("scheduled", "draft", "defensive-driving", "defensive-driving"), false);
  assert.equal(canBindCurriculumToSession("scheduled", "approved", "defensive-driving", "hazmat-hydrocarbons"), false);
});

test("training matrix scopes validate and produce stable normalized keys", () => {
  assert.equal(trainingMatrixRequirementSchema.safeParse({ scopeType: "client", clientName: "Acme Logistics", serviceId: "defensive-driving", recurrenceMonths: 12, required: true }).success, true);
  assert.equal(trainingMatrixRequirementSchema.safeParse({ scopeType: "client", clientName: "", serviceId: "defensive-driving", recurrenceMonths: 12, required: true }).success, false);
  assert.equal(trainingMatrixRequirementSchema.safeParse({ scopeType: "role", jobRole: "", serviceId: "defensive-driving", recurrenceMonths: 12, required: true }).success, false);
  assert.equal(
    buildTrainingMatrixRequirementKey({ scopeType: "client", clientName: "  Acme   Logistics ", serviceId: "DEFENSIVE-DRIVING" }),
    "client|acme logistics||defensive-driving",
  );
});

test("curriculum actions serialize approvals, supersede prior approval, validate owners and protect started sessions", () => {
  const source = readFileSync("src/app/driver-training/curriculum/actions.ts", "utf8");
  assert.match(source, /pg_advisory_xact_lock\(hashtext/);
  assert.match(source, /status: "superseded"/);
  assert.match(source, /Curriculum owners must be active internal VIMS users/);
  assert.match(source, /Only a scheduled session can be bound to an approved curriculum version for the same service/);
  assert.match(source, /trainingSessionCurricula/);
  assert.match(source, /requirementKey/);
  assert.match(source, /logAudit/);
});

test("curriculum migration enforces approval integrity and one approved version per curriculum", () => {
  const migration = readFileSync("migrations/20260911_driver_training_curriculum.sql", "utf8");
  assert.match(migration, /training_curriculum_version_approval_chk/);
  assert.match(migration, /approved_by IS NOT NULL/);
  assert.match(migration, /jsonb_array_length\(learning_objectives\) > 0/);
  assert.match(migration, /training_curriculum_one_approved_uidx/);
  assert.match(migration, /WHERE status = 'approved'/);
  assert.match(migration, /training_session_curriculum_session_uidx/);
  assert.match(migration, /training_matrix_requirement_key_uidx/);
});

test("enterprise migration runner and verifier include curriculum governance phase", () => {
  const runner = readFileSync("scripts/apply-enterprise-upgrade.mjs", "utf8");
  const verifier = readFileSync("scripts/verify-enterprise-upgrade.mjs", "utf8");
  assert.match(runner, /20260911_driver_training_curriculum\.sql/);
  assert.match(verifier, /training_curricula/);
  assert.match(verifier, /training_curriculum_versions/);
  assert.match(verifier, /training_session_curricula/);
  assert.match(verifier, /training_matrix_requirements/);
  assert.match(verifier, /training_curriculum_one_approved_uidx/);
});

test("Driver Training navigation exposes curriculum governance workspace", () => {
  const layout = readFileSync("src/app/driver-training/DriverTrainingNav.tsx", "utf8");
  const page = readFileSync("src/app/driver-training/curriculum/page.tsx", "utf8");
  assert.match(layout, /\/driver-training\/curriculum/);
  assert.match(page, /Curriculum & Training Matrix/);
  assert.match(page, /Approving a new version automatically supersedes/);
  assert.match(page, /Training matrix requirement/);
});
