import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildTrainingComplianceReminder,
  canTransitionTrainingComplianceCase,
  deriveTrainingCompliancePriority,
  trainingComplianceCaseSchema,
  trainingComplianceContactSchema,
} from "../src/lib/training-policy";

const PARTICIPANT_ID = "d34db33f-0000-4000-8000-000000000020";
const CERTIFICATE_ID = "d34db33f-0000-4000-8000-000000000021";
const CASE_ID = "d34db33f-0000-4000-8000-000000000022";

test("training compliance validation bounds case and contact input", () => {
  assert.equal(trainingComplianceCaseSchema.safeParse({
    participantId: PARTICIPANT_ID,
    certificateId: CERTIFICATE_ID,
    caseType: "renewal",
    priority: "high",
    dueDate: "2026-09-30",
    preferredChannel: "email",
  }).success, true);

  assert.equal(trainingComplianceCaseSchema.safeParse({
    participantId: PARTICIPANT_ID,
    caseType: "unknown",
    priority: "urgent",
    preferredChannel: "telegram",
  }).success, false);

  assert.equal(trainingComplianceContactSchema.safeParse({
    caseId: CASE_ID,
    channel: "phone",
    summary: "Participant confirmed refresher booking arrangements.",
    nextFollowUpDate: "2026-09-20",
  }).success, true);
  assert.equal(trainingComplianceContactSchema.safeParse({
    caseId: CASE_ID,
    channel: "phone",
    summary: "x".repeat(4001),
  }).success, false);
});

test("compliance priority escalates overdue, near-due, reassessment and operator risk cases", () => {
  const now = new Date("2026-09-11T12:00:00Z");
  assert.equal(deriveTrainingCompliancePriority("renewal", "2026-09-01", null, now), "critical");
  assert.equal(deriveTrainingCompliancePriority("renewal", "2026-09-20", null, now), "high");
  assert.equal(deriveTrainingCompliancePriority("renewal", "2026-10-15", null, now), "medium");
  assert.equal(deriveTrainingCompliancePriority("renewal", "2026-12-31", null, now), "low");
  assert.equal(deriveTrainingCompliancePriority("reassessment", null, null, now), "high");
  assert.equal(deriveTrainingCompliancePriority("high_risk", null, "high", now), "high");
  assert.equal(deriveTrainingCompliancePriority("high_risk", null, "critical", now), "critical");
});

test("compliance lifecycle prevents reopening terminal cases", () => {
  assert.equal(canTransitionTrainingComplianceCase("open", "contacted"), true);
  assert.equal(canTransitionTrainingComplianceCase("open", "scheduled"), true);
  assert.equal(canTransitionTrainingComplianceCase("contacted", "resolved"), true);
  assert.equal(canTransitionTrainingComplianceCase("scheduled", "contacted"), true);
  assert.equal(canTransitionTrainingComplianceCase("resolved", "open"), false);
  assert.equal(canTransitionTrainingComplianceCase("dismissed", "scheduled"), false);
});

test("prepared reminder text is bounded and describes action without claiming delivery", () => {
  const reminder = buildTrainingComplianceReminder({
    participantName: "Test Operator",
    caseType: "renewal",
    serviceTitle: "Defensive Driving Training",
    certificateNumber: "DTA-2026-TEST",
    dueDate: "2026-09-30",
  });
  assert.match(reminder, /Test Operator/);
  assert.match(reminder, /Defensive Driving Training/);
  assert.match(reminder, /due by 2026-09-30/);
  assert.ok(reminder.length <= 1000);
  assert.doesNotMatch(reminder, /sent successfully|message sent|delivered successfully/i);
});

test("compliance migration provides constrained case history and duplicate backstop", () => {
  const migration = readFileSync("migrations/20260911_driver_training_compliance.sql", "utf8");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS training_compliance_cases/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS training_compliance_events/);
  assert.match(migration, /training_compliance_case_type_chk/);
  assert.match(migration, /training_compliance_status_chk/);
  assert.match(migration, /training_compliance_event_summary_chk/);
  assert.match(migration, /training_compliance_active_case_uidx/);
  assert.match(migration, /WHERE status IN \('open', 'contacted', 'scheduled'\)/);
  assert.match(migration, /training_compliance_status_due_idx/);
});

test("enterprise upgrade runner and verifier include training compliance objects", () => {
  const runner = readFileSync("scripts/apply-enterprise-upgrade.mjs", "utf8");
  const verifier = readFileSync("scripts/verify-enterprise-upgrade.mjs", "utf8");
  assert.match(runner, /20260911_driver_training_compliance\.sql/);
  assert.match(verifier, /training_compliance_cases/);
  assert.match(verifier, /training_compliance_events/);
  assert.match(verifier, /training_compliance_active_case_uidx/);
  assert.match(verifier, /training_compliance_event_case_created_idx/);
});

test("compliance actions serialize duplicates, atomically count contacts, audit changes and never send reminders", () => {
  const source = readFileSync("src/app/driver-training/compliance/actions.ts", "utf8");
  assert.match(source, /pg_advisory_xact_lock\(hashtext/);
  assert.match(source, /inArray\(trainingComplianceCases\.status/);
  assert.match(source, /contactCount:\s*sql<number>/);
  assert.match(source, /trainingComplianceCases\.contactCount\} \+ 1/);
  assert.match(source, /eventType: "reminder_prepared"/);
  assert.match(source, /no external message sent/);
  assert.match(source, /logAudit/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
});

test("compliance workspace exposes renewal, licence and high-risk queues with draft-only reminders", () => {
  const source = readFileSync("src/app/driver-training/compliance/page.tsx", "utf8");
  assert.match(source, /Certificate renewal queue/);
  assert.match(source, /within 60 days/);
  assert.match(source, /Driving-licence watch/);
  assert.match(source, /within 30 days/);
  assert.match(source, /High-risk operator queue/);
  assert.match(source, /Prepare only/);
  assert.match(source, /does not send email, SMS, WhatsApp, or calls/);
  assert.match(source, /Track case/);
});

test("participant dossier and department navigation expose compliance history without global-sidebar noise", () => {
  const dossier = readFileSync("src/app/driver-training/participants/[id]/page.tsx", "utf8");
  const layout = readFileSync("src/app/driver-training/layout.tsx", "utf8");
  assert.match(dossier, /Assessment history/);
  assert.match(dossier, /Certificate history/);
  assert.match(dossier, /Compliance case history/);
  assert.match(dossier, /canViewTraining/);
  assert.match(layout, /\/driver-training\/compliance/);
  assert.match(layout, /\/driver-training\/analytics/);
  assert.match(layout, /Driver Training workspaces/);
});
