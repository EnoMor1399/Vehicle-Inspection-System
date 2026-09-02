import test from "node:test";
import assert from "node:assert/strict";
import { getInspectionDecisionGuidance } from "../src/lib/inspection-decision";

test("clean inspection keeps PASS available", () => {
  const guidance = getInspectionDecisionGuidance({
    failCount: 0,
    majorCount: 0,
    criticalCount: 0,
    smokeTest: "pass",
  });

  assert.equal(guidance.passAllowed, true);
  assert.equal(guidance.conditionalPassAllowed, true);
  assert.equal(guidance.recommendedResult, "pass");
});

test("minor checklist failures block PASS and recommend conditional pass", () => {
  const guidance = getInspectionDecisionGuidance({
    failCount: 1,
    majorCount: 0,
    criticalCount: 0,
    smokeTest: "pass",
  });

  assert.equal(guidance.passAllowed, false);
  assert.equal(guidance.conditionalPassAllowed, true);
  assert.equal(guidance.recommendedResult, "conditional_pass");
});

test("major defects recommend re-inspection while preserving stricter manual outcomes", () => {
  const guidance = getInspectionDecisionGuidance({
    failCount: 2,
    majorCount: 1,
    criticalCount: 0,
    smokeTest: "pass",
  });

  assert.equal(guidance.passAllowed, false);
  assert.equal(guidance.conditionalPassAllowed, true);
  assert.equal(guidance.recommendedResult, "reinspection_required");
});

test("critical defects disable PASS and conditional pass", () => {
  const guidance = getInspectionDecisionGuidance({
    failCount: 1,
    majorCount: 0,
    criticalCount: 1,
    smokeTest: "pass",
  });

  assert.equal(guidance.passAllowed, false);
  assert.equal(guidance.conditionalPassAllowed, false);
  assert.equal(guidance.recommendedResult, "reinspection_required");
});

test("failed smoke test blocks PASS and recommends re-inspection", () => {
  const guidance = getInspectionDecisionGuidance({
    failCount: 0,
    majorCount: 0,
    criticalCount: 0,
    smokeTest: "fail",
  });

  assert.equal(guidance.passAllowed, false);
  assert.equal(guidance.recommendedResult, "reinspection_required");
});
