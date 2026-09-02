import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  isSupportedEvidenceImageDataUrl,
  isSupportedSignatureDataUrl,
  validateDailyInspectionEvidence,
  validateInspectionDocuments,
  validateInspectionEvidence,
  validateSignatureDataUrl,
} from "../src/lib/inspection-evidence";

const jpeg = "data:image/jpeg;base64,/9j/AA==";
const pngSignature = "data:image/png;base64,iVBORw0KGgo=";

test("shared evidence policy accepts supported images and blocks active formats", () => {
  assert.equal(isSupportedEvidenceImageDataUrl(jpeg), true);
  assert.equal(isSupportedEvidenceImageDataUrl("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="), false);
  assert.doesNotThrow(() => validateInspectionEvidence([{ items: [{ photos: [{ dataUrl: jpeg }] }] }]));
  assert.doesNotThrow(() => validateDailyInspectionEvidence([{ items: [{ photos: [jpeg] }] }]));
});

test("signature policy accepts only bounded PNG canvas output", () => {
  assert.equal(isSupportedSignatureDataUrl(pngSignature), true);
  assert.equal(isSupportedSignatureDataUrl(jpeg), false);
  assert.doesNotThrow(() => validateSignatureDataUrl(pngSignature, "Test signature"));
  assert.throws(() => validateSignatureDataUrl(jpeg, "Test signature"), /bounded PNG signature image/);
});

test("inspection attachment policy accepts bounded PDF metadata and rejects MIME or size spoofing", () => {
  const bytes = Buffer.from("%PDF-1.4\n");
  const dataUrl = `data:application/pdf;base64,${bytes.toString("base64")}`;
  const valid = { id: "doc-1", name: "brake-report.pdf", dataUrl, type: "application/pdf", size: bytes.length };
  assert.doesNotThrow(() => validateInspectionDocuments([valid]));
  assert.throws(
    () => validateInspectionDocuments([{ ...valid, type: "application/vnd.ms-excel" }]),
    /MIME type does not match/
  );
  assert.throws(
    () => validateInspectionDocuments([{ ...valid, size: bytes.length + 100 }]),
    /size metadata does not match/
  );
  assert.throws(
    () => validateInspectionDocuments([{ ...valid, dataUrl: "data:text/html;base64,PGgxPmhpPC9oMT4=" }]),
    /limited to PDF, JPEG, and PNG/
  );
});

test("daily inspection direct-detail access requires inspection permission for internal accounts", () => {
  const source = readFileSync("src/app/daily-inspections/server.ts", "utf8");
  assert.match(source, /user\.role !== "transporter_user" && !canManageInspections\(user\)/);
  assert.match(source, /validateDailyInspectionEvidence\(checklist\)/);
  assert.match(source, /validateSignatureDataUrl\(input\.driverSignature/);
});
