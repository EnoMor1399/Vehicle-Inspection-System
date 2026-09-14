import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { GUIDE_SECTIONS } from "../src/app/guide/current-data";

function section(id: string) {
  const result = GUIDE_SECTIONS.find((item) => item.id === id);
  assert.ok(result, `Expected guide section ${id}`);
  return result;
}

function subsection(sectionId: string, subsectionId: string) {
  const result = section(sectionId).subsections.find((item) => item.id === subsectionId);
  assert.ok(result, `Expected guide subsection ${sectionId}/${subsectionId}`);
  return result;
}

test("in-app user guide uses the current composed guide data", async () => {
  const source = await readFile(new URL("../src/app/guide/GuideContent.tsx", import.meta.url), "utf8");
  assert.match(source, /from "\.\/current-data"/);
});

test("current guide documents the governed Driver Training workspace", () => {
  const training = section("driver-training");
  assert.equal(training.title, "Driver Training & Assessment");

  const allText = JSON.stringify(training);
  for (const label of [
    "Requests",
    "Sessions",
    "Participants",
    "Assessment workspace",
    "Review queue",
    "Certificates",
    "Analytics",
    "Accreditation",
    "Readiness",
    "Evidence",
    "Quality",
    "Compliance",
  ]) {
    assert.match(allText, new RegExp(label));
  }

  for (const service of [
    "Defensive Driving Training",
    "Driving Proficiency Test",
    "HAZMAT (Hydrocarbons) Training",
    "Off-Road Driving Training",
    "Forklift Operator Safety Training",
    "Vehicle Safety Inspection Training",
  ]) {
    assert.ok(allText.includes(service), `Expected training service ${service}`);
  }

  assert.match(subsection("driver-training", "training-assessments").content ?? "", /independent review/i);
});

test("inspection guide matches the canonical A through P operator workflow", () => {
  const overview = subsection("inspections", "biannual-overview");
  const checklist = subsection("inspections", "complete-checklist");
  const evidence = subsection("inspections", "photo-evidence");
  const decision = subsection("inspections", "final-decision");

  assert.match(overview.content ?? "", /16-step A–P workflow/);
  assert.match(overview.content ?? "", /sections B–O/);
  assert.ok(checklist.steps?.some((step) => step.includes("Previous/Next")));
  assert.ok(checklist.steps?.some((step) => step.includes("Section P")));
  assert.ok(evidence.steps?.some((step) => step.includes("Open Device Camera")));
  assert.ok(evidence.steps?.some((step) => step.includes("Switch Camera")));
  assert.match(decision.content ?? "", /restrict Pass or Conditional Pass/);
});

test("guide describes actual online PWA behavior instead of offline record sync", () => {
  const welcome = subsection("getting-started", "welcome");
  const offline = subsection("apps", "offline-mode");
  const troubleshooting = subsection("troubleshooting", "faq-offline");

  const welcomeText = JSON.stringify(welcome);
  assert.doesNotMatch(welcomeText, /PWA.*offline access/i);
  assert.doesNotMatch(welcomeText, /automatically saves your progress/i);
  assert.match(offline.content ?? "", /does not perform background record synchronization/i);
  assert.match(troubleshooting.content ?? "", /does not currently synchronize protected records/i);
});

test("reports and branding guide reflect current export and security behavior", () => {
  const exports = subsection("reports", "export-reports");
  const branding = subsection("settings", "branding");

  const exportText = JSON.stringify(exports);
  assert.match(exportText, /UTF-8-compatible/);
  assert.match(exportText, /summary metrics/);
  assert.match(exportText, /formula-like cell values/);
  assert.match(exportText, /Email Report/);

  const brandingText = JSON.stringify(branding);
  assert.match(brandingText, /PNG or JPG\/JPEG/);
  assert.match(brandingText, /SVG.*rejected/i);
});
