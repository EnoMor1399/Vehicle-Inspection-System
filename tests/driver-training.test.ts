import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DRIVER_TRAINING_DEPARTMENT,
  DRIVER_TRAINING_OUTCOMES,
  DRIVER_TRAINING_SERVICES,
} from "../src/lib/driver-training";

test("Driver Training department exposes the six approved service lines", () => {
  assert.equal(DRIVER_TRAINING_DEPARTMENT.name, "Driver Training & Assessment Services");
  assert.equal(DRIVER_TRAINING_SERVICES.length, 6);

  const ids = DRIVER_TRAINING_SERVICES.map((service) => service.id);
  assert.equal(new Set(ids).size, 6);
  assert.deepEqual(ids, [
    "defensive-driving",
    "driving-proficiency-test",
    "hazmat-hydrocarbons",
    "off-road-driving",
    "forklift-operator-safety",
    "vehicle-safety-inspection",
  ]);
});

test("each Driver Training service contains actionable focus areas and outcomes", () => {
  for (const service of DRIVER_TRAINING_SERVICES) {
    assert.ok(service.title.length > 5);
    assert.ok(service.summary.length > 20);
    assert.ok(service.focusAreas.length >= 5);
    assert.ok(service.outcomes.length >= 4);
  }
});

test("department outcomes cover safety, professionalism, compliance and operations", () => {
  const joined = DRIVER_TRAINING_OUTCOMES.join(" ").toLowerCase();
  assert.match(joined, /safety/);
  assert.match(joined, /professionalism/);
  assert.match(joined, /compliance/);
  assert.match(joined, /equipment protection/);
  assert.match(joined, /operational efficiency/);
});

test("Driver Training page is restricted to authenticated internal users", () => {
  const source = readFileSync("src/app/driver-training/page.tsx", "utf8");
  assert.match(source, /requireInternalUser\(\)/);
  assert.match(source, /DRIVER_TRAINING_SERVICES/);
});

test("navigation exposes Driver Training as a department workspace", () => {
  const source = readFileSync("src/components/AppShell.tsx", "utf8");
  assert.match(source, /label: "Departments"/);
  assert.match(source, /href: "\/driver-training"/);
  assert.match(source, /Driver Training & Assessment/);
});
