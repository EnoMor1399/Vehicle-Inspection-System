import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  calculateAssessmentPerformanceScore,
  calculateTrainingCompositeScore,
  classifyTrainingCompositeScore,
  normalizePercentageScore,
} from "../src/lib/training-composite-score";

test("certificate total performance uses equal weighting across three 100-percent components", () => {
  assert.equal(calculateTrainingCompositeScore({ theoryScore: 90, roadSignScore: 75, assessmentPerformanceScore: 85 }), 83.33);
  assert.equal(calculateTrainingCompositeScore({ theoryScore: 100, roadSignScore: 100, assessmentPerformanceScore: 100 }), 100);
  assert.equal(calculateTrainingCompositeScore({ theoryScore: 0, roadSignScore: 0, assessmentPerformanceScore: 0 }), 0);
});

test("paper and performance scores are bounded to 0 through 100", () => {
  assert.equal(normalizePercentageScore(74.456), 74.46);
  assert.throws(() => normalizePercentageScore(-0.01), /between 0 and 100/);
  assert.throws(() => normalizePercentageScore(100.01), /between 0 and 100/);
  assert.throws(() => normalizePercentageScore(Number.NaN), /between 0 and 100/);
});

test("assessment performance is derived from controlled scored and maximum points", () => {
  assert.equal(calculateAssessmentPerformanceScore(465, 620), 75);
  assert.equal(calculateAssessmentPerformanceScore(620, 620), 100);
  assert.equal(calculateAssessmentPerformanceScore(null, 620), null);
  assert.equal(calculateAssessmentPerformanceScore(100, 0), null);
});

test("composite classification follows the Driver Training performance bands", () => {
  assert.equal(classifyTrainingCompositeScore(95), "excellent");
  assert.equal(classifyTrainingCompositeScore(85), "very_good");
  assert.equal(classifyTrainingCompositeScore(75), "satisfactory");
  assert.equal(classifyTrainingCompositeScore(65), "needs_improvement");
  assert.equal(classifyTrainingCompositeScore(55), "unsatisfactory");
});

test("written exam workspace exposes Theory, Road Signs, Assessment Performance and Total columns", () => {
  const page = readFileSync("src/app/driver-training/assessments/written-exams/page.tsx", "utf8");
  assert.match(page, /Theory score \/100/);
  assert.match(page, /Road Signs score \/100/);
  assert.match(page, /Theory \/100/);
  assert.match(page, /Road Signs \/100/);
  assert.match(page, /Assessment Performance \/100/);
  assert.match(page, /Total Performance \/100/);
  assert.match(page, /\(Theory \+ Road Signs \+ Assessment Performance\) ÷ 3/);
});

test("recording paper scores recalculates the assessment and invalidates any prior certificate approval", () => {
  const action = readFileSync("src/app/driver-training/assessments/written-exams/actions.ts", "utf8");
  assert.match(action, /calculateTrainingCompositeScore/);
  assert.match(action, /deriveDriverAssessmentOutcome/);
  assert.match(action, /roadSignScore: roadSignScore\.toFixed\(2\)/);
  assert.match(action, /practicalScore: assessmentPerformanceScore\.toFixed\(2\)/);
  assert.match(action, /overallScore: totalPerformanceScore\.toFixed\(2\)/);
  assert.match(action, /reviewStatus: "pending_review"/);
  assert.match(action, /certificateEligible: false/);
  assert.match(action, /active certificate/);
});

test("certificate issuance requires all three components and verifies the stored total", () => {
  const action = readFileSync("src/app/driver-training/certificates/actions.ts", "utf8");
  assert.match(action, /roadSignScore: trainingAssessments\.roadSignScore/);
  assert.match(action, /Theory, Road Signs and Assessment Performance scores must be recorded and combined/);
  assert.match(action, /calculateTrainingCompositeScore/);
  assert.match(action, /stored Total Performance score is inconsistent/);
  assert.match(action, /reviewStatus !== "approved"/);
});

test("database migration and schema persist the Road Signs score and protect percentage ranges", () => {
  const schema = readFileSync("src/db/training-schema.ts", "utf8");
  const migration = readFileSync("migrations/20260916_driver_training_composite_scores.sql", "utf8");
  const apply = readFileSync("scripts/apply-enterprise-upgrade.mjs", "utf8");
  const verify = readFileSync("scripts/verify-enterprise-upgrade.mjs", "utf8");

  assert.match(schema, /roadSignScore: numeric\("road_sign_score"/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS road_sign_score numeric\(5,2\)/);
  assert.match(migration, /training_assessment_road_sign_score_chk/);
  assert.match(migration, /equal-weight average of theory, road signs, and assessment performance/);
  assert.match(apply, /20260916_driver_training_composite_scores\.sql/);
  assert.match(verify, /"road_sign_score"/);
});

test("A4 operational report prints all four certificate score lines", () => {
  const page = readFileSync("src/app/driver-training/assessments/[assessmentId]/print/page.tsx", "utf8");
  assert.match(page, /Theory \/100/);
  assert.match(page, /Road Signs \/100/);
  assert.match(page, /Assessment \/100/);
  assert.match(page, /Total \/100/);
  assert.match(page, /assessment\.roadSignScore/);
  assert.match(page, /assessment\.overallScore/);
});
