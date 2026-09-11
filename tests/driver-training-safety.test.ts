import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  calculateTrainingSafetyRiskScore,
  canApproveTrainingRiskAssessment,
  canTransitionTrainingSafetyIncident,
  safetyIncidentRequiresStopWork,
  trainingSafetyIncidentClosureReady,
  trainingSafetyRiskLevel,
} from "../src/lib/training-safety-policy";

test("5x5 training safety risk scoring is bounded and classifies risk", () => {
  assert.equal(calculateTrainingSafetyRiskScore(1, 1), 1);
  assert.equal(calculateTrainingSafetyRiskScore(5, 5), 25);
  assert.equal(calculateTrainingSafetyRiskScore(0, 5), null);
  assert.equal(calculateTrainingSafetyRiskScore(6, 1), null);
  assert.equal(trainingSafetyRiskLevel(4), "low");
  assert.equal(trainingSafetyRiskLevel(8), "medium");
  assert.equal(trainingSafetyRiskLevel(15), "high");
  assert.equal(trainingSafetyRiskLevel(25), "critical");
});

test("risk assessment approval requires scheduled session, controlled hazards and acceptable residual risk", () => {
  const base = { sessionStatus: "scheduled", stopWorkRequired: false, hazardCount: 3, openHazardCount: 0, maxResidualRiskScore: 9 };
  assert.equal(canApproveTrainingRiskAssessment(base), true);
  assert.equal(canApproveTrainingRiskAssessment({ ...base, sessionStatus: "in_progress" }), false);
  assert.equal(canApproveTrainingRiskAssessment({ ...base, hazardCount: 0 }), false);
  assert.equal(canApproveTrainingRiskAssessment({ ...base, openHazardCount: 1 }), false);
  assert.equal(canApproveTrainingRiskAssessment({ ...base, maxResidualRiskScore: 13 }), false);
});

test("serious safety events automatically require stop-work control", () => {
  assert.equal(safetyIncidentRequiresStopWork("critical", "near_miss"), true);
  assert.equal(safetyIncidentRequiresStopWork("high", "unsafe_condition"), true);
  assert.equal(safetyIncidentRequiresStopWork("low", "injury"), true);
  assert.equal(safetyIncidentRequiresStopWork("low", "equipment_failure"), true);
  assert.equal(safetyIncidentRequiresStopWork("low", "near_miss"), false);
});

test("incident lifecycle requires investigation, corrective action and verification before closure", () => {
  assert.equal(canTransitionTrainingSafetyIncident("open", "investigating"), true);
  assert.equal(canTransitionTrainingSafetyIncident("investigating", "corrective_action"), true);
  assert.equal(canTransitionTrainingSafetyIncident("corrective_action", "verification"), true);
  assert.equal(canTransitionTrainingSafetyIncident("verification", "closed"), true);
  assert.equal(canTransitionTrainingSafetyIncident("open", "closed"), false);
  assert.equal(canTransitionTrainingSafetyIncident("closed", "investigating"), false);
});

test("incident closure requires verification plus root cause, corrective actions, evidence and closure review", () => {
  const base = { status: "verification", rootCause: "Inadequate exclusion zone", correctiveActions: "Revised practical exercise controls", evidenceReference: "SAFE-2026-101", closureReview: "Controls observed effective during follow-up" };
  assert.equal(trainingSafetyIncidentClosureReady(base), true);
  assert.equal(trainingSafetyIncidentClosureReady({ ...base, evidenceReference: "" }), false);
  assert.equal(trainingSafetyIncidentClosureReady({ ...base, status: "corrective_action" }), false);
});

test("safety actions enforce session scope, advisory locks, residual-risk approval and controlled closure", () => {
  const source = readFileSync("src/app/driver-training/safety/actions.ts", "utf8");
  assert.match(source, /Risk assessments can only be created for scheduled training sessions/);
  assert.match(source, /This training session already has a risk assessment/);
  assert.match(source, /Safety action owners must be active internal VIMS users/);
  assert.match(source, /Selected participant does not belong to this training session/);
  assert.match(source, /pg_advisory_xact_lock\(hashtext/);
  assert.match(source, /residual risk is acceptable/);
  assert.match(source, /safetyIncidentRequiresStopWork/);
  assert.match(source, /verification status, root cause, corrective actions, evidence, and closure review/);
  assert.match(source, /logAudit/);
});

test("safety migration backstops scores, approval, stop-work and incident closure", () => {
  const migration = readFileSync("migrations/20260911_driver_training_safety.sql", "utf8");
  assert.match(migration, /training_risk_assessment_approval_chk/);
  assert.match(migration, /training_safety_hazard_score_chk/);
  assert.match(migration, /initial_risk_score = likelihood \* severity/);
  assert.match(migration, /training_safety_incident_stop_work_chk/);
  assert.match(migration, /incident_type NOT IN \('injury', 'equipment_failure'\)/);
  assert.match(migration, /training_safety_incident_closure_chk/);
  assert.match(migration, /training_safety_incident_session_status_idx/);
});

test("enterprise migration runner and verifier include safety governance phase", () => {
  const runner = readFileSync("scripts/apply-enterprise-upgrade.mjs", "utf8");
  const verifier = readFileSync("scripts/verify-enterprise-upgrade.mjs", "utf8");
  assert.match(runner, /20260911_driver_training_safety\.sql/);
  assert.match(verifier, /training_risk_assessments/);
  assert.match(verifier, /training_safety_hazards/);
  assert.match(verifier, /training_safety_incidents/);
  assert.match(verifier, /training_safety_incident_number_uidx/);
});

test("Driver Training navigation exposes safety workspace and explicit readiness boundary", () => {
  const layout = readFileSync("src/app/driver-training/layout.tsx", "utf8");
  const page = readFileSync("src/app/driver-training/safety/page.tsx", "utf8");
  assert.match(layout, /\/driver-training\/safety/);
  assert.match(page, /Training Safety, Risk & Incidents/);
  assert.match(page, /does not silently mark the separate readiness checklist complete/);
  assert.match(page, /STOP WORK/);
  assert.match(page, /Safety events move through investigation/);
});
