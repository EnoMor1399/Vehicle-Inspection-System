import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(path: string) {
  return readFileSync(path, "utf8");
}

test("core Vehicle Inspection writes persist organization ownership", () => {
  const vehicles = source("src/app/vehicles/server.ts");
  const transporters = source("src/app/transporters/server.ts");
  const stations = source("src/app/locations/actions.ts");
  const inspections = source("src/app/inspections/server.ts");
  const daily = source("src/app/daily-inspections/server.ts");
  const schedule = source("src/app/schedule/server.ts");

  assert.match(vehicles, /organizationId: user\.organizationId/);
  assert.match(transporters, /organizationId: user\.organizationId/);
  assert.match(stations, /organizationId: user\.organizationId/);
  assert.match(inspections, /organizationId: user\.organizationId/);
  assert.match(daily, /organizationId: user\.organizationId/);
  assert.match(schedule, /organizationId: user\.organizationId/);
});

test("core Vehicle Inspection reads are organization scoped", () => {
  const files = [
    "src/app/vehicles/page.tsx",
    "src/app/vehicles/server.ts",
    "src/app/transporters/page.tsx",
    "src/app/transporters/[id]/page.tsx",
    "src/app/locations/page.tsx",
    "src/app/inspections/page.tsx",
    "src/app/inspections/[id]/page.tsx",
    "src/app/daily-inspections/page.tsx",
    "src/app/daily-inspections/[id]/page.tsx",
    "src/app/schedule/page.tsx",
    "src/app/documents/page.tsx",
    "src/app/reports/page.tsx",
    "src/app/page.tsx",
  ];

  for (const path of files) {
    assert.match(
      source(path),
      /organizationId, user\.organizationId|organizationId: user\.organizationId|organizationId, currentUser\.organizationId/,
      `${path} must reference the authenticated organization boundary`,
    );
  }
});

test("REST API authentication exposes an organization context and operational APIs use it", () => {
  const auth = source("src/lib/api-auth.ts");
  assert.match(auth, /organizationId/);

  const routes = [
    "src/app/api/v1/vehicles/route.ts",
    "src/app/api/v1/vehicles/[id]/route.ts",
    "src/app/api/v1/transporters/route.ts",
    "src/app/api/v1/locations/route.ts",
    "src/app/api/v1/inspections/route.ts",
    "src/app/api/v1/inspections/[id]/route.ts",
    "src/app/api/v1/rfid/route.ts",
    "src/app/api/v1/predictive-maintenance/route.ts",
    "src/app/api/v1/powerbi/route.ts",
  ];

  for (const path of routes) {
    assert.match(source(path), /organizationId/, `${path} must enforce tenant context`);
  }
});

test("audit security webhooks and API keys carry organization ownership", () => {
  assert.match(source("src/lib/audit.ts"), /organizationId/);
  assert.match(source("src/lib/security.ts"), /organizationId/);
  assert.match(source("src/lib/webhook-delivery.ts"), /organizationId/);
  assert.match(source("src/lib/api-keys.ts"), /organizationId/);
  assert.match(source("src/app/api-docs/server.ts"), /organizationId: user\.organizationId/);
});

test("Driver Training creation and mutation paths persist organization ownership", () => {
  const paths = [
    "src/app/driver-training/actions.ts",
    "src/app/driver-training/requests/actions.ts",
    "src/app/driver-training/assessments/actions.ts",
    "src/app/driver-training/assessments/written-exams/actions.ts",
    "src/app/driver-training/certificates/actions.ts",
    "src/app/driver-training/commercials/actions.ts",
    "src/app/driver-training/communications/actions.ts",
    "src/app/driver-training/compliance/actions.ts",
    "src/app/driver-training/curriculum/actions.ts",
    "src/app/driver-training/development/actions.ts",
    "src/app/driver-training/evidence/actions.ts",
    "src/app/driver-training/logistics/actions.ts",
    "src/app/driver-training/quality/actions.ts",
    "src/app/driver-training/readiness/actions.ts",
    "src/app/driver-training/safety/actions.ts",
    "src/app/driver-training/accreditation/actions.ts",
  ];

  for (const path of paths) {
    assert.match(
      source(path),
      /organizationId: user\.organizationId|organizationId: actor\.organizationId/,
      `${path} must persist organization ownership`,
    );
  }
});

test("Driver Training pages query by authenticated organization", () => {
  const paths = [
    "src/app/driver-training/page.tsx",
    "src/app/driver-training/sessions/page.tsx",
    "src/app/driver-training/participants/page.tsx",
    "src/app/driver-training/participants/[id]/page.tsx",
    "src/app/driver-training/assessments/page.tsx",
    "src/app/driver-training/assessments/[assessmentId]/page.tsx",
    "src/app/driver-training/certificates/page.tsx",
    "src/app/driver-training/compliance/page.tsx",
    "src/app/driver-training/analytics/page.tsx",
    "src/app/driver-training/instructors/page.tsx",
    "src/app/driver-training/requests/page.tsx",
    "src/app/driver-training/quality/page.tsx",
    "src/app/driver-training/safety/page.tsx",
    "src/app/driver-training/accreditation/page.tsx",
  ];

  for (const path of paths) {
    assert.match(
      source(path),
      /organizationId/,
      `${path} must include an organization predicate`,
    );
  }
});

test("public verification paths resolve globally unique verification tokens instead of accepting organization IDs from the public", () => {
  const vehicleCertificate = source("src/app/certificate/[id]/page.tsx");
  const trainingVerification = source("src/app/verify/training/[code]/page.tsx");

  assert.doesNotMatch(vehicleCertificate, /searchParams[\s\S]*organizationId/);
  assert.match(trainingVerification, /verificationCode/);
  assert.doesNotMatch(trainingVerification, /searchParams[\s\S]*organizationId/);
});
