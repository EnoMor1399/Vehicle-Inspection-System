import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const buttonPath = "src/app/driver-training/assessments/[assessmentId]/PrintAssessmentButton.tsx";
const printPagePath = "src/app/driver-training/assessments/[assessmentId]/print/page.tsx";
const autoPrintPath = "src/app/driver-training/assessments/[assessmentId]/print/AutoPrint.tsx";

test("driver assessment print button opens the dedicated operational form", () => {
  const button = readFileSync(buttonPath, "utf8");

  assert.match(button, /window\.location\.pathname/);
  assert.match(button, /\$\{pathname\}\/print/);
  assert.match(button, /window\.open/);
  assert.match(button, /Print single-page A4/);
});

test("legacy assessment print page reproduces the two-column operational form structure", () => {
  const page = readFileSync(printPagePath, "utf8");

  assert.match(page, /legacy-a4-form/);
  assert.match(page, /top-black-band/);
  assert.match(page, /meta-grid/);
  assert.match(page, /criteria-grid/);
  assert.match(page, /bottom-grid/);
  assert.match(page, /Recommended to Drive/);
  assert.match(page, /Not Recommended to Drive/);
  assert.match(page, /Detailed Performance/);
  assert.match(page, /Additional Comments/);
  assert.match(page, /Mandatory Disqualification/);
  assert.match(page, /Name of Assessor/);
  assert.match(page, /Assessor Sign:/);
  assert.match(page, /Mgr Sign:/);
});

test("legacy print contract contains the original 40 weighted criteria totaling 100 points", () => {
  const page = readFileSync(printPagePath, "utf8");
  const criterionRows = [...page.matchAll(/\{ no: (\d+), label: /g)].map((match) => Number(match[1]));
  const weights = [...page.matchAll(/weight: (\d+), ratingId:/g)].map((match) => Number(match[1]));

  assert.equal(criterionRows.length, 40);
  assert.deepEqual(criterionRows, Array.from({ length: 40 }, (_, index) => index + 1));
  assert.equal(weights.length, 40);
  assert.equal(weights.reduce((sum, weight) => sum + weight, 0), 100);
  assert.match(page, /A - \{section\.title\}|code: "A"/);
  assert.match(page, /code: "G"/);
  assert.match(page, /TOTAL %/);
  assert.match(page, /LEGACY_MAX_SCORE/);
});

test("legacy print form maps mandatory disqualifications and grading scale from the operational sheet", () => {
  const page = readFileSync(printPagePath, "utf8");

  assert.match(page, /Fails to belt up during Assessment/);
  assert.match(page, /Occurrence of Accident or Near Miss/);
  assert.match(page, /Unjustifiable Violation of Regulations/);
  assert.match(page, /Use of Mobile Phone while Driving/);
  assert.match(page, /0 - 60%/);
  assert.match(page, /61 - 74%/);
  assert.match(page, /75 - 80%/);
  assert.match(page, /81 - 90%/);
  assert.match(page, /91 - 100%/);
  assert.match(page, /V GOOD PASS/);
});

test("legacy assessment print output is constrained to a single A4 portrait page", () => {
  const page = readFileSync(printPagePath, "utf8");
  const autoPrint = readFileSync(autoPrintPath, "utf8");

  assert.match(page, /@page \{ size: A4 portrait; margin: 8mm; \}/);
  assert.match(page, /width: 194mm !important/);
  assert.match(page, /height: 281mm !important/);
  assert.match(page, /max-height: 281mm !important/);
  assert.match(page, /overflow: hidden !important/);
  assert.match(autoPrint, /window\.print\(\)/);
});

test("legacy assessment form carries the current operational footer", () => {
  const page = readFileSync(printPagePath, "utf8");

  assert.match(page, /Road Safety Limited\. PMB, Tema/);
  assert.match(page, /info@rslghana\.com/);
  assert.match(page, /\+233 \(0\) 303 976 777/);
});
