import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  attendanceSignoffState,
  calculateAttendanceMinutes,
  evidenceIntegrityState,
  trainingAttendanceConfirmationSchema,
  trainingEvidenceRecordSchema,
  trainingEvidenceVerificationSchema,
} from "../src/lib/training-evidence-policy";

test("attendance duration is bounded and rejects invalid chronology", () => {
  assert.equal(calculateAttendanceMinutes("2026-09-11T08:00:00Z", "2026-09-11T09:30:00Z"), 90);
  assert.equal(calculateAttendanceMinutes("2026-09-11T09:30:00Z", "2026-09-11T08:00:00Z"), 0);
  assert.equal(calculateAttendanceMinutes(null, "2026-09-11T09:30:00Z"), 0);
});

test("attendance state distinguishes check-in, sign-off, confirmation and disputes", () => {
  assert.equal(attendanceSignoffState({}), "not_started");
  assert.equal(attendanceSignoffState({ checkInAt: "2026-09-11T08:00:00Z" }), "checked_in");
  assert.equal(attendanceSignoffState({ checkInAt: "2026-09-11T08:00:00Z", checkOutAt: "2026-09-11T09:00:00Z" }), "awaiting_signoff");
  assert.equal(attendanceSignoffState({ checkInAt: "2026-09-11T08:00:00Z", checkOutAt: "2026-09-11T09:00:00Z", participantAcknowledged: true, instructorConfirmed: true }), "ready_to_confirm");
  assert.equal(attendanceSignoffState({ status: "confirmed" }), "confirmed");
  assert.equal(attendanceSignoffState({ status: "disputed" }), "disputed");
});

test("attendance confirmation requires both participant acknowledgement and instructor confirmation", () => {
  const participantId = "d34db33f-0000-4000-8000-000000000011";
  assert.equal(trainingAttendanceConfirmationSchema.safeParse({ participantId, participantAcknowledged: true, instructorConfirmed: true }).success, true);
  assert.equal(trainingAttendanceConfirmationSchema.safeParse({ participantId, participantAcknowledged: false, instructorConfirmed: true }).success, false);
  assert.equal(trainingAttendanceConfirmationSchema.safeParse({ participantId, participantAcknowledged: true, instructorConfirmed: false }).success, false);
});

test("evidence records validate fingerprints and rejected evidence requires a reason", () => {
  const sessionId = "d34db33f-0000-4000-8000-000000000012";
  const validDigest = "a".repeat(64);
  assert.equal(trainingEvidenceRecordSchema.safeParse({ sessionId, evidenceType: "assessment_sheet", title: "Practical assessment sheet", reference: "DOC-2026-001", sha256: validDigest }).success, true);
  assert.equal(trainingEvidenceRecordSchema.safeParse({ sessionId, evidenceType: "assessment_sheet", title: "Practical assessment sheet", reference: "DOC-2026-001", sha256: "bad" }).success, false);
  assert.equal(evidenceIntegrityState(validDigest), "fingerprinted");
  assert.equal(evidenceIntegrityState(null), "reference_only");

  const evidenceId = "d34db33f-0000-4000-8000-000000000013";
  assert.equal(trainingEvidenceVerificationSchema.safeParse({ evidenceId, status: "verified" }).success, true);
  assert.equal(trainingEvidenceVerificationSchema.safeParse({ evidenceId, status: "rejected", reviewNotes: "" }).success, false);
  assert.equal(trainingEvidenceVerificationSchema.safeParse({ evidenceId, status: "rejected", reviewNotes: "Reference does not match the approved record" }).success, true);
});

test("attendance actions serialize writes and keep confirmation atomic", () => {
  const source = readFileSync("src/app/driver-training/evidence/actions.ts", "utf8");
  assert.match(source, /pg_advisory_xact_lock\(hashtext/);
  assert.match(source, /Check-in and check-out must both be recorded/);
  assert.match(source, /participantAcknowledged: true/);
  assert.match(source, /instructorConfirmed: true/);
  assert.match(source, /attendanceStatus: "attended"/);
  assert.match(source, /attendanceStatus: "registered"/);
  assert.match(source, /participant\.sessionId !== data\.sessionId/);
  assert.match(source, /This evidence reference is already registered/);
  assert.match(source, /logAudit/);
  assert.doesNotMatch(source, /trainingCertificates/);
  assert.doesNotMatch(source, /issueAssuredTrainingCertificate/);
});

test("evidence migration has database integrity backstops", () => {
  const migration = readFileSync("migrations/20260911_driver_training_evidence.sql", "utf8");
  assert.match(migration, /training_attendance_participant_session_uidx/);
  assert.match(migration, /training_evidence_scope_reference_uidx/);
  assert.match(migration, /training_attendance_confirmation_chk/);
  assert.match(migration, /training_evidence_sha256_chk/);
  assert.match(migration, /training_evidence_rejection_reason_chk/);
  assert.match(migration, /participant_acknowledged = true/);
  assert.match(migration, /instructor_confirmed = true/);
});

test("enterprise migration runner and verifier include the evidence phase", () => {
  const runner = readFileSync("scripts/apply-enterprise-upgrade.mjs", "utf8");
  const verifier = readFileSync("scripts/verify-enterprise-upgrade.mjs", "utf8");
  assert.match(runner, /20260911_driver_training_evidence\.sql/);
  assert.match(verifier, /training_attendance_signoffs/);
  assert.match(verifier, /training_evidence_records/);
  assert.match(verifier, /training_evidence_scope_reference_uidx/);
});

test("Driver Training navigation exposes the evidence workspace", () => {
  const layout = readFileSync("src/app/driver-training/DriverTrainingNav.tsx", "utf8");
  const page = readFileSync("src/app/driver-training/evidence/page.tsx", "utf8");
  assert.match(layout, /\/driver-training\/evidence/);
  assert.match(page, /Attendance & Evidence/);
  assert.match(page, /Participant acknowledgement captured/);
  assert.match(page, /SHA-256 fingerprint/);
  assert.match(page, /does not itself establish competence/);
});
