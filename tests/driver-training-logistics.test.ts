import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  canAllocateTrainingResource,
  canTransitionTrainingResourceAllocation,
  rangesOverlap,
  resourceDemandFits,
  trainingResourceOperationalState,
  trainingResourceSchema,
} from "../src/lib/training-logistics-policy";

test("exclusive resources must represent one bookable unit", () => {
  const base = {
    resourceCode: "TRV-001",
    name: "Defensive Driving Vehicle 1",
    resourceType: "vehicle",
    status: "available",
    isExclusive: true,
    availableQuantity: 1,
    capacity: 5,
  };
  assert.equal(trainingResourceSchema.safeParse(base).success, true);
  assert.equal(trainingResourceSchema.safeParse({ ...base, availableQuantity: 2 }).success, false);
  assert.equal(trainingResourceSchema.safeParse({ ...base, resourceType: "unknown" }).success, false);
});

test("resource overlap uses half-open delivery windows", () => {
  const aStart = new Date("2026-09-20T08:00:00Z");
  const aEnd = new Date("2026-09-20T10:00:00Z");
  assert.equal(rangesOverlap(aStart, aEnd, new Date("2026-09-20T09:00:00Z"), new Date("2026-09-20T11:00:00Z")), true);
  assert.equal(rangesOverlap(aStart, aEnd, new Date("2026-09-20T10:00:00Z"), new Date("2026-09-20T12:00:00Z")), false);
});

test("resource demand blocks exclusive overlap and enforces shared stock", () => {
  assert.equal(resourceDemandFits({ isExclusive: true, availableQuantity: 1, requestedQuantity: 1, concurrentQuantities: [] }), true);
  assert.equal(resourceDemandFits({ isExclusive: true, availableQuantity: 1, requestedQuantity: 1, concurrentQuantities: [1] }), false);
  assert.equal(resourceDemandFits({ isExclusive: false, availableQuantity: 10, requestedQuantity: 4, concurrentQuantities: [3, 2] }), true);
  assert.equal(resourceDemandFits({ isExclusive: false, availableQuantity: 10, requestedQuantity: 6, concurrentQuantities: [3, 2] }), false);
});

test("resource operational state blocks expired, maintenance and retired assets", () => {
  const now = new Date("2026-09-11T12:00:00Z");
  assert.equal(trainingResourceOperationalState({ status: "available" }, now), "ready");
  assert.equal(trainingResourceOperationalState({ status: "available", serviceDueDate: "2026-09-30" }, now), "attention");
  assert.equal(trainingResourceOperationalState({ status: "available", inspectionDueDate: "2026-09-10" }, now), "overdue");
  assert.equal(trainingResourceOperationalState({ status: "maintenance" }, now), "blocked");
  assert.equal(trainingResourceOperationalState({ status: "retired" }, now), "retired");
});

test("only scheduled sessions receive new usable resource reservations", () => {
  assert.equal(canAllocateTrainingResource("scheduled", "ready"), true);
  assert.equal(canAllocateTrainingResource("scheduled", "attention"), true);
  assert.equal(canAllocateTrainingResource("in_progress", "ready"), false);
  assert.equal(canAllocateTrainingResource("scheduled", "overdue"), false);
});

test("allocation status lifecycle is controlled", () => {
  assert.equal(canTransitionTrainingResourceAllocation("reserved", "confirmed"), true);
  assert.equal(canTransitionTrainingResourceAllocation("confirmed", "released"), true);
  assert.equal(canTransitionTrainingResourceAllocation("released", "confirmed"), false);
  assert.equal(canTransitionTrainingResourceAllocation("cancelled", "reserved"), false);
});

test("reservation actions serialize resource demand and query overlapping session windows", () => {
  const source = readFileSync("src/app/driver-training/logistics/actions.ts", "utf8");
  assert.match(source, /pg_advisory_xact_lock\(hashtext/);
  assert.match(source, /training-resource-allocation:/);
  assert.match(source, /lt\(trainingSessions\.startAt, session\.endAt\)/);
  assert.match(source, /gt\(trainingSessions\.endAt, session\.startAt\)/);
  assert.match(source, /resourceDemandFits/);
  assert.match(source, /This resource is already actively allocated to the session/);
  assert.match(source, /Retired training resources cannot be returned to service/);
  assert.match(source, /logAudit/);
});

test("logistics migration keeps history while preventing duplicate active resource/session reservations", () => {
  const migration = readFileSync("migrations/20260911_driver_training_logistics.sql", "utf8");
  assert.match(migration, /training_resource_exclusive_quantity_chk/);
  assert.match(migration, /training_resource_active_session_uidx/);
  assert.match(migration, /WHERE status IN \('reserved', 'confirmed'\)/);
  assert.match(migration, /training_resource_allocation_resource_session_idx/);
  assert.match(migration, /training_resource_allocation_status_chk/);
});

test("enterprise migration runner and verifier include logistics objects", () => {
  const runner = readFileSync("scripts/apply-enterprise-upgrade.mjs", "utf8");
  const verifier = readFileSync("scripts/verify-enterprise-upgrade.mjs", "utf8");
  assert.match(runner, /20260911_driver_training_logistics\.sql/);
  assert.match(verifier, /training_resources/);
  assert.match(verifier, /training_resource_allocations/);
  assert.match(verifier, /training_resource_active_session_uidx/);
});

test("Driver Training navigation exposes logistics workspace and risk controls", () => {
  const layout = readFileSync("src/app/driver-training/DriverTrainingNav.tsx", "utf8");
  const page = readFileSync("src/app/driver-training/logistics/page.tsx", "utf8");
  assert.match(layout, /\/driver-training\/logistics/);
  assert.match(page, /Training Logistics & Resources/);
  assert.match(page, /At-risk allocations/);
  assert.match(page, /Resource reallocation required/);
});
