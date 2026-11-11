import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { drawCertificatePdf, type CertificatePdfData } from "../src/lib/certificate-pdf-layout";

async function fixture(): Promise<CertificatePdfData> {
  return {
    companyName: "Road Safety Limited",
    tagline: "Vehicle Inspection Management System",
    contacts: ["15 Independence Avenue, Accra", "+233 30 221 1000", "info@rsl.gh", "https://rsl.gh"],
    logoDataUrl: null,
    certificateNumber: "RSL-INS-2026-0009",
    registration: "TT-7720-17",
    state: {
      label: "PENDING AUTHORIZATION",
      tone: "pending",
      description: "Required approval or digital authorization is still outstanding; this document is not yet an issued certificate.",
    },
    identity: [
      ["MAKE / MODEL", "MAN TGX"], ["VIN / CHASSIS", "Not recorded"], ["ENGINE NUMBER", "Not recorded"],
      ["YEAR / BODY TYPE", "2017 / Tanker"], ["CLASS / CATEGORY", "Heavy"], ["FUEL / AXLES", "diesel / 5 axle(s)"],
      ["TRANSPORTER / OWNER", "Gold Coast Haulage"], ["ODOMETER", "Not recorded"], ["INSPECTION TYPE", "bus"],
    ],
    inspectionDate: "25 Jul 2026",
    validity: "Pending authorization",
    station: "Tema Station",
    workflow: "IN PROGRESS",
    qrDataUrl: await QRCode.toDataURL("https://vims.example/verify/test?signed=true"),
    verificationCode: "3879-4FB6-2C4D-5615",
    measurements: [
      ["SERVICE BRAKE EFFICIENCY", "89.50%"], ["PARKING BRAKE EFFICIENCY", "86.10%"],
      ["SMOKE TEST", "PASS"], ["NOISE READING", "Not recorded"],
      ["EXHAUST EMISSION", "Not recorded"], ["OPACITY READING", "1.80"],
    ],
    summaries: "BCDEFGHIJKLMNO".split("").map((code) => ({ code, title: "Safety inspection", pass: 9, fail: 0, na: 0 })),
    totals: { pass: 126, fail: 0, na: 0, total: 126 },
    defects: [],
    remarks: "Approved for continued operation.",
    inspector: "John Mensah",
    stationAddress: "Tema Harbour Road",
    supervisor: "Pending",
    inspectorSignature: { name: "John Mensah", dataUrl: null, signedAt: null },
    supervisorSignature: { name: "Pending", dataUrl: null, signedAt: null },
    supervisorRequired: true,
    footer: "Electronically generated from VIMS. Scan QR to verify current status.",
  };
}

test("readable PDF remains a single A4 portrait page for the supplied inspection example", async () => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: false });
  drawCertificatePdf(doc, await fixture());
  assert.equal(doc.internal.getNumberOfPages(), 1);
  assert.ok(doc.internal.pageSize.getWidth() > 209 && doc.internal.pageSize.getWidth() < 211);
  const pdf = doc.output();
  assert.ok(pdf.length > 5000);
  assert.match(pdf, /PENDING AUTHORIZATION/);
  assert.match(pdf, /RSL-INS-2026-0009/);
  assert.match(pdf, /3879-4FB6-2C4D-5615/);
});

test("failed items, long remarks and extra sections render continuation pages without disappearing", async () => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const record = await fixture();
  record.remarks = "Operator must return for verification. ".repeat(40);
  record.summaries.push({ code: "P", title: "Additional regulatory checks", pass: 0, fail: 1, na: 0 });
  record.defects = Array.from({ length: 7 }, (_, index) => ({
    section: "E",
    title: "Brakes",
    name: "Defect number " + (index + 1),
    severity: "major",
    remarks: "Repair required and re-inspection must be recorded.",
  }));
  drawCertificatePdf(doc, record);
  assert.ok(doc.internal.getNumberOfPages() >= 2);
  assert.ok(doc.output("arraybuffer").byteLength > 5000);
});

test("export endpoint keeps authenticated tenant scope and genuine signed QR verification", () => {
  const source = readFileSync("src/app/api/certificates/[id]/pdf/route.ts", "utf8");
  assert.match(source, /requireAuth\(\)/);
  assert.match(source, /eq\(inspections\.organizationId, currentUser\.organizationId\)/);
  assert.match(source, /canAccessTransporterScope/);
  assert.match(source, /createCertificateSignature\(fingerprint\)/);
  assert.match(source, /certificateVerificationCode\(fingerprint\)/);
  assert.match(source, /QRCode\.toDataURL\(verifyUrl/);
  assert.match(source, /drawCertificatePdf\(doc/);
});

test("professional PDF layout excludes microscopic 3-5pt labels", () => {
  const source = readFileSync("src/lib/certificate-pdf-layout.ts", "utf8");
  assert.doesNotMatch(source, /setFontSize\([345](?:\.\d+)?\)/);
  assert.match(source, /CERTIFICATE NO\./);
  assert.match(source, /VERIFY AUTHENTICITY/);
  assert.match(source, /INSPECTOR AUTHORIZATION/);
});
