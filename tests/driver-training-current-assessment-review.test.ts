import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("assessment review queue surfaces one current actionable assessment", () => {
  const page = readFileSync("src/app/driver-training/assessments/review/page.tsx", "utf8");

  assert.match(page, /const actionablePending = canReview \? pending\.filter\(\(record\) => record\.assessorId !== user\.id\) : \[\]/);
  assert.match(page, /const currentReview = actionablePending\[actionablePending\.length - 1\] \|\| null/);
  assert.match(page, /Current assessment to review/);
  assert.match(page, /Review current assessment/);
  assert.match(page, /Review the complete section scores, observations, critical violations, trainer feedback and development plan/);
});

test("current review workflow preserves independent-review governance", () => {
  const page = readFileSync("src/app/driver-training/assessments/review/page.tsx", "utf8");

  assert.match(page, /canReviewTrainingAssessments\(user\)/);
  assert.match(page, /record\.assessorId !== user\.id/);
  assert.match(page, /Independent reviewer required/);
  assert.match(page, /Another authorized reviewer must complete the decision/);
  assert.match(page, /Read-only access\. Approval requires a Driver Training account with assessment-review authority/);
});

test("pending review list marks and prioritizes the current assessment", () => {
  const page = readFileSync("src/app/driver-training/assessments/review/page.tsx", "utf8");

  assert.match(page, /currentReview\?\.id === record\.id/);
  assert.match(page, /<Badge tone="amber">Current<\/Badge>/);
  assert.match(page, /isCurrent \? "Review now" : "Review"/);
  assert.match(page, /oldest actionable submission/);
});
