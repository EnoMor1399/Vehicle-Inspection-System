import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildDefaultDailyChecklist, summarizeDailyChecklist, validateCompletedDailyChecklist } from "../src/lib/daily-checklist";

const read = (name: string) => readFileSync(name, "utf8");

function marked(type: "general" | "bulk_tanker" | "tractor_trailer" | "container_flatbed", result: "pass" | "fail" = "pass") {
  const checklist = buildDefaultDailyChecklist(type);
  for (const category of checklist) for (const item of category.items) item.result = result;
  return checklist;
}

test("default pre-trip template starts every safety check unchecked rather than automatically passed", () => {
  const checks = buildDefaultDailyChecklist();
  assert.ok(checks.length >= 8);
  assert.ok(checks.flatMap((x) => x.items).length >= 40);
  assert.ok(checks.every((x) => x.items.every((item) => item.result === "unchecked")));
  const summary = summarizeDailyChecklist(checks);
  assert.equal(summary.passed, 0);
  assert.equal(summary.unchecked, summary.total);
  assert.throws(() => validateCompletedDailyChecklist(checks, "general"), /every checklist item/i);
});

test("pre-loading reference sections B–J and tanker-specific calibration and fire protection are represented", () => {
  const tanker = buildDefaultDailyChecklist("bulk_tanker");
  const headings = tanker.map((x) => x.category).join(" | ");
  const checks = tanker.flatMap((x) => x.items.map((i) => i.name)).join(" | ");
  for (const category of ["B. Driver", "C. General", "D. Electricals", "E. Fire", "F. Wheels", "G. Brakes", "H. Tractor", "I. Bulk", "J. Other"]) {
    assert.ok(headings.includes(category), "Missing section " + category);
  }
  for (const term of [
    "Calibration", "Bulk identification", "Bonding", "extinguishers", "discharge hose",
    "Fifth-wheel", "Twist locks", "Underrun guards", "anti-slip", "4 mm tread",
    "wheel stoppers", "Driver's licence", "bi-annual", "windscreen",
  ]) {
    assert.ok(checks.toLowerCase().includes(term.toLowerCase()), "Missing reference item " + term);
  }
  assert.ok(tanker.length > buildDefaultDailyChecklist().length);
});

test("tanker-only extinguisher and calibration conditions do not apply automatically to general or container vehicles", () => {
  for (const kind of ["general", "container_flatbed", "tractor_trailer"] as const) {
    const names = buildDefaultDailyChecklist(kind).flatMap((x) => x.items.map((i) => i.name)).join(" ");
    assert.ok(!names.includes("one appropriate 2 kg"));
    assert.ok(!names.includes("Bulk calibration certificate valid"));
  }
});

test("complete template accepts all passes and rejects changed section names, missing items or fabricated outcomes", () => {
  const checklist = marked("general");
  const expected = checklist.flatMap((x) => x.items).length;
  assert.equal(validateCompletedDailyChecklist(checklist, "general"), expected);
  const missing = structuredClone(checklist);
  missing[0].items.pop();
  assert.throws(() => validateCompletedDailyChecklist(missing, "general"), /missing or altered/i);
  const tampered = structuredClone(checklist);
  tampered[0].items[0].name = "Replaced";
  assert.throws(() => validateCompletedDailyChecklist(tampered, "general"), /missing or modified/i);
});

test("N/A is permitted only for optional equipment with a written reason; every failed check needs defect notes", () => {
  const checklist = marked("general");
  checklist[0].items[0].result = "na";
  assert.throws(() => validateCompletedDailyChecklist(checklist, "general"), /N\/A is allowed only/);
  checklist[0].items[0].result = "pass";
  const optional = checklist.flatMap((category) => category.items).find((item) => item.optional);
  assert.ok(optional);
  optional.result = "na";
  assert.throws(() => validateCompletedDailyChecklist(checklist, "general"), /requires an explanation/i);
  optional.notes = "Not fitted to this vehicle";
  assert.doesNotThrow(() => validateCompletedDailyChecklist(checklist, "general"));
  optional.result = "fail";
  optional.notes = "Damaged coupling";
  assert.throws(() => validateCompletedDailyChecklist(checklist, "general"), /Select Minor, Major or Critical severity/i);
  optional.severity = "major";
  optional.notes = "";
  assert.throws(() => validateCompletedDailyChecklist(checklist, "general"), /Inspector remarks are required/i);
  optional.notes = "Damaged coupling requires repair before departure";
  assert.doesNotThrow(() => validateCompletedDailyChecklist(checklist, "general"));
  optional.severity = "invalid" as never;
  assert.throws(() => validateCompletedDailyChecklist(checklist, "general"), /Select Minor, Major or Critical severity/i);
});

test("new pre-loading checks fail closed, require inspector identity and preserve historical records", () => {
  const server = read("src/app/daily-inspections/server.ts");
  const form = read("src/app/daily-inspections/DailyInspectionForm.tsx");
  const detail = read("src/app/daily-inspections/[id]/page.tsx");
  const migration = read("migrations/20261107_daily_pretrip_preloading_details.sql");
  assert.match(server, /validateCompletedDailyChecklist\(input\.checklist, vehicleType\)/);
  assert.match(server, /summary\.failed > 0 \? "failed" : "passed"/);
  assert.match(server, /const clearedForTrip = summary\.failed === 0/);
  assert.match(server, /validateSignatureDataUrl\(record\.inspectorSignature/);
  assert.match(server, /inspectionPremises/);
  assert.match(server, /bulkCalibrationCertificateNumber/);
  assert.match(form, /notChecked > 0/);
  assert.match(form, /Pre-Loading Inspector Signature/);
  assert.match(detail, /checklistReference/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS preloading_details jsonb/);
});

test("prior checklist JSON remains available without new source fields", () => {
  const legacy = [{ category: "Legacy", items: [{ name: "Wheels", result: "pass" as const }] }];
  assert.equal(summarizeDailyChecklist(legacy).passed, 1);
  assert.equal(summarizeDailyChecklist(legacy).unchecked, 0);
});

test("failed-check severity and inspector remarks are enforced, stored, and displayed without allowing trip clearance", () => {
  const form = read("src/app/daily-inspections/DailyInspectionForm.tsx");
  const server = read("src/app/daily-inspections/server.ts");
  const report = read("src/app/daily-inspections/[id]/page.tsx");
  const schema = read("src/db/schema.ts");
  const validator = read("src/lib/daily-checklist.ts");
  assert.match(schema, /DailyDefectSeverity = "minor" \| "major" \| "critical"/);
  assert.match(schema, /severity\?: DailyDefectSeverity/);
  assert.match(form, /<option value="minor">Minor<\/option>/);
  assert.match(form, /<option value="major">Major<\/option>/);
  assert.match(form, /<option value="critical">Critical<\/option>/);
  assert.match(form, /placeholder="Inspector remarks"/);
  assert.match(form, /setItemSeverity\(catIdx, itemIdx/);
  assert.match(form, /!item\.severity \|\| !item\.notes\?\.trim\(\)/);
  assert.match(validator, /if \(answer\.result === "fail"\)/);
  assert.match(validator, /Inspector remarks are required for every failed item/);
  assert.match(server, /severity: it\.severity/);
  assert.match(server, /const clearedForTrip = summary\.failed === 0/);
  assert.match(report, /item\.severity === "critical"/);
  assert.match(report, /Inspector remarks/);
});

test("changing a failed check to pass clears stale classification and remarks", () => {
  const form = read("src/app/daily-inspections/DailyInspectionForm.tsx");
  assert.match(form, /severity: result === "fail" && items\[itemIdx\]\.result === "fail"/);
  assert.match(form, /notes: items\[itemIdx\]\.result === result \? items\[itemIdx\]\.notes : ""/);
});
