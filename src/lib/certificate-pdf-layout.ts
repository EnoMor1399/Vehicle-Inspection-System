import type { jsPDF } from "jspdf";

/**
 * Readable A4 vehicle certificate layout. Everything, including verification
 * and signatures, comes from the authenticated VIMS record rather than from
 * a graphic or a sample certificate.
 *
 * Uses millimetre geometry with pt-sized text; no 3-5pt microtype.
 * Optional overflow is continued on a numbered annex, not silently clipped.
 */
export type PdfCertificateState = {
  label: string;
  description: string;
  tone: "pass" | "conditional" | "fail" | "pending" | "expired";
};

export type PdfSummary = { code: string; title: string; pass: number; fail: number; na: number };
export type PdfDefect = {
  section: string;
  title: string;
  name: string;
  severity?: string | null;
  remarks?: string | null;
};
export type PdfSignature = { dataUrl: string | null; name: string; signedAt: string | null };

export type CertificatePdfData = {
  companyName: string;
  tagline: string;
  contacts: string[];
  logoDataUrl: string | null;
  certificateNumber: string;
  registration: string;
  state: PdfCertificateState;
  identity: [string, string][];
  inspectionDate: string;
  validity: string;
  station: string;
  workflow: string;
  qrDataUrl: string;
  verificationCode: string;
  measurements: [string, string][];
  summaries: PdfSummary[];
  totals: { pass: number; fail: number; na: number; total: number };
  defects: PdfDefect[];
  remarks: string;
  inspector: string;
  stationAddress: string;
  supervisor: string;
  inspectorSignature: PdfSignature;
  supervisorSignature: PdfSignature;
  supervisorRequired: boolean;
  footer: string;
};

const GREEN: [number, number, number] = [0, 101, 52];
const NAVY: [number, number, number] = [14, 38, 69];
const INK: [number, number, number] = [21, 32, 48];
const MUTED: [number, number, number] = [70, 83, 101];
const BORDER: [number, number, number] = [196, 209, 211];
const FAINT: [number, number, number] = [244, 248, 249];

const L = 8;
const R = 202;
const W = R - L;

function copy(doc: jsPDF, text: string, x: number, y: number, size = 8, bold = false, color = INK, options?: { align?: "center" | "right"; maxWidth?: number }) {
  doc.setFont("helvetica", bold ? "bold" : "normal");
  doc.setFontSize(size);
  doc.setTextColor(...color);
  doc.text(text, x, y, options);
}

function blockLines(doc: jsPDF, value: string, width: number, font = 8, max = 2): string[] {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(font);
  const lines = doc.splitTextToSize(String(value || "Not recorded"), width) as string[];
  return lines.slice(0, max);
}

function ruleBox(doc: jsPDF, x: number, y: number, w: number, h: number, fill = [255, 255, 255] as [number, number, number]) {
  doc.setFillColor(...fill);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, h, "FD");
}

function greenHeading(doc: jsPDF, label: string, x: number, y: number, w: number, h = 8.5, rightText?: string) {
  doc.setFillColor(...GREEN);
  doc.setDrawColor(...GREEN);
  doc.rect(x, y, w, h, "FD");
  copy(doc, label, x + 3, y + h / 2 + 1.2, 9.3, true, [255, 255, 255]);
  if (rightText) {
    copy(doc, rightText, x + w - 3, y + h / 2 + 1.2, 10.5, true, [255, 255, 255], { align: "right" });
  }
}

function field(doc: jsPDF, x: number, y: number, w: number, h: number, label: string, value: string) {
  ruleBox(doc, x, y, w, h, FAINT);
  copy(doc, label.toUpperCase(), x + 2, y + 3.45, 6.8, true, MUTED);
  const lines = blockLines(doc, value, w - 4, 9.3, 2);
  lines.forEach((line, i) => copy(doc, line, x + 2, y + 7.4 + i * 3.1, 9.3, true));
}

function toneColors(tone: PdfCertificateState["tone"]) {
  if (tone === "pass") return { ink: GREEN, bg: [232, 247, 238] as [number, number, number] };
  if (tone === "fail") return { ink: [145, 35, 35] as [number, number, number], bg: [255, 240, 240] as [number, number, number] };
  if (tone === "conditional" || tone === "expired") return { ink: [133, 87, 3] as [number, number, number], bg: [255, 248, 230] as [number, number, number] };
  return { ink: NAVY, bg: [231, 240, 251] as [number, number, number] };
}

function signature(doc: jsPDF, x: number, y: number, w: number, h: number, title: string, value: PdfSignature) {
  ruleBox(doc, x, y, w, h);
  copy(doc, title, x + w / 2, y + 4.1, 7.2, true, NAVY, { align: "center" });
  if (value.dataUrl && /^data:image\/(?:png|jpe?g);base64,/i.test(value.dataUrl)) {
    try {
      const fmt = /image\/png/i.test(value.dataUrl) ? "PNG" : "JPEG";
      doc.addImage(value.dataUrl, fmt, x + 8, y + 6, w - 16, 10, undefined, "FAST");
    } catch {
      // Corrupted or unsupported legacy signatures remain unrepresented.
    }
  }
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.35);
  doc.line(x + 7, y + 17.1, x + w - 7, y + 17.1);
  copy(doc, value.name || "Pending", x + w / 2, y + 21.1, 8.3, true, INK, { align: "center" });
  const status = value.signedAt ? "Signed " + value.signedAt : "Signature date not recorded";
  copy(doc, status, x + w / 2, y + 24.5, 7, false, MUTED, { align: "center" });
}

function header(doc: jsPDF, data: CertificatePdfData) {
  doc.setFillColor(...GREEN);
  doc.rect(L, 4, W - 31, 1.4, "F");
  doc.setFillColor(...NAVY);
  doc.rect(R - 30, 4, 30, 1.4, "F");

  if (data.logoDataUrl && /^data:image\/(?:png|jpe?g);base64,/i.test(data.logoDataUrl)) {
    try {
      doc.addImage(data.logoDataUrl, /image\/png/i.test(data.logoDataUrl) ? "PNG" : "JPEG", L + 1, 7.5, 15.5, 15.5, undefined, "FAST");
    } catch {
      drawFallbackLogo(doc);
    }
  } else {
    drawFallbackLogo(doc);
  }
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.4);
  doc.line(26, 8, 26, 23);
  const org = (data.companyName || "Road Safety Limited").toUpperCase();
  doc.setFont("helvetica", "bold");
  let brandSize = 16;
  while (brandSize > 10 && doc.getTextWidth(org) > 114) {
    brandSize -= 0.5;
    doc.setFontSize(brandSize);
  }
  copy(doc, org, 29.5, 15, brandSize, true, GREEN);
  copy(doc, data.tagline || "Vehicle Inspection Management System", 29.5, 20, 8.5, true, INK);
  doc.setDrawColor(...BORDER);
  doc.line(149, 7.5, 149, 24);
  data.contacts.slice(0, 4).forEach((contact, index) => {
    const lines = blockLines(doc, contact, 48, 7, 1);
    copy(doc, lines[0] || "", 153, 10.6 + index * 3.65, 7, false, INK);
  });

  doc.setFillColor(...NAVY);
  doc.rect(L, 27, 136.5, 21, "F");
  copy(doc, "VEHICLE INSPECTION CERTIFICATE", L + 4, 34.7, 14.2, true, [255, 255, 255]);
  copy(doc, "CONTROLLED VEHICLE INSPECTION RECORD", L + 4, 39.6, 8.5, true, [255, 255, 255]);
  copy(doc, "Generated from the VIMS record - verify current authorization online.", L + 4, 44.4, 7.4, false, [227, 235, 244]);

  const x = 146.5, w = R - x;
  ruleBox(doc, x, 27, w, 11.1, [237, 247, 239]);
  copy(doc, "CERTIFICATE NO.", x + w / 2, 30.4, 7.4, true, NAVY, { align: "center" });
  doc.setFont("helvetica", "bold");
  let numberSize = 11.6;
  while (numberSize > 7.5 && doc.getTextWidth(data.certificateNumber) > w - 4) {
    numberSize -= 0.5;
    doc.setFontSize(numberSize);
  }
  copy(doc, data.certificateNumber, x + w / 2, 35, numberSize, true, GREEN, { align: "center" });

  const tone = toneColors(data.state.tone);
  ruleBox(doc, x, 39, w, 9, tone.bg);
  copy(doc, "CERTIFICATE STATUS", x + w / 2, 42, 6.8, true, NAVY, { align: "center" });
  doc.setFont("helvetica", "bold");
  let chipSize = 10;
  while (chipSize > 7 && doc.getTextWidth(data.state.label) > w - 5) {
    chipSize -= 0.5;
    doc.setFontSize(chipSize);
  }
  copy(doc, data.state.label, x + w / 2, 46.2, chipSize, true, tone.ink, { align: "center" });
}

function drawFallbackLogo(doc: jsPDF) {
  doc.setFillColor(...GREEN);
  doc.roundedRect(L + 1, 7.5, 15.5, 15.5, 1, 1, "F");
  copy(doc, "RSL", L + 8.75, 17.2, 12, true, [255, 255, 255], { align: "center" });
}

function drawMainPage(doc: jsPDF, data: CertificatePdfData) {
  header(doc, data);

  greenHeading(doc, "VEHICLE IDENTIFICATION", L, 50.4, W, 8.5, data.registration);
  data.identity.slice(0, 9).forEach(([label, value], i) => {
    field(doc, L + (i % 3) * (W / 3), 58.9 + Math.floor(i / 3) * 10.6, W / 3, 10.6, label, value);
  });

  const oy = 93.1, ow = 133.5, qx = L + ow + 2, qw = R - qx;
  ruleBox(doc, L, oy, ow, 53.4);
  ruleBox(doc, qx, oy, qw, 53.4);
  greenHeading(doc, "INSPECTION OUTCOME & AUTHORIZATION", L, oy, ow, 8.2);
  greenHeading(doc, "VERIFY AUTHENTICITY", qx, oy, qw, 8.2);

  const tone = toneColors(data.state.tone);
  ruleBox(doc, L + 3, oy + 10, ow - 6, 15, tone.bg);
  doc.setFont("helvetica", "bold");
  let outcomeFont = 12.4;
  while (outcomeFont > 9.5 && doc.getTextWidth(data.state.label) > ow - 12) {
    outcomeFont -= 0.5;
    doc.setFontSize(outcomeFont);
  }
  copy(doc, data.state.label, L + ow / 2, oy + 16.3, outcomeFont, true, tone.ink, { align: "center" });
  const stateLines = blockLines(doc, data.state.description, ow - 12, 7.5, 2);
  stateLines.forEach((line, i) => copy(doc, line, L + ow / 2, oy + 20.5 + i * 3.1, 7.5, false, tone.ink, { align: "center" }));

  const statement = "This document reflects the recorded inspection decision. Validity depends on recorded authorization, conditions and live VIMS verification.";
  const statementLines = blockLines(doc, statement, ow - 8, 7.6, 2);
  statementLines.forEach((line, i) => copy(doc, line, L + 4, oy + 29 + i * 3.4, 7.6, false, INK));

  const meta = [
    ["INSPECTION DATE", data.inspectionDate],
    ["CERTIFICATE VALIDITY", data.validity],
    ["INSPECTION STATION", data.station],
    ["WORKFLOW", data.workflow],
  ];
  const mw = (ow - 7) / 2;
  meta.forEach(([label, value], i) => {
    field(doc, L + 3 + (i % 2) * (mw + 1), oy + 35 + Math.floor(i / 2) * 7.7, mw, 7.7, label, value);
  });

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...GREEN);
  doc.rect(qx + (qw - 31) / 2, oy + 10, 31, 31, "FD");
  doc.addImage(data.qrDataUrl, "PNG", qx + (qw - 29) / 2, oy + 11, 29, 29, undefined, "FAST");
  copy(doc, data.verificationCode, qx + qw / 2, oy + 45, 9.5, true, GREEN, { align: "center" });
  copy(doc, "Scan to verify the current VIMS record", qx + qw / 2, oy + 49, 7.1, false, MUTED, { align: "center" });

  greenHeading(doc, "RECORDED TECHNICAL MEASUREMENTS", L, 148.5, W, 8.5);
  data.measurements.slice(0, 6).forEach(([label, value], i) => {
    field(doc, L + (i % 3) * W / 3, 157 + Math.floor(i / 3) * 10.5, W / 3, 10.5, label, value);
  });

  greenHeading(doc, "CHECKLIST COMPLIANCE SUMMARY", L, 180.1, W, 8.6);
  const t = data.totals;
  const totals = "PASS " + t.pass + "   FAIL " + t.fail + "   N/A " + t.na + "   TOTAL " + t.total;
  copy(doc, totals, R - 3, 185.7, 8.2, true, [255, 255, 255], { align: "right" });
  ruleBox(doc, L, 188.7, W, 33.1);
  if (!data.summaries.length) {
    const historical = "Historical inspection: detailed checklist answers are not recorded. No results have been invented.";
    blockLines(doc, historical, W - 8, 8, 3).forEach((line, i) => copy(doc, line, L + 4, 198 + 5 * i, 8));
  } else {
    const cellW = (W - 6 - 2 * 2) / 3;
    data.summaries.slice(0, 15).forEach((s, i) => {
      const x = L + 3 + (i % 3) * (cellW + 2);
      const y = 190.1 + Math.floor(i / 3) * 6.15;
      ruleBox(doc, x, y, cellW, 5.6, [251, 253, 252]);
      doc.setFillColor(s.fail ? 173 : s.pass ? 4 : 118, s.fail ? 37 : s.pass ? 119 : 130, s.fail ? 37 : s.pass ? 63 : 146);
      doc.circle(x + 2.4, y + 2.8, 1.05, "F");
      const countText = "P" + s.pass + " F" + s.fail + " N" + s.na;
      doc.setFont("courier", "bold");
      doc.setFontSize(6.4);
      const countW = doc.getTextWidth(countText);
      const available = cellW - countW - 8.6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.1);
      const displayName = s.code + " - " + s.title;
      let name = displayName;
      while (name.length > 1 && doc.getTextWidth(name) > available) name = name.slice(0, -2) + "...";
      copy(doc, name, x + 5.2, y + 3.55, 7.1, true, INK);
      doc.setFont("courier", "bold");
      doc.setFontSize(6.4);
      doc.setTextColor(...MUTED);
      doc.text(countText, x + cellW - 1.5, y + 3.55, { align: "right" });
    });
  }

  const dy = 223.7;
  const lw = 99.5;
  ruleBox(doc, L, dy, lw, 21.7);
  ruleBox(doc, L + lw + 2, dy, W - lw - 2, 21.7);
  greenHeading(doc, "DEFECTS / ATTENTION ITEMS", L, dy, lw, 6.6);
  greenHeading(doc, "OFFICIAL REMARKS / CONDITIONS", L + lw + 2, dy, W - lw - 2, 6.6);
  if (!data.defects.length) {
    copy(doc, "No failed checklist items were recorded.", L + 3, dy + 12.3, 9, true, GREEN);
  } else {
    data.defects.slice(0, 2).forEach((item, index) => {
      copy(doc, item.section + " - " + item.name, L + 3, dy + 11 + index * 5, 8.2, true, [151, 39, 39]);
    });
    if (data.defects.length > 2) copy(doc, "See continuation for all findings.", L + 3, dy + 20.5, 7.5, true, MUTED);
  }
  const displayedRemarks = blockLines(doc, data.remarks || "No additional remarks recorded.", W - lw - 8, 8.4, 3);
  displayedRemarks.forEach((line, index) => copy(doc, line, L + lw + 5, dy + 11.1 + index * 3.5, 8.4));

  const ay = 247.4, aW = 68, sigW = (W - aW) / 2;
  field(doc, L, ay, aW, 9, "INSPECTOR", data.inspector);
  field(doc, L, ay + 9, aW, 9, "STATION / ADDRESS", data.stationAddress);
  field(doc, L, ay + 18, aW, 9.2, "SUPERVISOR", data.supervisor);
  signature(doc, L + aW, ay, sigW, 27.2, "INSPECTOR AUTHORIZATION", data.inspectorSignature);
  signature(doc, L + aW + sigW, ay, sigW, 27.2,
    data.supervisorRequired ? "SUPERVISOR AUTHORIZATION" : "SUPERVISOR (OPTIONAL)", data.supervisorSignature);

  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.8);
  doc.line(L, 278.4, R, 278.4);
  copy(doc, data.companyName, L, 283, 10.2, true, GREEN);
  const footerLines = blockLines(doc, data.footer, 145, 7.4, 2);
  footerLines.forEach((line, i) => copy(doc, line, L, 287 + i * 3.2, 7.4, false, MUTED));
  copy(doc, "VERIFY " + data.verificationCode, R, 284, 8.2, true, GREEN, { align: "right" });
  doc.setFillColor(...GREEN);
  doc.rect(L, 293, W - 30, 1.2, "F");
  doc.setFillColor(...NAVY);
  doc.rect(R - 29, 293, 29, 1.2, "F");
}

function continuation(doc: jsPDF, data: CertificatePdfData) {
  const longRemarks = blockLines(doc, data.remarks, W - 10, 9, 100);
  const extraSummaries = data.summaries.slice(15);
  const needsAnnex = data.defects.length > 2 || longRemarks.length > 3 || extraSummaries.length > 0;
  if (!needsAnnex) return;

  doc.addPage();
  doc.setFillColor(...NAVY);
  doc.rect(L, 9, W, 18, "F");
  copy(doc, "CERTIFICATE CONTINUATION / INSPECTION DETAILS", L + 4, 17.2, 14, true, [255, 255, 255]);
  copy(doc, data.certificateNumber + "  |  " + data.registration, L + 4, 23, 9, true, [255, 255, 255]);
  let y = 34;

  if (data.defects.length) {
    greenHeading(doc, "FAILED ITEMS / ATTENTION REQUIRED", L, y, W);
    y += 11;
    for (const [index, defect] of data.defects.entries()) {
      const description = (index + 1) + ". " + defect.section + " - " + defect.name;
      const details = [defect.severity, defect.remarks].filter(Boolean).join(" | ") || defect.title;
      const itemLines = blockLines(doc, description, W - 9, 9, 4);
      const detailLines = blockLines(doc, details, W - 9, 8, 8);
      const h = Math.max(12, 4 + itemLines.length * 3.8 + detailLines.length * 3.3);
      if (y + h > 269) {
        doc.addPage();
        y = 13;
      }
      ruleBox(doc, L, y, W, h, FAINT);
      itemLines.forEach((line, n) => copy(doc, line, L + 3, y + 4.8 + n * 3.8, 9, true, [145, 35, 35]));
      detailLines.forEach((line, n) => copy(doc, line, L + 3, y + 4.8 + itemLines.length * 3.8 + n * 3.3, 8, false, INK));
      y += h + 2;
    }
    y += 3;
  }

  if (longRemarks.length > 3) {
    if (y + 26 > 269) {
      doc.addPage();
      y = 13;
    }
    greenHeading(doc, "FULL OFFICIAL REMARKS / CONDITIONS", L, y, W);
    y += 13;
    const remarksLines = blockLines(doc, data.remarks, W - 8, 9, 600);
    for (const line of remarksLines) {
      if (y + 5 > 275) { doc.addPage(); y = 15; }
      copy(doc, line, L + 3, y, 9);
      y += 4.4;
    }
    y += 5;
  }

  if (extraSummaries.length) {
    if (y + 16 > 270) { doc.addPage(); y = 13; }
    greenHeading(doc, "ADDITIONAL CHECKLIST SECTIONS", L, y, W);
    y += 12;
    extraSummaries.forEach((s) => {
      if (y + 8 > 274) { doc.addPage(); y = 13; }
      const line = s.code + " - " + s.title + "   PASS " + s.pass + " / FAIL " + s.fail + " / N/A " + s.na;
      copy(doc, line, L + 3, y, 8.6);
      y += 6;
    });
  }

  for (let page = 2; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page);
    doc.setDrawColor(...GREEN);
    doc.line(L, 285, R, 285);
    copy(doc, "VIMS CERTIFICATE CONTINUATION - " + data.certificateNumber, L, 290, 8, true, GREEN);
    copy(doc, "Page " + page + " of " + doc.getNumberOfPages(), R, 290, 7.8, true, INK, { align: "right" });
  }
}

export function drawCertificatePdf(doc: jsPDF, data: CertificatePdfData): void {
  drawMainPage(doc, data);
  continuation(doc, data);
}
