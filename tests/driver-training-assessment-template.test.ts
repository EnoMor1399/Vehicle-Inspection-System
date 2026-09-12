import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  calculateDriverAssessment,
  deriveDriverAssessmentOutcome,
  DRIVER_ASSESSMENT_MAX_SCORE,
  DRIVER_ASSESSMENT_SECTIONS,
  DRIVER_ASSESSMENT_TOTAL_CRITERIA,
} from "../src/lib/driver-assessment-template";

test("driver assessment template contains 12 sections, 124 criteria and 620 maximum points", () => {
  assert.equal(DRIVER_ASSESSMENT_SECTIONS.length, 12);
  assert.equal(DRIVER_ASSESSMENT_TOTAL_CRITERIA, 124);
  assert.equal(DRIVER_ASSESSMENT_MAX_SCORE, 620);
  assert.equal(new Set(DRIVER_ASSESSMENT_SECTIONS.map((section) => section.id)).size, 12);

  const criterionIds = DRIVER_ASSESSMENT_SECTIONS.flatMap((section) => section.criteria.map((criterion) => criterion.id));
  assert.equal(new Set(criterionIds).size, criterionIds.length);
});

test("assessment scoring is deterministic and ignores genuinely unrated criteria", () => {
  const allExcellent = Object.fromEntries(
    DRIVER_ASSESSMENT_SECTIONS.flatMap((section) => section.criteria.map((criterion) => [criterion.id, 5])),
  );
  const excellent = calculateDriverAssessment(allExcellent);
  assert.equal(excellent.score, 620);
  assert.equal(excellent.maximum, 620);
  assert.equal(excellent.percentage, 100);
  assert.equal(excellent.classification, "excellent");
  assert.equal(excellent.ratedCriteria, 124);

  const allSatisfactory = Object.fromEntries(
    DRIVER_ASSESSMENT_SECTIONS.flatMap((section) => section.criteria.map((criterion) => [criterion.id, 3])),
  );
  const satisfactory = calculateDriverAssessment(allSatisfactory);
  assert.equal(satisfactory.percentage, 60);
  assert.equal(satisfactory.classification, "needs_improvement");

  const partial = calculateDriverAssessment({ pre_trip_inspection: 4, seatbelt_use: 5 });
  assert.equal(partial.score, 9);
  assert.equal(partial.maximum, 10);
  assert.equal(partial.percentage, 90);
  assert.equal(partial.ratedCriteria, 2);
});

test("critical safety violations override an otherwise competent score", () => {
  const safe = deriveDriverAssessmentOutcome(92, 0);
  assert.equal(safe.result, "competent");
  assert.equal(safe.riskLevel, "low");
  assert.equal(safe.finalRecommendation, "highly_competent");

  const unsafe = deriveDriverAssessmentOutcome(98, 1);
  assert.equal(unsafe.result, "not_yet_competent");
  assert.equal(unsafe.riskLevel, "critical");
  assert.equal(unsafe.finalRecommendation, "unsafe_pending_corrective_action");
});

test("assessment migration preserves structured evidence and governance fields", () => {
  const migration = readFileSync("migrations/20260912_driver_training_assessment_template.sql", "utf8");
  for (const column of [
    "criteria_ratings",
    "criteria_comments",
    "section_scores",
    "scored_points",
    "maximum_points",
    "classification",
    "critical_violations",
    "qualitative_feedback",
    "development_plan",
    "final_recommendation",
    "driver_acknowledged",
    "driver_comments",
  ]) {
    assert.match(migration, new RegExp(column));
  }
  assert.match(migration, /training_assessment_points_chk/);
  assert.match(migration, /training_assessment_classification_idx/);
  assert.match(migration, /training_assessment_recommendation_idx/);

  const apply = readFileSync("scripts/apply-enterprise-upgrade.mjs", "utf8");
  const verify = readFileSync("scripts/verify-enterprise-upgrade.mjs", "utf8");
  assert.match(apply, /20260912_driver_training_assessment_template\.sql/);
  assert.match(verify, /requiredAssessmentColumns/);
  assert.match(verify, /training_assessment_classification_idx/);
  assert.match(verify, /training_assessment_recommendation_idx/);
});

test("trainer assessment action calculates results server-side and serializes participant writes", () => {
  const action = readFileSync("src/app/driver-training/assessments/actions.ts", "utf8");
  assert.match(action, /calculateDriverAssessment/);
  assert.match(action, /deriveDriverAssessmentOutcome/);
  assert.match(action, /pg_advisory_xact_lock\(hashtext/);
  assert.match(action, /0\.75/);
  assert.match(action, /certificateEligible: false/);
  assert.match(action, /reviewStatus: "pending_review"/);
  assert.match(action, /criticalCount === 0/);
  assert.match(action, /assessmentType === "pre_training"/);
  assert.match(action, /logAudit/);
});

test("assessment UI exposes quantitative, qualitative and safety-override controls", () => {
  const page = readFileSync("src/app/driver-training/assessments/page.tsx", "utf8");
  assert.match(page, /Driver Performance Assessment/);
  assert.match(page, /DRIVER_ASSESSMENT_SECTIONS\.map/);
  assert.match(page, /Critical safety violations/);
  assert.match(page, /Qualitative trainer feedback/);
  assert.match(page, /Corrective action \/ development plan/);
  assert.match(page, /Driver acknowledgement/);
  assert.match(page, /Finalize assessment/);

  const nav = readFileSync("src/app/driver-training/DriverTrainingNav.tsx", "utf8");
  assert.match(nav, /href: "\/driver-training\/assessments"/);
});

test("participant workspace routes trainers to the comprehensive assessment instead of the legacy score form", () => {
  const participants = readFileSync("src/app/driver-training/participants/page.tsx", "utf8");
  assert.match(participants, /Comprehensive trainer assessment/);
  assert.match(participants, /href="\/driver-training\/assessments"/);
  assert.doesNotMatch(participants, /recordTrainingAssessment/);
});

test("source-only assessment branch remains excluded from Vercel Git deployment", () => {
  const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
  assert.equal(vercel.git?.deploymentEnabled?.["source-only-driver-assessment-template"], false);
});
