import test from "node:test";
import assert from "node:assert/strict";
import {
  EXPORT_MAX_COLUMN_WIDTH,
  exportCellText,
  neutralizeSpreadsheetFormula,
  spreadsheetColumnWidth,
} from "../src/lib/export-security";

test("spreadsheet exports neutralize formula prefixes including whitespace bypasses", () => {
  for (const value of ["=1+1", "+SUM(A1:A2)", "-10+20", "@HYPERLINK(\"https://example.com\")", "\t=cmd", "  =2+2"]) {
    assert.ok(neutralizeSpreadsheetFormula(value).startsWith("'"));
  }
});

test("spreadsheet exports preserve ordinary text", () => {
  assert.equal(neutralizeSpreadsheetFormula("GT-1234-26"), "GT-1234-26");
  assert.equal(neutralizeSpreadsheetFormula("RSL Transport"), "RSL Transport");
  assert.equal(neutralizeSpreadsheetFormula(42), "42");
});

test("export cell conversion serializes objects and nulls predictably", () => {
  assert.equal(exportCellText(null), "");
  assert.equal(exportCellText({ result: "pass" }), '{"result":"pass"}');
});

test("spreadsheet column widths are bounded", () => {
  assert.equal(
    spreadsheetColumnWidth(["x".repeat(1000)], "remarks"),
    EXPORT_MAX_COLUMN_WIDTH
  );
  assert.ok(spreadsheetColumnWidth(["short"], "id") >= 8);
});
