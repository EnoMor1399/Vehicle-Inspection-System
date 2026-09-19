import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("driver assessment reuses the controlled mouse/touch signature pad", () => {
  const shared = readFileSync("src/components/SignaturePad.tsx", "utf8");
  const field = readFileSync("src/app/driver-training/assessments/AssessmentSignatureField.tsx", "utf8");
  assert.match(shared, /onMouseDown/);
  assert.match(shared, /onTouchStart/);
  assert.match(shared, /toDataURL\("image\/png"\)/);
  assert.match(field, /SignaturePad/);
  assert.match(field, /type="hidden"/);
  assert.match(field, /name=\{name\}/);
});

test("driver assessment submission requires and stores an assessor signature", () => {
  const page = readFileSync("src/app/driver-training/assessments/page.tsx", "utf8");
  const action = readFileSync("src/app/driver-training/assessments/actions.ts", "utf8");
  assert.match(page, /Assessor Digital Signature/);
  assert.match(page, /name="assessorSignature"/);
  assert.match(page, /Reviewer\/supervisor approval and signature are captured on the assessment review screen/);
  assert.match(action, /MAX_SIGNATURE_DATA_URL_CHARS/);
  assert.match(action, /validateSignatureDataUrl\(assessorSignature, "Assessor signature"\)/);
  assert.match(action, /Assessor digital signature is required before submission/);
  assert.match(action, /assessorSignature,/);
});

test("review approval requires and stores a reviewer or supervisor signature", () => {
  const record = readFileSync("src/app/driver-training/assessments/[assessmentId]/page.tsx", "utf8");
  const action = readFileSync("src/app/driver-training/assessments/actions.ts", "utf8");
  assert.match(record, /Reviewer \/ Supervisor Digital Signature/);
  assert.match(record, /name="reviewerSignature"/);
  assert.match(record, /Digital Signatures/);
  assert.match(action, /validateSignatureDataUrl\(reviewerSignature, "Reviewer signature"\)/);
  assert.match(action, /Reviewer digital signature is required before approval/);
  assert.match(action, /Assessor digital signature is required before this assessment can be approved/);
  assert.match(action, /reviewerSignature: reviewerSignature \|\| null/);
});

test("training assessment schema and migration persist both signatures", () => {
  const schema = readFileSync("src/db/training-schema.ts", "utf8");
  const migration = readFileSync("migrations/20260919_driver_training_digital_signatures.sql", "utf8");
  const apply = readFileSync("scripts/apply-enterprise-upgrade.mjs", "utf8");
  const verify = readFileSync("scripts/verify-enterprise-upgrade.mjs", "utf8");
  assert.match(schema, /assessorSignature: text\("assessor_signature"\)/);
  assert.match(schema, /reviewerSignature: text\("reviewer_signature"\)/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS assessor_signature text/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS reviewer_signature text/);
  assert.match(apply, /20260919_driver_training_digital_signatures\.sql/);
  assert.match(verify, /"assessor_signature"/);
  assert.match(verify, /"reviewer_signature"/);
});

test("certificate issuance refuses an approved but unsigned assessment", () => {
  const action = readFileSync("src/app/driver-training/certificates/actions.ts", "utf8");
  assert.match(action, /assessorSignature: trainingAssessments\.assessorSignature/);
  assert.match(action, /reviewerSignature: trainingAssessments\.reviewerSignature/);
  assert.match(action, /!passingAssessment\.assessorSignature \|\| !passingAssessment\.reviewerSignature/);
  assert.match(action, /Assessor and reviewer digital signatures are required before certificate issuance/);
});

test("single-page A4 report prints captured assessor and manager signatures", () => {
  const page = readFileSync("src/app/driver-training/assessments/[assessmentId]/print/page.tsx", "utf8");
  assert.match(page, /assessment\.assessorSignature/);
  assert.match(page, /assessment\.reviewerSignature/);
  assert.match(page, /Assessor digital signature/);
  assert.match(page, /Reviewer digital signature/);
  assert.match(page, /signature-slot/);
  assert.match(page, /Assessor Sign:/);
  assert.match(page, /Mgr Sign:/);
});
