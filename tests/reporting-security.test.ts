import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("reports CSV and XLSX exports reuse spreadsheet formula neutralization", () => {
  const source = readFileSync("src/app/reports/ReportsActions.tsx", "utf8");
  assert.match(source, /neutralizeSpreadsheetFormula/);
  assert.match(source, /function csvCell\([\s\S]*neutralizeSpreadsheetFormula\(value\)/);
  assert.match(source, /function spreadsheetSafeRows\([\s\S]*neutralizeSpreadsheetFormula\(value\)/);
  assert.match(source, /json_to_sheet\(spreadsheetSafeRows\(recentData\)\)/);
});

test("Power BI workspace derives its API destination only from trusted configuration", () => {
  const source = readFileSync("src/app/powerbi/page.tsx", "utf8");
  assert.match(source, /NEXT_PUBLIC_APP_URL/);
  assert.doesNotMatch(source, /x-forwarded-host/i);
  assert.doesNotMatch(source, /x-forwarded-proto/i);
  assert.doesNotMatch(source, /requestHeaders/);
});

test("Power BI API keeps query parsing bounded and avoids partial integer parsing", () => {
  const source = readFileSync("src/app/api/v1/powerbi/route.ts", "utf8");
  assert.match(source, /MAX_FILTER_LENGTH = 2000/);
  assert.match(source, /MAX_FILTER_CONDITIONS = 20/);
  assert.equal(source.includes("if (!/^\\d+$/.test(value))"), true);
  assert.doesNotMatch(source, /Number\.parseInt/);
  assert.match(source, /if \(!opts\.count\) return \{ data, hasMore \}/);
  assert.match(source, /LIMIT \$\{opts\.top \+ 1\}/);
  assert.doesNotMatch(source, /url\.origin/);
});

test("Power BI default reporting contract excludes sensitive identity and contact columns", () => {
  const source = readFileSync("src/app/api/v1/powerbi/route.ts", "utf8");
  for (const forbidden of [
    "v.vin",
    "chassis_number",
    "tin_number",
    "contact_person",
    "t.mobile",
    "t.email",
    "l.address",
    "l.phone",
    "route_description",
    "d.notes",
  ]) {
    assert.equal(source.includes(forbidden), false, `Power BI route must not expose ${forbidden}`);
  }
});

test("Power BI metadata mirrors reduced fields and permission-gates restricted entity sets", () => {
  const source = readFileSync("src/app/api/v1/powerbi/$metadata/route.ts", "utf8");
  assert.doesNotMatch(source, /Name: "VIN"|Name: "ChassisNumber"|Name: "TIN"|Name: "ContactPerson"/);
  assert.match(source, /permission: "documents"/);
  assert.match(source, /permission: "audit"/);
  assert.match(source, /permission: "users"/);
  assert.match(source, /Cache-Control": "private, no-store"/);
});
