import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("inspection wizard keeps dedicated A and P steps around the B-O checklist", () => {
  const steps = readFileSync("src/lib/inspection-steps.ts", "utf8");
  const sections = readFileSync("src/lib/sections.ts", "utf8");

  assert.match(steps, /INSPECTION_IDENTIFICATION_STEP = "A"/);
  assert.match(steps, /INSPECTION_FINAL_DECISION_STEP = "P"/);
  assert.match(steps, /\.\.\.INSPECTION_SECTIONS\.map\(\(section\) => section\.code\)/);
  assert.match(steps, /if \(nextIndex < 0 \|\| nextIndex >= steps\.length\) return null/);
  assert.doesNotMatch(sections, /code: "A"/);
  assert.doesNotMatch(sections, /code: "P"/);
});

test("inspection form provides guided progress and adjacent-step navigation", () => {
  const form = readFileSync("src/app/inspections/InspectionForm.tsx", "utf8");

  assert.match(form, /getAdjacentInspectionStep/);
  assert.match(form, /Step \{activeStepPosition\} of \{stepOrder\.length\}/);
  assert.match(form, /Inspection progress \$\{progressPercent\}%/);
  assert.match(form, /Previous/);
  assert.match(form, /Next Section/);
  assert.match(form, /hasNextStep \?/);
  assert.match(form, /Submit Inspection/);
  assert.match(form, /active \? summarizeSection\(active\) : null/);
});

test("photo evidence capture keeps browser camera and native device fallbacks", () => {
  const capture = readFileSync("src/components/PhotoCapture.tsx", "utf8");

  assert.match(capture, /navigator\.mediaDevices\?\.getUserMedia/);
  assert.match(capture, /navigator\.mediaDevices\?\.enumerateDevices/);
  assert.match(capture, /capture="environment"/);
  assert.match(capture, /Open Device Camera/);
  assert.match(capture, /availableCameraCount > 1/);
  assert.match(capture, /event\.key !== "Escape"/);
  assert.match(capture, /e\.currentTarget\.value = ""/);
  assert.match(capture, /aria-label="Remove evidence photo"/);
});
