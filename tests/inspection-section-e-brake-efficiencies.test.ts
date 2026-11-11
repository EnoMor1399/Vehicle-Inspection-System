import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseBrakeEfficiencyPercent } from "../src/lib/brake-efficiency";

const read = (path: string) => readFileSync(path, "utf8");
const groups = [
  ["trailerHeadServiceBrakeEfficiency", "Trailer Head Service Brake Efficiency %", "trailer_head_service_brake_efficiency"],
  ["trailerHeadParkingBrakeEfficiency", "Trailer Head Parking Brake Efficiency %", "trailer_head_parking_brake_efficiency"],
  ["tankerFlatbedServiceBrakeEfficiency", "Tanker / Flatbed Service Brake Efficiency %", "tanker_flatbed_service_brake_efficiency"],
  ["tankerFlatbedParkingBrakeEfficiency", "Tanker / Flatbed Parking Brake Efficiency %", "tanker_flatbed_parking_brake_efficiency"],
] as const;

test("Section E retains existing efficiencies and shows distinct trailer-head and tanker/flatbed service and parking values", () => {
  const form = read("src/app/inspections/InspectionForm.tsx");
  const sectionE = form.slice(form.indexOf('{active.section === "E" && ('), form.indexOf('{active.section === "O" && ('));
  assert.match(sectionE, /Service Brake Efficiency %/);
  assert.match(sectionE, /Parking Brake Efficiency %/);
  assert.match(sectionE, /Trailer Head Brakes/);
  assert.match(sectionE, /Tanker \/ Flatbed Brakes/);
  assert.equal((sectionE.match(/type="number"/g) || []).length, 6);
  assert.equal((sectionE.match(/min="0" max="100" step="0.01"/g) || []).length, 6);
  for (const [, label] of groups) assert.ok(sectionE.includes(label), "Missing " + label);
});

test("all four additional readings flow separately from form state to server-side range validation and database writes", () => {
  const form = read("src/app/inspections/InspectionForm.tsx");
  const server = read("src/app/inspections/server.ts");
  const schema = read("src/db/schema.ts");
  const migration = read("migrations/20261111_inspection_section_e_component_brake_efficiencies.sql");
  for (const [key, , column] of groups) {
    assert.ok(form.includes(key + ":"), "Form submission omits " + key);
    assert.ok(server.includes(key + "?: string;"), "Server type omits " + key);
    assert.ok(server.includes(key + ": parseBrakeEfficiencyPercent(data." + key), "Server validation omits " + key);
    assert.ok(schema.includes(column + '", { precision: 5, scale: 2 }'), "Schema omits " + column);
    assert.ok(migration.includes(column + " numeric(5,2)"), "Migration omits " + column);
  }
  assert.match(server, /"Trailer Head service brake efficiency"\)/);
  assert.match(server, /"Tanker\/Flatbed parking brake efficiency"\)/);
});

test("saved inspection details show independent component labels, preserving zero readings", () => {
  const report = read("src/app/inspections/[id]/page.tsx");
  for (const [key] of groups) {
    assert.ok(report.includes("i." + key + " != null"), "Report must show a measured 0% " + key);
  }
  assert.match(report, /Trailer Head service brake efficiency/);
  assert.match(report, /Tanker\/Flatbed parking brake efficiency/);
});

test("migration is additive and respects legacy inspection records without fabricating absent readings", () => {
  const sql = read("migrations/20261111_inspection_section_e_component_brake_efficiencies.sql");
  assert.match(sql, /ALTER TABLE inspections/);
  assert.equal((sql.match(/ADD COLUMN IF NOT EXISTS/g) || []).length, 4);
  assert.equal((sql.match(/BETWEEN 0 AND 100/g) || []).length, 4);
  assert.doesNotMatch(sql, /DROP TABLE|DELETE FROM|UPDATE inspections|TRUNCATE/i);
  assert.doesNotMatch(sql, /NOT NULL|DEFAULT 0/i);
});

test("new readings do not silently alter inspection decisions or established brake thresholds", () => {
  const server = read("src/app/inspections/server.ts");
  const form = read("src/app/inspections/InspectionForm.tsx");
  assert.match(server, /if \(data.overallResult === "pass" && \(totals.fail > 0 \|\| data.smokeTest === "fail"\)\)/);
  assert.match(form, /These values do not automatically determine a pass or fail/);
});

test("measured brake percentages accept 0%, 100% and two decimal places without fabricating blank readings", () => {
  assert.equal(parseBrakeEfficiencyPercent(undefined, "Brake"), null);
  assert.equal(parseBrakeEfficiencyPercent("", "Brake"), null);
  assert.equal(parseBrakeEfficiencyPercent(" ", "Brake"), null);
  assert.equal(parseBrakeEfficiencyPercent("0", "Brake"), "0.00");
  assert.equal(parseBrakeEfficiencyPercent("100.00", "Brake"), "100.00");
  assert.equal(parseBrakeEfficiencyPercent("67.25", "Brake"), "67.25");
  assert.equal(parseBrakeEfficiencyPercent(" 9.5 ", "Brake"), "9.50");
});

test("measured brake percentages reject invalid, out-of-range and over-precise readings", () => {
  for (const bad of ["-1", "100.01", "101", "NaN", "1e1", "33.333", "12,34", "abc", "Infinity"]) {
    assert.throws(() => parseBrakeEfficiencyPercent(bad, "Trailer brake"));
  }
});
