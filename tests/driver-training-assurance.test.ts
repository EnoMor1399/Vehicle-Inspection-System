import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  effectiveTrainingCertificateStatus,
  trainingCertificateRevocationSchema,
  trainingVerificationCodeSchema,
} from "../src/lib/training-policy";

test("training certificate effective status handles active, expired, and revoked records", () => {
  const now = new Date("2026-09-11T12:00:00Z");
  assert.equal(effectiveTrainingCertificateStatus("active", null, now), "active");
  assert.equal(effectiveTrainingCertificateStatus("active", "2026-09-30", now), "active");
  assert.equal(effectiveTrainingCertificateStatus("active", "2026-09-01", now), "expired");
  assert.equal(effectiveTrainingCertificateStatus("revoked", "2030-01-01", now), "revoked");
});

test("public training verification codes are high-entropy fixed-format values", () => {
  assert.equal(trainingVerificationCodeSchema.safeParse("0123456789abcdef0123456789abcdef").success, true);
  assert.equal(trainingVerificationCodeSchema.safeParse("short-code").success, false);
  assert.equal(trainingVerificationCodeSchema.safeParse("0123456789abcdef0123456789abcdeg").success, false);
});

test("certificate revocation requires a bounded reason", () => {
  const id = "d34db33f-0000-4000-8000-000000000010";
  assert.equal(trainingCertificateRevocationSchema.safeParse({ certificateId: id, reason: "Safety breach confirmed" }).success, true);
  assert.equal(trainingCertificateRevocationSchema.safeParse({ certificateId: id, reason: "bad" }).success, false);
  assert.equal(trainingCertificateRevocationSchema.safeParse({ certificateId: id, reason: "x".repeat(2001) }).success, false);
});

test("public training verification discloses only certificate facts", () => {
  const source = readFileSync("src/app/verify/training/[code]/page.tsx", "utf8");
  assert.match(source, /trainingVerificationCodeSchema/);
  assert.match(source, /minimum facts required/);
  assert.match(source, /participantName/);

  // The page may legitimately use generic UI/branding props such as
  // `companyName`. Privacy is enforced by ensuring sensitive participant and
  // certificate fields are never selected from the database query.
  assert.doesNotMatch(source, /driverLicenseNumber\s*:\s*trainingParticipants\.driverLicenseNumber/);
  assert.doesNotMatch(source, /phone\s*:\s*trainingParticipants\.phone/);
  assert.doesNotMatch(source, /email\s*:\s*trainingParticipants\.email/);
  assert.doesNotMatch(source, /companyName\s*:\s*trainingParticipants\.companyName/);
  assert.doesNotMatch(source, /revocationReason\s*:\s*trainingCertificates\.revocationReason/);
});

test("assured certificate issuance enforces completion, renewal, and post-revocation reassessment", () => {
  const source = readFileSync("src/app/driver-training/certificates/actions.ts", "utf8");
  assert.match(source, /session\.status !== "completed"/);
  assert.match(source, /pg_advisory_xact_lock\(hashtext/);
  assert.match(source, /latestRevoked/);
  assert.match(source, /passingAssessment\.assessedAt <= latestRevoked\.revokedAt/);
  assert.match(source, /effectiveTrainingCertificateStatus/);
  assert.match(source, /status: "expired"/);
  assert.match(source, /An active certificate already exists/);
  assert.match(source, /logAudit/);
});

test("training analytics exports neutralize spreadsheet formulas and monitor renewals", () => {
  const actions = readFileSync("src/app/driver-training/analytics/TrainingAnalyticsActions.tsx", "utf8");
  const page = readFileSync("src/app/driver-training/analytics/page.tsx", "utf8");
  assert.match(actions, /neutralizeSpreadsheetFormula/);
  assert.match(actions, /spreadsheetColumnWidth/);
  assert.match(page, /renewalCutoff\.setUTCDate/);
  assert.match(page, /60 days/);
  assert.match(page, /High risk/);
  assert.match(page, /Pass rate/);
});

test("certificate register exposes verification and manager-controlled revocation", () => {
  const source = readFileSync("src/app/driver-training/certificates/page.tsx", "utf8");
  assert.match(source, /issueAssuredTrainingCertificate/);
  assert.match(source, /revokeTrainingCertificate/);
  assert.match(source, /\/verify\/training\//);
  assert.match(source, /effectiveTrainingCertificateStatus/);
});
