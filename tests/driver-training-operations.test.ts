import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DRIVER_TRAINING_SERVICES } from "../src/lib/driver-training";
import { canManageTraining, canViewTraining } from "../src/lib/training-access";
import {
  addUtcMonthsClamped,
  calculateOverallScore,
  canTransitionTrainingSession,
  isPassingTrainingResult,
  isValidTrainingDate,
  trainingAssessmentSchema,
  trainingParticipantSchema,
  trainingSessionSchema,
} from "../src/lib/training-policy";

function actionBlock(source: string, name: string, nextName?: string) {
  const start = source.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `${name} action should exist`);
  const end = nextName ? source.indexOf(`export async function ${nextName}`, start + 1) : source.length;
  assert.ok(end === -1 || end > start, `${name} action boundary should be valid`);
  return source.slice(start, end === -1 ? source.length : end);
}

test("Driver Training service catalog remains exactly the six approved services", () => {
  assert.deepEqual(
    DRIVER_TRAINING_SERVICES.map((service) => service.id),
    [
      "defensive-driving",
      "driving-proficiency-test",
      "hazmat-hydrocarbons",
      "off-road-driving",
      "forklift-operator-safety",
      "vehicle-safety-inspection",
    ],
  );
});

test("Driver Training access separates view and manage privileges", () => {
  assert.equal(canViewTraining({ role: "admin" }), true);
  assert.equal(canManageTraining({ role: "admin" }), true);
  assert.equal(canViewTraining({ role: "auditor" }), true);
  assert.equal(canManageTraining({ role: "auditor" }), false);
  assert.equal(canViewTraining({ role: "compliance_officer" }), true);
  assert.equal(canManageTraining({ role: "compliance_officer" }), false);
  assert.equal(canViewTraining({ role: "viewer" }), false);
  assert.equal(canManageTraining({ role: "viewer" }), false);
  assert.equal(canViewTraining({ role: "viewer", permissions: { training: true } }), true);
  assert.equal(canManageTraining({ role: "viewer", permissions: { training: true, training_manage: true } }), true);
  assert.equal(canViewTraining({ role: "admin", permissions: { training: false } }), false);
});

test("session validation rejects unknown services and non-positive schedules", () => {
  const valid = {
    serviceId: "defensive-driving",
    title: "Defensive Driving — Fleet A",
    clientName: "Example Transport",
    transporterId: "",
    locationId: "",
    venue: "Tema",
    deliveryMode: "onsite",
    startAt: "2026-09-20T08:00",
    endAt: "2026-09-20T16:00",
    instructorId: "",
    instructorName: "Lead Trainer",
    capacity: "25",
    notes: "",
  };
  assert.equal(trainingSessionSchema.safeParse(valid).success, true);
  assert.equal(trainingSessionSchema.safeParse({ ...valid, serviceId: "unapproved-course" }).success, false);
  assert.equal(trainingSessionSchema.safeParse({ ...valid, startAt: "2026-09-20T18:00", endAt: "2026-09-20T08:00" }).success, false);
  assert.equal(trainingSessionSchema.safeParse({ ...valid, startAt: "2026-09-20T08:00", endAt: "2026-09-20T08:00" }).success, false);
});

test("training calendar dates reject impossible dates", () => {
  assert.equal(isValidTrainingDate("2028-02-29"), true);
  assert.equal(isValidTrainingDate("2026-02-29"), false);
  assert.equal(isValidTrainingDate("2026-02-31"), false);
  assert.equal(isValidTrainingDate("2026-13-01"), false);

  const invalidParticipant = trainingParticipantSchema.safeParse({
    sessionId: "d34db33f-0000-4000-8000-000000000001",
    fullName: "Ama Driver",
    companyName: "Fleet Ltd",
    employeeNumber: "DRV-4",
    phone: "0200000000",
    email: "ama@example.com",
    driverLicenseNumber: "DL-100",
    driverLicenseClass: "D",
    driverLicenseExpiry: "2026-02-31",
    notes: "",
  });
  assert.equal(invalidParticipant.success, false);
});

test("participant and assessment validation bound operational input", () => {
  const participant = trainingParticipantSchema.safeParse({
    sessionId: "d34db33f-0000-4000-8000-000000000001",
    fullName: "Ama Driver",
    companyName: "Fleet Ltd",
    employeeNumber: "DRV-4",
    phone: "0200000000",
    email: "ama@example.com",
    driverLicenseNumber: "DL-100",
    driverLicenseClass: "D",
    driverLicenseExpiry: "2027-12-31",
    notes: "",
  });
  assert.equal(participant.success, true);

  const assessment = trainingAssessmentSchema.safeParse({
    participantId: "d34db33f-0000-4000-8000-000000000002",
    assessmentType: "proficiency",
    theoryScore: "78",
    practicalScore: "86",
    result: "competent",
    riskLevel: "low",
    strengths: "Good hazard anticipation",
    improvementAreas: "mirror routine, fuel-efficient acceleration",
    remarks: "",
  });
  assert.equal(assessment.success, true);
  assert.equal(trainingAssessmentSchema.safeParse({
    participantId: "d34db33f-0000-4000-8000-000000000002",
    assessmentType: "proficiency",
    theoryScore: "",
    practicalScore: "",
    result: "competent",
    riskLevel: "low",
    strengths: "",
    improvementAreas: "",
    remarks: "",
  }).success, false);
});

test("assessment scoring, certificate dates and session lifecycle are deterministic", () => {
  assert.equal(calculateOverallScore(80, 90), 85);
  assert.equal(calculateOverallScore(undefined, 70), 70);
  assert.equal(calculateOverallScore(undefined, undefined), null);
  assert.equal(isPassingTrainingResult("pass"), true);
  assert.equal(isPassingTrainingResult("competent"), true);
  assert.equal(isPassingTrainingResult("fail"), false);
  assert.equal(canTransitionTrainingSession("scheduled", "in_progress"), true);
  assert.equal(canTransitionTrainingSession("in_progress", "completed"), true);
  assert.equal(canTransitionTrainingSession("completed", "scheduled"), false);
  assert.equal(canTransitionTrainingSession("cancelled", "in_progress"), false);
  assert.equal(addUtcMonthsClamped(new Date("2026-01-31T10:30:00.000Z"), 1).toISOString(), "2026-02-28T10:30:00.000Z");
  assert.equal(addUtcMonthsClamped(new Date("2028-01-31T10:30:00.000Z"), 1).toISOString(), "2028-02-29T10:30:00.000Z");
});

test("training migration creates guarded operational tables and indexes", () => {
  const migration = readFileSync("migrations/20260911_driver_training_operations.sql", "utf8");
  for (const table of ["training_sessions", "training_participants", "training_assessments", "training_certificates"]) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
  assert.match(migration, /training_session_dates_chk/);
  assert.match(migration, /training_session_capacity_chk/);
  assert.match(migration, /training_assessment_score_chk/);
  assert.match(migration, /training_certificate_verification_uidx/);
  assert.match(migration, /ON DELETE RESTRICT/);
});

test("training mutations enforce capacity, eligibility, audit, and duplicate-certificate controls", () => {
  const actions = readFileSync("src/app/driver-training/actions.ts", "utf8");
  assert.match(actions, /pg_advisory_xact_lock\(hashtext/);
  assert.match(actions, /session\.capacity/);
  assert.match(actions, /certificateEligible/);
  assert.match(actions, /PASSING_RESULTS/);
  assert.match(actions, /An active certificate already exists/);
  assert.match(actions, /logAudit/);
  assert.match(actions, /canManageTraining/);
  assert.match(actions, /addUtcMonthsClamped/);
});

test("mutable training state changes are serialized inside transactions", () => {
  const actions = readFileSync("src/app/driver-training/actions.ts", "utf8");
  assert.match(actionBlock(actions, "updateTrainingSessionStatus", "addTrainingParticipant"), /db\.transaction/);
  assert.match(actionBlock(actions, "updateTrainingSessionStatus", "addTrainingParticipant"), /pg_advisory_xact_lock/);
  assert.match(actionBlock(actions, "updateTrainingAttendance", "recordTrainingAssessment"), /db\.transaction/);
  assert.match(actionBlock(actions, "updateTrainingAttendance", "recordTrainingAssessment"), /pg_advisory_xact_lock/);
  assert.match(actionBlock(actions, "recordTrainingAssessment", "issueTrainingCertificate"), /pg_advisory_xact_lock/);
});

test("training operations are wired into the enterprise migration and verifier", () => {
  const apply = readFileSync("scripts/apply-enterprise-upgrade.mjs", "utf8");
  const verify = readFileSync("scripts/verify-enterprise-upgrade.mjs", "utf8");
  assert.match(apply, /20260911_driver_training_operations\.sql/);
  assert.match(verify, /training_sessions/);
  assert.match(verify, /training_certificate_verification_uidx/);
});

test("department UI exposes operational workspaces through the streamlined overview", () => {
  const dashboard = readFileSync("src/app/driver-training/page.tsx", "utf8");
  const navigation = readFileSync("src/app/driver-training/DriverTrainingNav.tsx", "utf8");
  const sessions = readFileSync("src/app/driver-training/sessions/page.tsx", "utf8");
  const participants = readFileSync("src/app/driver-training/participants/page.tsx", "utf8");
  const certificates = readFileSync("src/app/driver-training/certificates/page.tsx", "utf8");
  assert.match(dashboard, /Active & upcoming sessions/);
  assert.match(dashboard, />\s*Create\s*</);
  assert.doesNotMatch(dashboard, /Service portfolio/);
  assert.doesNotMatch(dashboard, /Training & assessment services/);
  assert.match(navigation, /label="Operations"/);
  assert.match(navigation, /label="Assessments"/);
  assert.match(sessions, /Schedule session/);
  assert.match(participants, /Training Participants/);
  assert.match(certificates, /Certificate register/);
  assert.match(certificates, /Status, validity and verification\./);
});

test("Driver Training route degrades safely when data or rendering fails", () => {
  const dashboard = readFileSync("src/app/driver-training/page.tsx", "utf8");
  const loading = readFileSync("src/app/driver-training/loading.tsx", "utf8");
  const error = readFileSync("src/app/driver-training/error.tsx", "utf8");
  const navigation = readFileSync("src/app/driver-training/DriverTrainingNav.tsx", "utf8");

  assert.match(dashboard, /Promise\.allSettled/);
  assert.match(dashboard, /Some live metrics are temporarily unavailable/);
  assert.match(loading, /role="status"/);
  assert.match(error, /onClick=\{reset\}/);
  assert.match(error, /\/api\/errors/);
  assert.match(navigation, /onKeyDown=\{handleMoreKeyDown\}/);
  assert.match(navigation, /event\.key !== "Escape"/);
});