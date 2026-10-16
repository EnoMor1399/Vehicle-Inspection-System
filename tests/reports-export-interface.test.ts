import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("report exports remain spreadsheet-safe and useful without recent rows", () => {
  const actions = readFileSync("src/app/reports/ReportsActions.tsx", "utf8");

  assert.match(actions, /neutralizeSpreadsheetFormula/);
  assert.match(actions, /report\.rows\.length > 0/);
  assert.match(actions, /\["Metric", "Value"\]/);
  assert.match(actions, /new Blob\(\["\\uFEFF", lines\.join\("\\n"\)\]\)/);
  assert.match(actions, /Inspection Compliance/);
});

test("report export controls are responsive and announce action status", () => {
  const actions = readFileSync("src/app/reports/ReportsActions.tsx", "utf8");

  assert.match(actions, /grid grid-cols-2 gap-2 sm:flex/);
  assert.match(actions, /aria-live="polite"/);
  assert.match(actions, /aria-busy=\{action === "pdf"\}/);
  assert.match(actions, /aria-busy=\{action === "excel"\}/);
  assert.match(actions, /aria-busy=\{action === "csv"\}/);
  assert.match(actions, /Email Report/);
});


test("report export controls support month year and custom reporting periods", () => {
  const actions = readFileSync("src/app/reports/ReportsActions.tsx", "utf8");
  const server = readFileSync("src/app/reports/server.ts", "utf8");

  assert.match(actions, /Specific month/);
  assert.match(actions, /Specific year/);
  assert.match(actions, /Custom date range/);
  assert.match(actions, /type="month"/);
  assert.match(actions, /type="date"/);
  assert.match(actions, /getReportExportData/);
  assert.match(server, /gte\(inspections\.inspectionDate/);
  assert.match(server, /lt\(inspections\.inspectionDate/);
  assert.match(server, /requireInternalUser/);
  assert.match(server, /canViewReports/);
});
