import { NextRequest } from "next/server";
import { addMonths } from "date-fns";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { db } from "@/db";
import {
  inspections,
  vehicles,
  signatures,
  transporters,
  locations,
  users,
  type InspectionSectionData,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/require-auth";
import { canAccessTransporterScope, hasPermission } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { certificateVerificationCode, createCertificateSignature } from "@/lib/certificate-security";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PdfSectionSummary = {
  code: string;
  title: string;
  pass: number;
  fail: number;
  na: number;
  status: "pass" | "fail" | "na";
};

const GREEN = [0, 128, 61] as const;
const DARK_GREEN = [0, 91, 43] as const;
const RED = [185, 28, 28] as const;
const AMBER = [180, 83, 9] as const;
const INK = [17, 24, 39] as const;
const MUTED = [100, 116, 139] as const;
const LINE = [203, 213, 225] as const;
const LIGHT_GREEN = [240, 253, 244] as const;
const LIGHT_RED = [254, 242, 242] as const;
const LIGHT_AMBER = [255, 251, 235] as const;

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const currentUser = await requireAuth();
  const { id } = await context.params;

  const [inspection] = await db.select().from(inspections).where(eq(inspections.id, id));
  if (!inspection) return new Response("Certificate not found", { status: 404 });

  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, inspection.vehicleId));
  if (!vehicle || !canAccessTransporterScope(currentUser, vehicle.transporterId)) {
    return new Response("Certificate not found", { status: 404 });
  }
  if (currentUser.role !== "transporter_user" && !hasPermission(currentUser, "inspections")) {
    return new Response("Forbidden", { status: 403 });
  }

  const [transporter] = vehicle.transporterId
    ? await db.select().from(transporters).where(eq(transporters.id, vehicle.transporterId))
    : [];
  const [location] = inspection.locationId
    ? await db.select().from(locations).where(eq(locations.id, inspection.locationId))
    : [];
  const [inspectorUser] = inspection.inspectorId
    ? await db.select().from(users).where(eq(users.id, inspection.inspectorId))
    : [];

  const sigs = await db.select().from(signatures).where(eq(signatures.inspectionId, id));
  const inspectorSig = sigs.find((sig) => sig.type === "inspector");
  const supervisorSig = sigs.find((sig) => sig.type === "supervisor");
  const settings = await getSettings();

  const sections = (inspection.sectionData || []) as InspectionSectionData[];
  const checklistItems = sections.flatMap((section) => section.items || []);
  const totalPass = checklistItems.filter((item) => item.result === "pass").length;
  const totalFail = checklistItems.filter((item) => item.result === "fail").length;
  const totalNa = checklistItems.filter((item) => item.result === "na").length;
  const sectionSummaries: PdfSectionSummary[] = sections.map((section) => {
    const pass = section.items.filter((item) => item.result === "pass").length;
    const fail = section.items.filter((item) => item.result === "fail").length;
    const na = section.items.filter((item) => item.result === "na").length;
    return {
      code: section.section,
      title: section.title,
      pass,
      fail,
      na,
      status: fail > 0 ? "fail" : pass > 0 ? "pass" : "na",
    };
  });
  const failedItems = sections.flatMap((section) =>
    section.items
      .filter((item) => item.result === "fail")
      .map((item) => ({
        section: section.section,
        name: item.name,
        severity: item.severity,
        remarks: item.remarks,
      })),
  );

  const signatureRequirementsMet = !settings.requireDigitalSignature
    || Boolean((inspectorSig || inspection.inspectorSignature)
      && (!settings.requireSupervisorApproval || supervisorSig || inspection.supervisorSignature));
  const approvalRequirementsMet = settings.requireSupervisorApproval
    ? inspection.workflowStatus === "approved"
    : ["completed", "approved"].includes(inspection.workflowStatus);
  const issuanceRequirementsMet = approvalRequirementsMet && signatureRequirementsMet;
  const validUntil = inspection.nextInspectionDate
    ? new Date(`${inspection.nextInspectionDate}T23:59:59`)
    : addMonths(new Date(inspection.inspectionDate), settings.certificateValidityMonths);
  const expired = validUntil.getTime() < Date.now();

  const fingerprint = {
    inspectionId: inspection.id,
    inspectionNumber: inspection.inspectionNumber,
    vehicleRegistration: vehicle.registrationNumber,
    inspectionDate: inspection.inspectionDate,
    overallResult: inspection.overallResult,
    nextInspectionDate: inspection.nextInspectionDate,
  };
  const signature = createCertificateSignature(fingerprint);
  const verificationCode = certificateVerificationCode(fingerprint);
  const verifyUrl = `${request.nextUrl.origin}/verify/${inspection.id}?sig=${encodeURIComponent(signature)}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 256, margin: 1, errorCorrectionLevel: "M" });

  const passSelected = inspection.overallResult === "pass" && issuanceRequirementsMet && !expired;
  const failSelected = ["fail", "reinspection_required"].includes(inspection.overallResult);
  const state = certificateState(inspection.overallResult, issuanceRequirementsMet, expired);
  const operatorName = transporter?.contactPerson || vehicle.ownerName || transporter?.companyName || "Not recorded";
  const operatorEmail = transporter?.email || "Not recorded";
  const operatorPhone = transporter?.mobile || vehicle.ownerContact || "Not recorded";
  const stationAddress = location?.address || inspection.station || "Not recorded";
  const inspectorName = inspection.inspectorName || inspectorSig?.signerName || inspectorUser?.name || "Not recorded";
  const supervisorName = inspection.supervisorName || supervisorSig?.signerName || (settings.requireSupervisorApproval ? "Pending" : "Not required");
  const inspectorSignature = inspectorSig?.dataUrl || inspection.inspectorSignature || null;
  const supervisorSignature = supervisorSig?.dataUrl || inspection.supervisorSignature || null;
  const remarks = compactText(inspection.inspectorRemarks || inspection.supervisorRemarks || "No additional remarks recorded.", 180);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  doc.setProperties({
    title: `Vehicle Inspection Certificate - ${vehicle.registrationNumber}`,
    subject: `VIMS certificate ${inspection.inspectionNumber}`,
    author: settings.companyName,
    creator: "Vehicle Inspection Management System (VIMS)",
  });

  drawCertificate(doc, {
    settings,
    inspection,
    vehicle,
    transporterName: transporter?.companyName || vehicle.ownerName || "Not recorded",
    operatorName,
    operatorEmail,
    operatorPhone,
    stationName: location?.name || inspection.station || "Not recorded",
    stationAddress,
    inspectorName,
    supervisorName,
    inspectorSignature,
    supervisorSignature,
    state,
    passSelected,
    failSelected,
    validUntil,
    issuanceRequirementsMet,
    totalPass,
    totalFail,
    totalNa,
    sectionSummaries,
    failedItems,
    remarks,
    qrDataUrl,
    verificationCode,
  });

  const bytes = Buffer.from(doc.output("arraybuffer"));
  const safeRegistration = vehicle.registrationNumber.replace(/[^A-Za-z0-9_-]+/g, "-");
  const filename = `Vehicle-Inspection-Certificate-${safeRegistration}-${inspection.inspectionNumber}.pdf`;

  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function drawCertificate(doc: jsPDF, data: any) {
  const left = 8;
  const right = 202;
  const width = right - left;
  let y = 8;

  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.45);
  doc.line(left, 3.8, right, 3.8);

  if (data.settings.logoDataUrl && isSupportedImage(data.settings.logoDataUrl)) {
    try {
      doc.addImage(data.settings.logoDataUrl, imageFormat(data.settings.logoDataUrl), left, y, 12, 12, undefined, "FAST");
    } catch {
      drawShield(doc, left + 6, y + 6);
    }
  } else {
    drawShield(doc, left + 6, y + 6);
  }

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK_GREEN);
  doc.setFontSize(15);
  doc.text(compactText(data.settings.companyName || "Road Safety Limited", 40).toUpperCase(), left + 15, y + 5.4);
  doc.setTextColor(...INK);
  doc.setFontSize(5.6);
  doc.text(data.settings.tagline || "Vehicle Inspection Management System", left + 15, y + 9.2);

  const contactX = 146;
  doc.setDrawColor(...LINE);
  doc.line(contactX - 3, y - 0.5, contactX - 3, y + 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.5);
  doc.setTextColor(...INK);
  const contactLines = [
    [data.settings.address, data.settings.city, data.settings.region].filter(Boolean).join(", "),
    data.settings.phone,
    data.settings.email,
    data.settings.website,
  ].filter(Boolean).slice(0, 4);
  contactLines.forEach((line: string, index: number) => {
    doc.text(compactText(line, 48), contactX, y + 2 + index * 3.1);
  });

  y += 16;
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.7);
  doc.line(left, y, 159, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(4.8);
  doc.setTextColor(...DARK_GREEN);
  doc.text(`CERTIFICATE NO. ${data.inspection.inspectionNumber}`, right, y + 1.2, { align: "right" });

  y += 6;
  doc.setFontSize(13.8);
  doc.setTextColor(...INK);
  doc.text("VEHICLE INSPECTION CERTIFICATE", 105, y, { align: "center" });
  y += 3.2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.2);
  doc.setTextColor(...MUTED);
  doc.text("Official single-page digital certificate generated from the approved VIMS inspection record.", 105, y, { align: "center" });

  y += 4;
  const fieldW = width / 4;
  const fieldH = 11.5;
  const fields = [
    ["REGISTRATION", data.vehicle.registrationNumber],
    ["MAKE / MODEL", `${data.vehicle.make} ${data.vehicle.model || ""}`.trim()],
    ["VIN / CHASSIS", data.vehicle.vin || data.vehicle.chassisNumber || "Not recorded"],
    ["YEAR / CLASS", `${data.vehicle.manufacturingYear || "—"} · ${data.vehicle.vehicleClass || data.vehicle.category || "Not recorded"}`],
    ["TRANSPORTER / OWNER", data.transporterName],
    ["OPERATOR / CONTACT", data.operatorName],
    ["PHONE / EMAIL", `${data.operatorPhone}${data.operatorEmail !== "Not recorded" ? ` · ${data.operatorEmail}` : ""}`],
    ["MILEAGE", data.inspection.odometerReading ? `${Number(data.inspection.odometerReading).toLocaleString()} km` : "Not recorded"],
  ];
  fields.forEach((field, index) => {
    const row = Math.floor(index / 4);
    const col = index % 4;
    drawField(doc, left + col * fieldW, y + row * fieldH, fieldW, fieldH, field[0], field[1], index === 0);
  });

  y += fieldH * 2 + 2.5;
  const qrW = 42;
  const resultW = width - qrW;
  const mainH = 39;
  doc.setDrawColor(...DARK_GREEN);
  doc.setLineWidth(0.45);
  doc.roundedRect(left, y, width, mainH, 1.5, 1.5);
  doc.line(left + resultW, y, left + resultW, y + mainH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(4.8);
  doc.setTextColor(...DARK_GREEN);
  doc.text("VEHICLE INSPECTION RESULT", left + 2.5, y + 4);

  const choiceY = y + 6.2;
  const choiceGap = 2;
  const choiceW = (resultW - 7 - choiceGap) / 2;
  drawResultChoice(doc, left + 2.5, choiceY, choiceW, 12.5, "PASS", data.passSelected, "pass");
  drawResultChoice(doc, left + 2.5 + choiceW + choiceGap, choiceY, choiceW, 12.5, "FAIL", data.failSelected, "fail");

  const stateY = choiceY + 14.7;
  const stateColor = data.state.tone === "pass" ? GREEN : data.state.tone === "fail" ? RED : AMBER;
  const stateFill = data.state.tone === "pass" ? LIGHT_GREEN : data.state.tone === "fail" ? LIGHT_RED : LIGHT_AMBER;
  doc.setFillColor(...stateFill);
  doc.setDrawColor(...stateColor);
  doc.roundedRect(left + 2.5, stateY, resultW - 5, 10.5, 1, 1, "FD");
  doc.setTextColor(...stateColor);
  doc.setFontSize(4.1);
  doc.text("RECORDED VIMS OUTCOME", left + resultW / 2, stateY + 2.7, { align: "center" });
  doc.setFontSize(7.2);
  doc.text(data.state.label, left + resultW / 2, stateY + 6, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(3.8);
  doc.text(data.state.description, left + resultW / 2, stateY + 8.5, { align: "center", maxWidth: resultW - 10 });

  const metaY = y + mainH - 5.2;
  const metaW = (resultW - 5) / 3;
  [
    ["INSPECTION", formatDate(data.inspection.inspectionDate)],
    ["VALID UNTIL", data.issuanceRequirementsMet && data.inspection.overallResult === "pass" ? formatDate(data.validUntil) : "Not roadworthy-valid"],
    ["STATION", data.stationName],
  ].forEach((meta, index) => {
    drawMeta(doc, left + 2.5 + index * metaW, metaY, metaW, meta[0], meta[1]);
  });

  const qrX = left + resultW + 4.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(4.8);
  doc.setTextColor(...DARK_GREEN);
  doc.text("SCAN TO VERIFY", qrX + 16.5, y + 4, { align: "center" });
  doc.setDrawColor(...DARK_GREEN);
  doc.rect(qrX + 3, y + 6, 27, 27);
  doc.addImage(data.qrDataUrl, "PNG", qrX + 4, y + 7, 25, 25, undefined, "FAST");
  doc.setFontSize(3.8);
  doc.text(data.verificationCode, qrX + 16.5, y + 35, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.setFontSize(3.3);
  doc.text("Secure online certificate verification", qrX + 16.5, y + 37.3, { align: "center" });

  y += mainH + 3;
  const checklistH = sectionSummariesHeight(data.sectionSummaries.length);
  doc.setDrawColor(...LINE);
  doc.roundedRect(left, y, width, checklistH, 1.3, 1.3);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(4.5);
  doc.setTextColor(...DARK_GREEN);
  doc.text("DIGITAL CHECKLIST COMPLIANCE MATRIX", left + 2.5, y + 4);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.setFontSize(3.5);
  doc.text("Each row is calculated from the item-level checklist stored in VIMS.", left + 2.5, y + 6.5);

  const scoreX = right - 39;
  const scores = [
    ["PASS", data.totalPass, GREEN],
    ["FAIL", data.totalFail, RED],
    ["N/A", data.totalNa, MUTED],
    ["TOTAL", data.totalPass + data.totalFail + data.totalNa, INK],
  ];
  scores.forEach((score: any, index: number) => drawScore(doc, scoreX + index * 9.5, y + 1.5, 8.8, score[0], score[1], score[2]));

  if (data.sectionSummaries.length === 0) {
    doc.setFillColor(...LIGHT_AMBER);
    doc.setDrawColor(...AMBER);
    doc.roundedRect(left + 2.5, y + 9, width - 5, 10, 1, 1, "FD");
    doc.setTextColor(...AMBER);
    doc.setFontSize(4);
    doc.text("Historical record: item-level checklist responses were not present in the source register.", left + 5, y + 14.5);
  } else {
    const matrixTop = y + 9;
    const colGap = 2.5;
    const colW = (width - 5 - colGap) / 2;
    const rowH = 6.4;
    data.sectionSummaries.forEach((section: PdfSectionSummary, index: number) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      drawSectionSummary(doc, left + 2.5 + col * (colW + colGap), matrixTop + row * rowH, colW, rowH - 0.7, section);
    });
  }

  y += checklistH + 2.5;
  const lowerH = 27;
  const lowerGap = 2;
  const defectsW = width * 0.66;
  drawDefects(doc, left, y, defectsW, lowerH, data.failedItems);
  drawRemarks(doc, left + defectsW + lowerGap, y, width - defectsW - lowerGap, lowerH, data.remarks);

  y += lowerH + 2.5;
  const authH = 19.5;
  doc.setDrawColor(...LINE);
  doc.roundedRect(left, y, width, authH, 1.2, 1.2);
  const authFieldsW = width * 0.48;
  const sigW = (width - authFieldsW) / 2;
  drawAuthFields(doc, left, y, authFieldsW, authH, [
    ["INSPECTOR", data.inspectorName],
    ["INSPECTION ADDRESS / STATION", data.stationAddress],
    ["WORKFLOW", String(data.inspection.workflowStatus).replaceAll("_", " ").toUpperCase()],
    ["SUPERVISOR", data.supervisorName],
  ]);
  drawSignature(doc, left + authFieldsW, y, sigW, authH, "INSPECTOR SIGNATURE", data.inspectorSignature, data.inspectorName);
  drawSignature(doc, left + authFieldsW + sigW, y, sigW, authH, "SUPERVISOR SIGNATURE", data.supervisorSignature, data.supervisorName);

  y += authH + 2.5;
  doc.setDrawColor(...DARK_GREEN);
  doc.setLineWidth(0.5);
  doc.line(left, y, right, y);
  doc.setTextColor(...DARK_GREEN);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(4);
  doc.text(data.settings.companyName, left, y + 3.2);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.setFontSize(3.2);
  doc.text(compactText(data.settings.certificateFooter || "Electronically generated controlled certificate. Scan the QR code to verify authenticity.", 135), left, y + 5.8, { maxWidth: 145 });
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK_GREEN);
  doc.setFontSize(3.5);
  doc.text("ONE-PAGE A4 CONTROLLED DOCUMENT", right, y + 3.2, { align: "right" });
}

function drawShield(doc: jsPDF, cx: number, cy: number) {
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.7);
  doc.circle(cx, cy, 4.2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...GREEN);
  doc.text("✓", cx, cy + 1.7, { align: "center" });
}

function drawField(doc: jsPDF, x: number, y: number, w: number, h: number, label: string, value: string, strong = false) {
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, h);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(3.4);
  doc.setTextColor(...MUTED);
  doc.text(label, x + 1.4, y + 2.8);
  doc.setTextColor(...(strong ? DARK_GREEN : INK));
  doc.setFontSize(strong ? 6 : 4.6);
  const lines = doc.splitTextToSize(compactText(String(value || "—"), 58), w - 2.8);
  doc.text(lines.slice(0, 2), x + 1.4, y + 6.2);
}

function drawResultChoice(doc: jsPDF, x: number, y: number, w: number, h: number, label: string, active: boolean, tone: "pass" | "fail") {
  const color = tone === "pass" ? GREEN : RED;
  const fill = tone === "pass" ? LIGHT_GREEN : LIGHT_RED;
  doc.setDrawColor(...(active ? color : LINE));
  doc.setFillColor(...(active ? fill : [250, 250, 250] as const));
  doc.rect(x, y, w, h, "FD");
  const box = 4.2;
  const centerX = x + w / 2;
  doc.setDrawColor(...(active ? color : MUTED));
  doc.rect(centerX - 12, y + 4.1, box, box);
  if (active) {
    doc.setFillColor(...color);
    doc.rect(centerX - 12, y + 4.1, box, box, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6);
    doc.text("✓", centerX - 9.9, y + 7.4, { align: "center" });
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...color);
  doc.text(label, centerX + 2, y + 8.3, { align: "center" });
}

function drawMeta(doc: jsPDF, x: number, y: number, w: number, label: string, value: string) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(3.1);
  doc.setTextColor(...MUTED);
  doc.text(label, x, y);
  doc.setFontSize(3.7);
  doc.setTextColor(...INK);
  doc.text(compactText(String(value), 28), x, y + 2.4, { maxWidth: w - 1 });
}

function drawScore(doc: jsPDF, x: number, y: number, w: number, label: string, value: number, color: readonly number[]) {
  doc.setDrawColor(...LINE);
  doc.rect(x, y, w, 6.2);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(color[0], color[1], color[2]);
  doc.setFontSize(3.1);
  doc.text(label, x + w / 2, y + 2.1, { align: "center" });
  doc.setFontSize(5.2);
  doc.text(String(value), x + w / 2, y + 5, { align: "center" });
}

function sectionSummariesHeight(count: number) {
  if (count === 0) return 22;
  const rows = Math.ceil(count / 2);
  return Math.min(59, 11 + rows * 6.4);
}

function drawSectionSummary(doc: jsPDF, x: number, y: number, w: number, h: number, section: PdfSectionSummary) {
  const color = section.status === "pass" ? GREEN : section.status === "fail" ? RED : MUTED;
  doc.setDrawColor(...LINE);
  doc.rect(x, y, w, h);
  doc.setFillColor(...color);
  doc.circle(x + 3.1, y + h / 2, 1.65, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(3.5);
  doc.text(section.status === "pass" ? "✓" : section.status === "fail" ? "×" : "—", x + 3.1, y + h / 2 + 1, { align: "center" });
  doc.setTextColor(...INK);
  doc.setFontSize(3.7);
  doc.text(compactText(`${section.code} · ${section.title}`, 42), x + 6, y + h / 2 + 0.8, { maxWidth: w - 28 });
  doc.setTextColor(...MUTED);
  doc.setFont("courier", "normal");
  doc.setFontSize(3.2);
  doc.text(`P${section.pass} F${section.fail} N${section.na}`, x + w - 2, y + h / 2 + 0.8, { align: "right" });
}

function drawDefects(doc: jsPDF, x: number, y: number, w: number, h: number, failedItems: any[]) {
  doc.setDrawColor(...LINE);
  doc.rect(x, y, w, h);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(4.2);
  doc.setTextColor(...DARK_GREEN);
  doc.text("FAILED / ATTENTION ITEMS", x + 2, y + 3.7);
  if (!failedItems.length) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.setFontSize(3.8);
    doc.text("No failed checklist items recorded.", x + 2, y + 8);
    return;
  }
  failedItems.slice(0, 4).forEach((item, index) => {
    const iy = y + 7 + index * 4.6;
    doc.setDrawColor(...RED);
    doc.line(x + 2, iy - 1.2, x + 2, iy + 2.2);
    doc.setTextColor(...RED);
    doc.setFontSize(3.5);
    doc.text(compactText(`${item.section} · ${item.name}`, 45), x + 4, iy);
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(3);
    doc.text(compactText([item.severity && `${item.severity} defect`, item.remarks].filter(Boolean).join(" — ") || "Recorded checklist defect", 66), x + 4, iy + 2.2, { maxWidth: w - 6 });
    doc.setFont("helvetica", "bold");
  });
  if (failedItems.length > 4) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.setFontSize(3);
    doc.text(`+ ${failedItems.length - 4} additional failed item(s) in the VIMS inspection record.`, x + 2, y + h - 2);
  }
}

function drawRemarks(doc: jsPDF, x: number, y: number, w: number, h: number, remarks: string) {
  doc.setDrawColor(...LINE);
  doc.rect(x, y, w, h);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(4.2);
  doc.setTextColor(...DARK_GREEN);
  doc.text("OFFICIAL REMARKS", x + 2, y + 3.7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...INK);
  doc.setFontSize(3.5);
  const lines = doc.splitTextToSize(remarks, w - 4);
  doc.text(lines.slice(0, 6), x + 2, y + 7);
  doc.setTextColor(...MUTED);
  doc.setFontSize(2.8);
  doc.text("Full checklist, photos and detailed remarks remain available in the inspection record.", x + 2, y + h - 2, { maxWidth: w - 4 });
}

function drawAuthFields(doc: jsPDF, x: number, y: number, w: number, h: number, fields: string[][]) {
  const fieldW = w / 2;
  const fieldH = h / 2;
  fields.forEach((field, index) => {
    const row = Math.floor(index / 2);
    const col = index % 2;
    drawField(doc, x + col * fieldW, y + row * fieldH, fieldW, fieldH, field[0], field[1]);
  });
}

function drawSignature(doc: jsPDF, x: number, y: number, w: number, h: number, title: string, dataUrl: string | null, name: string) {
  doc.setDrawColor(...LINE);
  doc.rect(x, y, w, h);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(3.4);
  doc.setTextColor(...MUTED);
  doc.text(title, x + w / 2, y + 3, { align: "center" });
  if (dataUrl && isSupportedImage(dataUrl)) {
    try {
      doc.addImage(dataUrl, imageFormat(dataUrl), x + 5, y + 4.2, w - 10, 8, undefined, "FAST");
    } catch {
      // Fall through to the signature line if an old signature image cannot be decoded.
    }
  }
  doc.setDrawColor(...MUTED);
  doc.line(x + 5, y + 13.4, x + w - 5, y + 13.4);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...INK);
  doc.setFontSize(3.4);
  doc.text(compactText(name, 28), x + w / 2, y + 16.2, { align: "center" });
}

function certificateState(result: string, issuanceRequirementsMet: boolean, expired: boolean) {
  if (expired && issuanceRequirementsMet) {
    return { tone: "expired", label: "EXPIRED", description: "The recorded certificate validity period has ended." };
  }
  if (!issuanceRequirementsMet) {
    return { tone: "pending", label: "PENDING AUTHORIZATION", description: "Approval or required digital signature is still outstanding." };
  }
  if (result === "pass") return { tone: "pass", label: "PASS / CERTIFIED", description: "Vehicle met the recorded inspection requirements." };
  if (result === "fail") return { tone: "fail", label: "FAIL", description: "Vehicle did not meet the recorded inspection requirements." };
  if (result === "conditional_pass") return { tone: "conditional", label: "CONDITIONAL PASS", description: "Vehicle passed subject to the recorded conditions." };
  if (result === "reinspection_required") return { tone: "fail", label: "RE-INSPECTION REQUIRED", description: "Vehicle requires re-inspection before certification." };
  return { tone: "pending", label: result.replaceAll("_", " ").toUpperCase(), description: "Recorded VIMS inspection outcome." };
}

function compactText(value: string, max: number) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function isSupportedImage(dataUrl: string) {
  return /^data:image\/(png|jpe?g);base64,/i.test(dataUrl);
}

function imageFormat(dataUrl: string): "PNG" | "JPEG" {
  return /image\/png/i.test(dataUrl) ? "PNG" : "JPEG";
}
