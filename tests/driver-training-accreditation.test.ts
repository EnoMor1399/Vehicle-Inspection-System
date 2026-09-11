import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  accreditationValidityState,
  evaluateTrainingRegulatoryCompliance,
  trainingAccreditationRecordSchema,
  trainingRegulatoryRequirementSchema,
} from "../src/lib/training-accreditation-policy";

test("regulatory requirements use approved Driver Training service ids and allow global scope", () => {
  const base = {
    requirementCode: "REG-HAZ-001",
    title: "Hydrocarbon training provider authorization",
    authority: "Relevant authority",
    requirementType: "provider_accreditation",
    mandatory: true,
    status: "active",
  };
  assert.equal(trainingRegulatoryRequirementSchema.safeParse({ ...base, serviceId: "hazmat-hydrocarbons" }).success, true);
  assert.equal(trainingRegulatoryRequirementSchema.safeParse({ ...base, serviceId: "" }).success, true);
  assert.equal(trainingRegulatoryRequirementSchema.safeParse({ ...base, serviceId: "unknown-service" }).success, false);
});

test("accreditation evidence validates effective date order", () => {
  const base = {
    requirementId: "d34db33f-0000-4000-8000-000000000040",
    issuingAuthority: "Relevant authority",
    validFrom: "2026-01-01",
    validUntil: "2026-12-31",
    evidenceReference: "controlled-doc/credential-001",
  };
  assert.equal(trainingAccreditationRecordSchema.safeParse(base).success, true);
  assert.equal(trainingAccreditationRecordSchema.safeParse({ ...base, validUntil: "2025-12-31" }).success, false);
  assert.equal(trainingAccreditationRecordSchema.safeParse({ ...base, issuedDate: "2026-02-01" }).success, false);
});

test("credential validity derives pending, future, valid, expiring and expired states", () => {
  const now = new Date("2026-09-11T12:00:00Z");
  assert.equal(accreditationValidityState({ status: "pending", validFrom: "2026-01-01", validUntil: "2026-12-31" }, now), "pending");
  assert.equal(accreditationValidityState({ status: "verified", validFrom: "2026-10-01", validUntil: "2026-12-31" }, now), "not_yet_valid");
  assert.equal(accreditationValidityState({ status: "verified", validFrom: "2026-01-01", validUntil: "2026-12-31" }, now), "valid");
  assert.equal(accreditationValidityState({ status: "verified", validFrom: "2026-01-01", validUntil: "2026-09-30" }, now), "expiring");
  assert.equal(accreditationValidityState({ status: "verified", validFrom: "2026-01-01", validUntil: "2026-09-10" }, now), "expired");
});

test("regulatory evaluation combines global and service-specific mandatory requirements", () => {
  const now = new Date("2026-09-11T12:00:00Z");
  const requirements = [
    { id: "global", serviceId: null, title: "Provider licence", mandatory: true, status: "active" },
    { id: "hazmat", serviceId: "hazmat-hydrocarbons", title: "HAZMAT authorization", mandatory: true, status: "active" },
    { id: "forklift", serviceId: "forklift-operator-safety", title: "Forklift authorization", mandatory: true, status: "active" },
    { id: "optional", serviceId: null, title: "Optional control", mandatory: false, status: "active" },
  ];
  const accreditations = [
    { requirementId: "global", status: "verified", validFrom: "2026-01-01", validUntil: "2027-01-01" },
    { requirementId: "hazmat", status: "verified", validFrom: "2026-01-01", validUntil: "2026-09-10" },
  ];
  const evaluation = evaluateTrainingRegulatoryCompliance("hazmat-hydrocarbons", requirements, accreditations, now);
  assert.equal(evaluation.ready, false);
  assert.deepEqual(evaluation.blockers, ["HAZMAT authorization"]);
  assert.equal(evaluation.applicableCount, 2);
});

test("accreditation actions serialize replacement evidence by requirement and preserve history", () => {
  const source = readFileSync("src/app/driver-training/accreditation/actions.ts", "utf8");
  assert.match(source, /training-accreditation:/);
  assert.match(source, /pg_advisory_xact_lock\(hashtext/);
  assert.match(source, /eq\(trainingAccreditationRecords\.status, "verified"\)/);
  assert.match(source, /Accreditation record cannot move from/);
  assert.match(source, /Revocation.*requires verification notes/);
  assert.match(source, /evaluateTrainingRegulatoryCompliance/);
  assert.match(source, /logAudit/);
});

test("accreditation migration enforces verified evidence uniqueness and live session start compliance", () => {
  const migration = readFileSync("migrations/20260911_driver_training_accreditation.sql", "utf8");
  assert.match(migration, /training_accreditation_one_verified_uidx/);
  assert.match(migration, /WHERE status = 'verified'/);
  assert.match(migration, /enforce_training_session_regulatory_compliance/);
  assert.match(migration, /NEW\.status = 'in_progress'/);
  assert.match(migration, /a\.valid_from <= CURRENT_DATE/);
  assert.match(migration, /a\.valid_until IS NULL OR a\.valid_until >= CURRENT_DATE/);
  assert.match(migration, /regulatory compliance blockers/);
});

test("enterprise migration runner and verifier include accreditation objects", () => {
  const runner = readFileSync("scripts/apply-enterprise-upgrade.mjs", "utf8");
  const verifier = readFileSync("scripts/verify-enterprise-upgrade.mjs", "utf8");
  assert.match(runner, /20260911_driver_training_accreditation\.sql/);
  assert.match(verifier, /training_regulatory_requirements/);
  assert.match(verifier, /training_accreditation_records/);
  assert.match(verifier, /training_session_compliance_reviews/);
  assert.match(verifier, /training_accreditation_one_verified_uidx/);
});

test("Driver Training navigation exposes accreditation workspace and live delivery-gate language", () => {
  const layout = readFileSync("src/app/driver-training/DriverTrainingNav.tsx", "utf8");
  const page = readFileSync("src/app/driver-training/accreditation/page.tsx", "utf8");
  assert.match(layout, /\/driver-training\/accreditation/);
  assert.match(page, /Training Accreditation & Regulatory Compliance/);
  assert.match(page, /prevent training delivery when mandatory authorization is missing or invalid/);
  assert.match(page, /PostgreSQL repeats the mandatory check when a session is actually started/);
});