import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  canTransitionTrainingRequest,
  requestSchedulingCapacityIsValid,
  trainingRequestCreateSchema,
  trainingRequestNeedsReviewAttribution,
  trainingRequestScheduleSchema,
} from "../src/lib/training-request-policy";

test("training requests validate known services, client identity and preferred dates", () => {
  const base = {
    requestType: "client",
    serviceId: "defensive-driving",
    title: "Fleet defensive driving programme",
    clientName: "Acme Logistics",
    requestedParticipants: 25,
    deliveryMode: "onsite",
    priority: "high",
    preferredStartDate: "2026-10-01",
    preferredEndDate: "2026-10-03",
  };
  assert.equal(trainingRequestCreateSchema.safeParse(base).success, true);
  assert.equal(trainingRequestCreateSchema.safeParse({ ...base, clientName: "" }).success, false);
  assert.equal(trainingRequestCreateSchema.safeParse({ ...base, preferredEndDate: "2026-09-30" }).success, false);
  assert.equal(trainingRequestCreateSchema.safeParse({ ...base, serviceId: "unknown-service" }).success, false);
  assert.equal(trainingRequestCreateSchema.safeParse({ ...base, deliveryMode: "virtual" }).success, false);
});

test("internal requests do not require client identity", () => {
  const parsed = trainingRequestCreateSchema.safeParse({
    requestType: "internal",
    serviceId: "defensive-driving",
    title: "Internal refresher programme",
    requestedParticipants: 12,
    deliveryMode: "classroom",
    priority: "normal",
  });
  assert.equal(parsed.success, true);
});

test("request lifecycle is controlled and terminal states cannot reopen", () => {
  assert.equal(canTransitionTrainingRequest("draft", "submitted"), true);
  assert.equal(canTransitionTrainingRequest("submitted", "under_review"), true);
  assert.equal(canTransitionTrainingRequest("under_review", "approved"), true);
  assert.equal(canTransitionTrainingRequest("approved", "scheduled"), true);
  assert.equal(canTransitionTrainingRequest("scheduled", "approved"), false);
  assert.equal(canTransitionTrainingRequest("rejected", "under_review"), false);
  assert.equal(canTransitionTrainingRequest("cancelled", "submitted"), false);
});

test("approval and rejection require reviewer attribution", () => {
  assert.equal(trainingRequestNeedsReviewAttribution("approved"), true);
  assert.equal(trainingRequestNeedsReviewAttribution("rejected"), true);
  assert.equal(trainingRequestNeedsReviewAttribution("under_review"), false);
});

test("approved request scheduling uses session-compatible browser datetime parsing and capacity floor", () => {
  const requestId = "d34db33f-0000-4000-8000-000000000020";
  const parsed = trainingRequestScheduleSchema.safeParse({
    requestId,
    startAt: "2026-10-05T08:00",
    endAt: "2026-10-05T16:00",
    capacity: 30,
  });
  assert.equal(parsed.success, true);
  assert.equal(trainingRequestScheduleSchema.safeParse({ requestId, startAt: "2026-10-05T16:00", endAt: "2026-10-05T08:00", capacity: 30 }).success, false);
  assert.equal(requestSchedulingCapacityIsValid(25, 30), true);
  assert.equal(requestSchedulingCapacityIsValid(25, 24), false);
});

test("request actions serialize transitions and one-time session conversion", () => {
  const source = readFileSync("src/app/driver-training/requests/actions.ts", "utf8");
  assert.match(source, /pg_advisory_xact_lock\(hashtext/);
  assert.match(source, /Only approved training requests can be scheduled/);
  assert.match(source, /This training request already has a scheduled session/);
  assert.match(source, /Session capacity cannot be below the requested participant count/);
  assert.match(source, /Rejected training requests require review notes/);
  assert.match(source, /trainingRequestEvents/);
  assert.match(source, /trainingSessions/);
  assert.match(source, /logAudit/);
});

test("request migration enforces submission, review and one-session integrity", () => {
  const migration = readFileSync("migrations/20260911_driver_training_requests.sql", "utf8");
  assert.match(migration, /training_request_submission_chk/);
  assert.match(migration, /training_request_review_chk/);
  assert.match(migration, /training_request_schedule_chk/);
  assert.match(migration, /training_request_scheduled_session_uidx/);
  assert.match(migration, /scheduled_session_id IS NOT NULL/);
  assert.match(migration, /training_request_event_request_created_idx/);
});

test("enterprise migration runner and verifier include request workflow objects", () => {
  const runner = readFileSync("scripts/apply-enterprise-upgrade.mjs", "utf8");
  const verifier = readFileSync("scripts/verify-enterprise-upgrade.mjs", "utf8");
  assert.match(runner, /20260911_driver_training_requests\.sql/);
  assert.match(verifier, /training_requests/);
  assert.match(verifier, /training_request_events/);
  assert.match(verifier, /training_request_scheduled_session_uidx/);
});

test("Driver Training navigation exposes requests workspace and controlled scheduling language", () => {
  const layout = readFileSync("src/app/driver-training/layout.tsx", "utf8");
  const page = readFileSync("src/app/driver-training/requests/page.tsx", "utf8");
  assert.match(layout, /\/driver-training\/requests/);
  assert.match(page, /Training Requests & Delivery Planning/);
  assert.match(page, /Approval and scheduling remain separate controls/);
  assert.match(page, /Schedule approved request/);
  assert.match(page, /Request history/);
});
