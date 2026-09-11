import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  calculateTrainingEffectivenessScore,
  canTransitionTrainingQualityFinding,
  feedbackQualitySignal,
  isQualityFindingOverdue,
  trainingFeedbackSchema,
  trainingQualityClosureSchema,
} from "../src/lib/training-quality-policy";

test("training effectiveness score converts valid five-point ratings to percentage", () => {
  assert.equal(calculateTrainingEffectivenessScore([5, 5, 4, 4, 5]), 92);
  assert.equal(calculateTrainingEffectivenessScore([1, 2, 3, 4, 5]), 60);
  assert.equal(calculateTrainingEffectivenessScore([]), 0);
});

test("serious overall or safety feedback escalates quality signal", () => {
  assert.equal(feedbackQualitySignal(5, 5), "low");
  assert.equal(feedbackQualitySignal(3, 5), "medium");
  assert.equal(feedbackQualitySignal(2, 5), "high");
  assert.equal(feedbackQualitySignal(5, 1), "critical");
});

test("feedback schema bounds every rating from one to five", () => {
  const sessionId = "d34db33f-0000-4000-8000-000000000014";
  const base = { sessionId, respondentType: "participant", contentRating: 5, instructorRating: 5, practicalRating: 4, safetyRating: 5, overallRating: 5, wouldRecommend: "yes", anonymous: false };
  assert.equal(trainingFeedbackSchema.safeParse(base).success, true);
  assert.equal(trainingFeedbackSchema.safeParse({ ...base, safetyRating: 0 }).success, false);
  assert.equal(trainingFeedbackSchema.safeParse({ ...base, overallRating: 6 }).success, false);
});

test("quality finding lifecycle requires verification before closure", () => {
  assert.equal(canTransitionTrainingQualityFinding("open", "in_progress"), true);
  assert.equal(canTransitionTrainingQualityFinding("in_progress", "verification"), true);
  assert.equal(canTransitionTrainingQualityFinding("verification", "closed"), true);
  assert.equal(canTransitionTrainingQualityFinding("open", "closed"), false);
  assert.equal(canTransitionTrainingQualityFinding("closed", "in_progress"), false);
});

test("controlled closure requires root cause, action plan, evidence and effectiveness review", () => {
  const findingId = "d34db33f-0000-4000-8000-000000000015";
  assert.equal(trainingQualityClosureSchema.safeParse({ findingId, rootCause: "Procedure gap", actionPlan: "Revise module", closureEvidence: "QA-REF-101", effectivenessReview: "Follow-up score improved" }).success, true);
  assert.equal(trainingQualityClosureSchema.safeParse({ findingId, rootCause: "Procedure gap", actionPlan: "Revise module", closureEvidence: "", effectivenessReview: "Follow-up score improved" }).success, false);
});

test("overdue quality finding excludes closed and dismissed states", () => {
  const now = new Date("2026-09-11T12:00:00Z");
  assert.equal(isQualityFindingOverdue("open", "2026-09-10", now), true);
  assert.equal(isQualityFindingOverdue("closed", "2026-09-10", now), false);
  assert.equal(isQualityFindingOverdue("dismissed", "2026-09-10", now), false);
  assert.equal(isQualityFindingOverdue("open", "2026-09-20", now), false);
});

test("quality actions enforce session scope, serious feedback escalation and controlled closure", () => {
  const source = readFileSync("src/app/driver-training/quality/actions.ts", "utf8");
  assert.match(source, /participant\.sessionId !== sessionId/);
  assert.match(source, /in-progress or completed sessions/);
  assert.match(source, /signal === "high" \|\| signal === "critical"/);
  assert.match(source, /Quality action owners must be active internal VIMS users/);
  assert.match(source, /pg_advisory_xact_lock\(hashtext/);
  assert.match(source, /Move the finding to verification before controlled closure/);
  assert.match(source, /closureEvidence/);
  assert.match(source, /effectivenessReview/);
  assert.match(source, /logAudit/);
});

test("quality migration enforces rating, state and closure integrity", () => {
  const migration = readFileSync("migrations/20260911_driver_training_quality.sql", "utf8");
  assert.match(migration, /training_feedback_ratings_chk/);
  assert.match(migration, /training_quality_status_chk/);
  assert.match(migration, /training_quality_closure_chk/);
  assert.match(migration, /root_cause IS NOT NULL/);
  assert.match(migration, /closure_evidence IS NOT NULL/);
  assert.match(migration, /effectiveness_review IS NOT NULL/);
  assert.match(migration, /training_quality_event_finding_created_idx/);
});

test("enterprise migration runner and verifier include quality phase", () => {
  const runner = readFileSync("scripts/apply-enterprise-upgrade.mjs", "utf8");
  const verifier = readFileSync("scripts/verify-enterprise-upgrade.mjs", "utf8");
  assert.match(runner, /20260911_driver_training_quality\.sql/);
  assert.match(verifier, /training_session_feedback/);
  assert.match(verifier, /training_quality_findings/);
  assert.match(verifier, /training_quality_events/);
  assert.match(verifier, /training_quality_status_due_idx/);
});

test("Driver Training navigation exposes quality workspace and page explains controlled closure", () => {
  const layout = readFileSync("src/app/driver-training/DriverTrainingNav.tsx", "utf8");
  const page = readFileSync("src/app/driver-training/quality/page.tsx", "utf8");
  assert.match(layout, /\/driver-training\/quality/);
  assert.match(page, /Training Quality & Corrective Action/);
  assert.match(page, /automatically raise a quality finding/);
  assert.match(page, /Closure is allowed only from verification/);
  assert.match(page, /Effectiveness review/);
});
