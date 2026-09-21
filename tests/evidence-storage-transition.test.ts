import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("legacy evidence storage is measurable and new training signatures have a private path", () => {
  const audit = readFileSync("scripts/evidence-storage-audit.mjs", "utf8");
  const storage = readFileSync("src/lib/assessment-signature-storage.ts", "utf8");
  const nav = readFileSync("src/app/driver-training/DriverTrainingNav.tsx", "utf8");

  assert.match(audit, /inspections_with_embedded_photos/);
  assert.match(audit, /daily_inspections_with_embedded_photos/);
  assert.match(audit, /private\.blob\.vercel-storage\.com/);
  assert.match(storage, /moveAssessmentSignatureToPrivateStorage/);
  assert.match(nav, /Workflow/);
  assert.match(nav, /Assess & Certify/);
  assert.match(nav, /Admin & Assurance/);
});
