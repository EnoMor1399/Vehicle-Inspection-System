import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("report exports remain spreadsheet-safe and useful without recent rows", () => {
  const actions = readFileSync("src/app/reports/ReportsActions.tsx", "utf8");

  assert.match(actions, /neutralizeSpreadsheetFormula/);
  assert.match(actions, /recentData\.length > 0/);
  assert.match(actions, /\["Metric", "Value"\]/);
  assert.match(actions, /new Blob\(\["\\uFEFF", csvContent\]/);
  assert.match(actions, /Fleet Compliance/);
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
