import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

test("daily inspection print root is explicitly visible despite global certificate-only hide rule", () => {
  const styles = read("src/app/globals.css");
  const page = read("src/app/daily-inspections/[id]/page.tsx");
  assert.match(styles, /body \* \{\s*visibility: hidden;/);
  assert.match(styles, /\.daily-inspection-print-root,\s*\.daily-inspection-print-root \* \{\s*visibility: visible !important;/);
  assert.match(page, /className="daily-inspection-print-root p-6 lg:p-10"/);
  assert.match(page, /print-report-header/);
  assert.match(page, /Daily Pre-Trip \/ Pre-Loading Inspection Checklist/);
});

test("A4 print layout removes application navigation without interfering with certificate or assessment printing", () => {
  const styles = read("src/app/globals.css");
  const page = read("src/app/daily-inspections/[id]/page.tsx");
  assert.match(styles, /@page vims-pretrip \{\s*size: A4 portrait;\s*margin: 12mm;/);
  assert.match(styles, /page: vims-pretrip;/);
  assert.match(styles, /body:has\(\.daily-inspection-print-root\) \[data-app-shell\] > aside/);
  assert.match(styles, /body:has\(\.daily-inspection-print-root\) \.app-shell-content/);
  assert.match(styles, /overflow: visible !important;/);
  assert.match(styles, /\.certificate-container/);
  assert.match(styles, /\.certificate-document/);
  assert.match(styles, /\.assessment-print-root/);
  assert.match(page, /className="no-print inline-flex items-center/);
  assert.match(page, /<div className="no-print">\s*<PageHeader/);
  assert.match(page, /className="print-report-item px-4 py-2.5/);
});

test("print button keeps existing browser print action and report retains validated inspection content", () => {
  const button = read("src/app/daily-inspections/DailyInspectionPrintButton.tsx");
  const page = read("src/app/daily-inspections/[id]/page.tsx");
  assert.match(button, /onClick=\{\(\) => window\.print\(\)\}/);
  assert.match(page, /Inspection Validation/);
  assert.match(page, /Pre-Trip Checklist/);
  assert.match(page, /criticalDefects/);
  assert.match(page, /inspectorSignature/);
  assert.match(page, /item\.severity/);
  assert.match(page, /Inspector remarks/);
});
