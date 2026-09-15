import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("driver assessment page exposes a dedicated printable root", () => {
  const page = readFileSync("src/app/driver-training/assessments/[assessmentId]/page.tsx", "utf8");

  assert.match(page, /assessment-print-root/);
  assert.match(page, /<PrintAssessmentButton \/>/);
});

test("driver assessment print stylesheet isolates the record from the application shell", () => {
  const button = readFileSync("src/app/driver-training/assessments/[assessmentId]/PrintAssessmentButton.tsx", "utf8");

  assert.match(button, /data-assessment-print-styles/);
  assert.match(button, /\[data-app-shell\] > aside/);
  assert.match(button, /\[data-app-shell\] > div > header/);
  assert.match(button, /:has\(> \.assessment-print-root\) > :not\(\.assessment-print-root\)/);
  assert.match(button, /position: static !important/);
  assert.match(button, /visibility: visible !important/);
});

test("driver assessment print stylesheet forces a light printable palette and printable tables", () => {
  const button = readFileSync("src/app/driver-training/assessments/[assessmentId]/PrintAssessmentButton.tsx", "utf8");

  assert.match(button, /--vims-panel-solid: #ffffff/);
  assert.match(button, /--vims-ink: #0f172a/);
  assert.match(button, /color: #0f172a !important/);
  assert.match(button, /table-layout: fixed !important/);
  assert.match(button, /display: table-header-group/);
  assert.match(button, /window\.print\(\)/);
});

test("driver assessment printing is compressed to one portrait A4 page", () => {
  const button = readFileSync("src/app/driver-training/assessments/[assessmentId]/PrintAssessmentButton.tsx", "utf8");

  assert.match(button, /size: A4 portrait/);
  assert.match(button, /margin: 7mm/);
  assert.match(button, /width: 196mm !important/);
  assert.match(button, /height: 283mm !important/);
  assert.match(button, /max-height: 283mm !important/);
  assert.match(button, /overflow: hidden !important/);
  assert.match(button, /font-size: 7\.2pt !important/);
  assert.match(button, /\[class\*=\"overflow-x-auto\"\][\s\S]*display: none !important/);
  assert.match(button, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important/);
  assert.match(button, /Print single-page A4/);
});
