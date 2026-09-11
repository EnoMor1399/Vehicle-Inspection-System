import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  canTransitionTrainingDevelopmentAction,
  canTransitionTrainingDevelopmentPlan,
  isTrainingDevelopmentActionOverdue,
  trainingDevelopmentPlanSchema,
} from "../src/lib/training-development-policy";

test("development plans require participant identity and at least one competency gap", () => {
  const base = {
    participantId: "d34db33f-0000-4000-8000-000000000021",
    title: "Defensive driving improvement plan",
    priority: "high",
    competencyGaps: "Hazard anticipation\nSafe following distance",
  };
  assert.equal(trainingDevelopmentPlanSchema.safeParse(base).success, true);
  assert.equal(trainingDevelopmentPlanSchema.safeParse({ ...base, competencyGaps: "" }).success, false);
  assert.equal(trainingDevelopmentPlanSchema.safeParse({ ...base, priority: "extreme" }).success, false);
});

test("development plan lifecycle requires verification before completion", () => {
  assert.equal(canTransitionTrainingDevelopmentPlan("open", "in_progress"), true);
  assert.equal(canTransitionTrainingDevelopmentPlan("in_progress", "verification"), true);
  assert.equal(canTransitionTrainingDevelopmentPlan("verification", "completed"), true);
  assert.equal(canTransitionTrainingDevelopmentPlan("open", "completed"), false);
  assert.equal(canTransitionTrainingDevelopmentPlan("completed", "in_progress"), false);
  assert.equal(canTransitionTrainingDevelopmentPlan("cancelled", "open"), false);
});

test("development action lifecycle is terminal after completion or waiver", () => {
  assert.equal(canTransitionTrainingDevelopmentAction("pending", "in_progress"), true);
  assert.equal(canTransitionTrainingDevelopmentAction("in_progress", "completed"), true);
  assert.equal(canTransitionTrainingDevelopmentAction("pending", "waived"), true);
  assert.equal(canTransitionTrainingDevelopmentAction("completed", "in_progress"), false);
  assert.equal(canTransitionTrainingDevelopmentAction("waived", "completed"), false);
});

test("overdue development actions exclude completed and waived work", () => {
  const now = new Date("2026-09-11T12:00:00Z");
  assert.equal(isTrainingDevelopmentActionOverdue("pending", "2026-09-10", now), true);
  assert.equal(isTrainingDevelopmentActionOverdue("in_progress", "2026-09-10", now), true);
  assert.equal(isTrainingDevelopmentActionOverdue("completed", "2026-09-10", now), false);
  assert.equal(isTrainingDevelopmentActionOverdue("waived", "2026-09-10", now), false);
  assert.equal(isTrainingDevelopmentActionOverdue("pending", "2026-09-20", now), false);
});

test("development actions enforce assessment scope, internal ownership, evidence and controlled verification", () => {
  const source = readFileSync("src/app/driver-training/development/actions.ts", "utf8");
  assert.match(source, /Source assessment must belong to the selected participant/);
  assert.match(source, /Development plan owners must be active internal VIMS users/);
  assert.match(source, /pg_advisory_xact_lock\(hashtext/);
  assert.match(source, /Completed development actions require evidence reference/);
  assert.match(source, /Waived development actions require a reason/);
  assert.match(source, /Add at least one remediation action before verification/);
  assert.match(source, /Complete or waive all remediation actions before verification or closure/);
  assert.match(source, /effectiveness verification summary/);
  assert.match(source, /logAudit/);
});

test("development migration enforces competency, completion and waiver integrity", () => {
  const migration = readFileSync("migrations/20260911_driver_training_development.sql", "utf8");
  assert.match(migration, /training_development_gaps_chk/);
  assert.match(migration, /training_development_completion_chk/);
  assert.match(migration, /training_development_action_completion_chk/);
  assert.match(migration, /training_development_action_waiver_chk/);
  assert.match(migration, /evidence_reference IS NOT NULL/);
  assert.match(migration, /verification_summary IS NOT NULL/);
  assert.match(migration, /training_development_action_due_idx/);
});

test("enterprise migration runner and verifier include development phase", () => {
  const runner = readFileSync("scripts/apply-enterprise-upgrade.mjs", "utf8");
  const verifier = readFileSync("scripts/verify-enterprise-upgrade.mjs", "utf8");
  assert.match(runner, /20260911_driver_training_development\.sql/);
  assert.match(verifier, /training_development_plans/);
  assert.match(verifier, /training_development_actions/);
  assert.match(verifier, /training_development_status_target_idx/);
  assert.match(verifier, /training_development_action_due_idx/);
});

test("Driver Training navigation exposes development workspace and evidence-based closure", () => {
  const layout = readFileSync("src/app/driver-training/DriverTrainingNav.tsx", "utf8");
  const page = readFileSync("src/app/driver-training/development/page.tsx", "utf8");
  assert.match(layout, /\/driver-training\/development/);
  assert.match(page, /Competency Development & Remediation/);
  assert.match(page, /Effectiveness verification/);
  assert.match(page, /Add at least one action before the plan can enter verification/);
  assert.match(page, /Evidence \/ assessment \/ document reference/);
});
