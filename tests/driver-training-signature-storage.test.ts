import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("new Driver Training signatures can move to private storage without breaking legacy records", () => {
  const storage = readFileSync("src/lib/assessment-signature-storage.ts", "utf8");
  const actions = readFileSync("src/app/driver-training/assessments/actions.ts", "utf8");
  const route = readFileSync("src/app/api/driver-training/assessment-signatures/[assessmentId]/[kind]/route.ts", "utf8");
  const detail = readFileSync("src/app/driver-training/assessments/[assessmentId]/page.tsx", "utf8");
  const print = readFileSync("src/app/driver-training/assessments/[assessmentId]/print/page.tsx", "utf8");

  assert.match(storage, /isPrivateBlobStorageConfigured/);
  assert.match(storage, /putPrivateBlob/);
  assert.match(storage, /database_data_url/);
  assert.match(actions, /moveAssessmentSignatureToPrivateStorage/);
  assert.match(route, /fetchPrivateBlob/);
  assert.match(route, /decodePngSignatureDataUrl/);
  assert.match(detail, /assessment-signatures\/\$\{assessmentId\}/);
  assert.match(print, /assessment-signatures\/\$\{assessment\.id\}\/assessor/);
  assert.match(print, /assessment-signatures\/\$\{assessment\.id\}\/reviewer/);
});
