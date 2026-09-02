import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createCertificateSignature,
  isCertificateSignatureFormat,
  verifyCertificateSignature,
} from "../src/lib/certificate-security";

const fingerprint = {
  inspectionId: "11111111-1111-4111-8111-111111111111",
  inspectionNumber: "INS-20260902-ABC12345",
  vehicleRegistration: "GT-1234-26",
  inspectionDate: "2026-09-02T10:00:00.000Z",
  overallResult: "pass",
  nextInspectionDate: "2027-09-02",
};

test("certificate signatures use a bounded base64url format and verify exactly", () => {
  const previous = process.env.CERTIFICATE_SIGNING_SECRET;
  process.env.CERTIFICATE_SIGNING_SECRET = "test-certificate-secret-that-is-long-and-random-enough";
  try {
    const signature = createCertificateSignature(fingerprint);
    assert.equal(signature.length, 43);
    assert.equal(isCertificateSignatureFormat(signature), true);
    assert.equal(verifyCertificateSignature(fingerprint, signature), true);
    assert.equal(verifyCertificateSignature({ ...fingerprint, overallResult: "fail" }, signature), false);
  } finally {
    if (previous === undefined) delete process.env.CERTIFICATE_SIGNING_SECRET;
    else process.env.CERTIFICATE_SIGNING_SECRET = previous;
  }
});

test("certificate verification rejects malformed or abusive signature strings before comparison", () => {
  for (const signature of [
    undefined,
    "",
    "short",
    "x".repeat(42),
    "x".repeat(44),
    "x".repeat(10_000),
    "!".repeat(43),
  ]) {
    assert.equal(isCertificateSignatureFormat(signature), false);
    assert.equal(verifyCertificateSignature(fingerprint, signature), false);
  }
});

test("public certificate verification does not render sensitive vehicle or handwritten signature fields", () => {
  const source = readFileSync("src/app/verify/[id]/page.tsx", "utf8");
  assert.match(source, /isCertificateSignatureFormat\(suppliedSignature\)/);
  assert.match(source, /Verification Could Not Be Confirmed/);
  assert.doesNotMatch(source, /v\.vin/);
  assert.doesNotMatch(source, /v\.chassisNumber/);
  assert.doesNotMatch(source, /sig\.dataUrl/);
  assert.doesNotMatch(source, /signerName/);
});
