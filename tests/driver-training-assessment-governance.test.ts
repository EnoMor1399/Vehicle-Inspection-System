import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canReviewTrainingAssessments } from "../src/lib/training-access";

test("assessment review permission requires Driver Training assignment and an independent supervisory role", () => {
  assert.equal(canReviewTrainingAssessments({ role: "super_admin" }), true, "Super Administrator keeps cross-system oversight");
  for (const role of ["admin", "operations_manager", "supervisor"]) {
    assert.equal(
      canReviewTrainingAssessments({ role, permissions: { training: true } }),
      true,
      `${role} assigned to Driver Training should review assessments`,
    );
    assert.equal(
      canReviewTrainingAssessments({ role, permissions: { training: false } }),
      false,
      `${role} assigned only to Vehicle Inspection should not review assessments`,
    );
  }
  for (const role of ["inspector", "data_entry", "auditor", "compliance_officer", "viewer"]) {
    assert.equal(
      canReviewTrainingAssessments({ role, permissions: { training: true } }),
      false,
      `${role} should not review by default even when assigned to Driver Training`,
    );
  }
  assert.equal(canReviewTrainingAssessments({ role: "inspector", permissions: { training: true, training_assessment_review: true } }), true);
  assert.equal(canReviewTrainingAssessments({ role: "supervisor", permissions: { training: true, training_assessment_review: false } }), false);
});

test("assessment governance migration adds reviewer controls and indexes", () => {
  const migration = readFileSync("migrations/20260912_driver_training_assessment_governance.sql", "utf8");
  for (const field of ["review_status", "reviewer_id", "review_comments", "reviewed_at"]) {
    assert.match(migration, new RegExp(field));
  }
  assert.match(migration, /pending_review/);
  assert.match(migration, /approved/);
  assert.match(migration, /returned/);
  assert.match(migration, /training_assessment_review_status_chk/);
  assert.match(migration, /training_assessment_review_status_idx/);
  assert.match(migration, /training_assessment_reviewer_idx/);

  const apply = readFileSync("scripts/apply-enterprise-upgrade.mjs", "utf8");
  assert.match(apply, /20260912_driver_training_assessment_governance\.sql/);

  const verify = readFileSync("scripts/verify-enterprise-upgrade.mjs", "utf8");
  assert.match(verify, /"review_status"/);
  assert.match(verify, /"reviewer_id"/);
  assert.match(verify, /training_assessment_review_status_idx/);
  assert.match(verify, /training_assessment_reviewer_idx/);
});

test("trainer submission cannot unlock certification before independent review", () => {
  const action = readFileSync("src/app/driver-training/assessments/actions.ts", "utf8");
  assert.match(action, /reviewStatus: "pending_review"/);
  assert.match(action, /assessmentStatus: "assessed"/);
  assert.match(action, /certificateEligible: false/);
  assert.match(action, /submitted for independent review/);
  assert.match(action, /redirect\(`\/driver-training\/assessments\/\$\{id\}`\)/);
});

test("review action prevents self-review, stale approval and duplicate decisions", () => {
  const action = readFileSync("src/app/driver-training/assessments/actions.ts", "utf8");
  assert.match(action, /export async function reviewDriverAssessment/);
  assert.match(action, /canReviewTrainingAssessments/);
  assert.match(action, /pg_advisory_xact_lock\(hashtext/);
  assert.match(action, /assessment\.reviewStatus !== "pending_review"/);
  assert.match(action, /assessment\.assessorId === user\.id/);
  assert.match(action, /Assessors cannot approve or return their own assessment/);
  assert.match(action, /A newer assessment exists for this driver/);
  assert.match(action, /orderBy\(desc\(trainingAssessments\.assessedAt\), desc\(trainingAssessments\.createdAt\)\)/);
});

test("review approval controls final competency and certificate eligibility", () => {
  const action = readFileSync("src/app/driver-training/assessments/actions.ts", "utf8");
  assert.match(action, /decision === "approved"/);
  assert.match(action, /criticalCount === 0/);
  assert.match(action, /assessment\.riskLevel !== "critical"/);
  assert.match(action, /participantAssessmentStatus/);
  assert.match(action, /decision === "returned" \|\| isBaseline/);
  assert.match(action, /action: decision === "approved" \? "approve" : "reject"/);
});

test("assessment record exposes evidence, printing and supervisor decision UI", () => {
  const page = readFileSync("src/app/driver-training/assessments/[assessmentId]/page.tsx", "utf8");
  assert.match(page, /Driver Assessment Record/);
  assert.match(page, /DRIVER_ASSESSMENT_SECTIONS\.map/);
  assert.match(page, /Critical Violations/);
  assert.match(page, /Trainer Feedback/);
  assert.match(page, /Development & Acknowledgement/);
  assert.match(page, /Review Decision/);
  assert.match(page, /Approve Assessment/);
  assert.match(page, /Return for Correction/);
  assert.match(page, /Independent review required/);
  assert.match(page, /Assessors cannot review their own assessment/);
  assert.match(page, /assessment\.assessorId !== user\.id/);

  const printButton = readFileSync("src/app/driver-training/assessments/[assessmentId]/PrintAssessmentButton.tsx", "utf8");
  assert.match(printButton, /window\.print\(\)/);
  assert.match(printButton, /print:hidden/);
});

test("review queue is discoverable from the compact Driver Training navigation", () => {
  const queue = readFileSync("src/app/driver-training/assessments/review/page.tsx", "utf8");
  assert.match(queue, /Assessment Review/);
  assert.match(queue, /pending_review/);
  assert.match(queue, /Pending reviews/);
  assert.match(queue, /require another reviewer/);

  const nav = readFileSync("src/app/driver-training/DriverTrainingNav.tsx", "utf8");
  assert.match(nav, /\/driver-training\/assessments\/review/);
  assert.match(nav, /label: "Review queue"/);
  assert.match(nav, /label="Assessments"/);
});

test("assessment governance branch remains excluded from Vercel Git deployment", () => {
  const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
  assert.equal(vercel.git?.deploymentEnabled?.["source-only-driver-assessment-governance"], false);
});
