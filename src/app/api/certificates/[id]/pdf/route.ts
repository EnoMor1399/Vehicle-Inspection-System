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

type Summary = {
  code: string;
  title: string;
  pass: number;
  fail: number;
  na: number;
};

type CertificateState = {
  label: string;
  tone: "pass" | "conditional" | "fail" | "pending" | "expired";
  description: string;
};

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
  const items = sections.flatMap((section) => section.items || []);
  const totalPass = items.filter((item) => item.result === "pass").length;
  const totalFail = items.filter((item) => item.result === "fail").length;
  const totalNa = items.filter((item) => item.result === "na").length;
  const summaries: Summary[] = sections.map((section) => ({
    code: section.section,
    title: section.title,
    pass: section.items.filter((item) => item.result === "pass").length,
    fail: section.items.filter((item) => item.result === "fail").length,
    na: section.items.filter((item) => item.result === "na").length,
  }));
  const failedItems = sections.flatMap((section) =>
    section.items
      .filter((item) => item.result === "fail")
      .map((item) => ({
        section: section.section,
        title: section.title,
        name: item.name,
        severity: item.severity,
        remarks: item.remarks,
      })),
  );

  const signatureRequirementsMet = !settings.requireDigitalSignature
    || Boolean(
      (inspectorSig || inspection.inspectorSignature)
      && (!settings.requireSupervisorApproval || supervisorSig || inspection.supervisorSignature),
    );
  const approvalRequirementsMet = settings.requireSupervisorApproval
    ? inspection.workflowStatus === "approved"
    : ["completed", "approved"].includes(inspection.workflowStatus);
  const issuanceRequirementsMet = approvalRequirementsMet && signatureRequirementsMet;

  const validUntil = inspection.nextInspectionDate
    ? new Date(`${inspection.nextInspectionDate}T23:59:59`)
    : addMonths(new Date(inspection.inspectionDate), settings.certificateValidityMonths);
  const validityApplies = ["pass", "conditional_pass"].includes(inspection.overallResult);
  const expired = issuanceRequirementsMet && validityApplies && validUntil.getTime() < Date.now();
  const state = certificateState(inspection.overallResult, issuanceRequirementsMet, expired);
  const validityText = certificateValidityText(
    inspection.overallResult,
    issuanceRequirementsMet,
    expired,
    validUntil,
  );

  const fingerprint = {
    inspectionId: inspection.id,
    inspectionNumber: inspection.inspectionNumber,
    vehicleRegistration: vehicle.registrationNumber,
    inspectionDate: inspection.inspectionDate,
    overallResult: inspection.overallResult,
    nextInspectionDate: inspection.nextInspectionDate,
  };
  const signedToken = createCertificateSignature(fingerprint);
  const verificationCode = certificateVerificationCode(fingerprint);
  const verifyUrl = `${request.nextUrl.origin}/verify/${inspection.id}?sig=${encodeURIComponent(signedToken)}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    width: 256,
    margin: 1,
    errorCorrectionLevel: "M",
  });

  const operatorName = transporter?.companyName || vehicle.ownerName || "Not recorded";
  const inspectorName = inspection.inspectorName || inspectorSig?.signerName || inspectorUser?.name || "Not recorded";
  const supervisorName = inspection.supervisorName
    || supervisorSig?.signerName
    || (settings.requireSupervisorApproval ? "Pending" : "Not required");
  const stationName = location?.name || inspection.station || "Not recorded";
  const stationAddress = location?.address || inspection.station || "Not recorded";
  const remarks = short(inspection.supervisorRemarks || inspection.inspectorRemarks || "No additional remarks recorded.", 220);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  doc.setProperties({
    title: `Vehicle Inspection Certificate - ${vehicle.registrationNumber}`,
    subject: `VIMS certificate ${inspection.inspectionNumber}`,
    author: settings.companyName,
    creator: "Vehicle Inspection Management System (VIMS)",
  });

  const left = 9;
  const right = 201;
  const width = right - left;
  let y = 7;

  drawTopLine(doc, left, right);
  drawHeader(doc, {
    x: left,
    y,
    width,
    companyName: settings.companyName,
    tagline: settings.tagline || "Vehicle Inspection Management System (VIMS)",
    logoDataUrl: settings.logoDataUrl,
    contacts: [
      [settings.address, settings.city, settings.region].filter(Boolean).join(", "),
      settings.phone,
      settings.email,
      settings.website,
    ].filter(Boolean) as string[],
  });

  y += 18;
  doc.setDrawColor(0, 112, 55);
  doc.setLineWidth(0.65);
  doc.line(left, y, 157, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.4);
  doc.setTextColor(0, 91, 43);
  doc.text(`CERTIFICATE NO. ${inspection.inspectionNumber}`, right, y + 1.4, { align: "right" });

  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(17, 24, 39);
  doc.text("VEHICLE INSPECTION CERTIFICATE", left, y);
  doc.setFontSize(4.5);
  doc.setTextColor(0, 91, 43);
  doc.text("CONTROLLED VEHICLE INSPECTION RECORD", left, y - 4.1);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.2);
  doc.setTextColor(100, 116, 139);
  doc.text("Issued from the approved VIMS inspection record and independently verifiable online.", left, y + 3.4);
  drawStateChip(doc, right - 48, y - 8, 48, 12, state);

  y += 7;
  sectionHeader(doc, left, y, width, "VEHICLE IDENTIFICATION", "Primary identifiers binding this certificate to the inspected vehicle.", vehicle.registrationNumber);
  y += 8;

  const identity = [
    ["MAKE / MODEL", `${vehicle.make} ${vehicle.model || ""}`.trim()],
    ["VIN / CHASSIS", vehicle.vin || vehicle.chassisNumber || "Not recorded"],
    ["ENGINE NUMBER", vehicle.engineNumber || "Not recorded"],
    ["YEAR / BODY TYPE", `${vehicle.manufacturingYear || "—"} · ${vehicle.bodyType || "Not recorded"}`],
    ["CLASS / CATEGORY", vehicle.vehicleClass || vehicle.category || "Not recorded"],
    ["FUEL / AXLES", `${vehicle.fuelType || "Not recorded"} · ${vehicle.numberOfAxles ?? "—"} axle(s)`],
    ["TRANSPORTER / OWNER", operatorName],
    ["ODOMETER", inspection.odometerReading ? `${Number(inspection.odometerReading).toLocaleString()} km` : "Not recorded"],
    ["INSPECTION TYPE", inspection.templateType ? inspection.templateType.replaceAll("_", " ") : "Comprehensive vehicle inspection"],
  ];
  const identityW = width / 3;
  const identityH = 9.5;
  identity.forEach((field, index) => {
    drawInfoCell(
      doc,
      left + (index % 3) * identityW,
      y + Math.floor(index / 3) * identityH,
      identityW,
      identityH,
      field[0],
      field[1],
      index === 1 || index === 2,
    );
  });

  y += identityH * 3 + 3;
  const qrW = 43;
  const outcomeW = width - qrW;
  const outcomeH = 41;
  doc.setDrawColor(0, 91, 43);
  doc.setLineWidth(0.45);
  doc.roundedRect(left, y, width, outcomeH, 1.5, 1.5);
  doc.line(left + outcomeW, y, left + outcomeW, y + outcomeH);

  heading(doc, "CERTIFIED INSPECTION OUTCOME", left + 3, y + 4.5);
  drawOutcomeBox(doc, left + 3, y + 7, outcomeW - 6, 12, state);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.1);
  doc.setTextColor(71, 85, 105);
  const statement = "This certificate records the inspection decision captured in VIMS for the vehicle identified above. Validity is subject to the recorded outcome, authorization status and online verification.";
  doc.text(doc.splitTextToSize(statement, outcomeW - 7).slice(0, 2), left + 3.2, y + 23);

  const metaY = y + 29.2;
  const metaW = (outcomeW - 7.5) / 2;
  drawMetaBox(doc, left + 3, metaY, metaW, 5.2, "INSPECTION DATE", formatDate(inspection.inspectionDate));
  drawMetaBox(doc, left + 4 + metaW, metaY, metaW, 5.2, "CERTIFICATE VALIDITY", validityText);
  drawMetaBox(doc, left + 3, metaY + 6.2, metaW, 5.2, "INSPECTION STATION", stationName);
  drawMetaBox(doc, left + 4 + metaW, metaY + 6.2, metaW, 5.2, "WORKFLOW", inspection.workflowStatus.replaceAll("_", " ").toUpperCase());

  const qrX = left + outcomeW + 5;
  heading(doc, "VERIFY AUTHENTICITY", qrX + 15, y + 4.5, "center");
  doc.setDrawColor(0, 91, 43);
  doc.rect(qrX + 2, y + 7, 27, 27);
  doc.addImage(qrDataUrl, "PNG", qrX + 3, y + 8, 25, 25, undefined, "FAST");
  doc.setFont("courier", "bold");
  doc.setFontSize(4.5);
  doc.setTextColor(0, 91, 43);
  doc.text(verificationCode, qrX + 15.5, y + 36.2, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(3.4);
  doc.setTextColor(100, 116, 139);
  doc.text("Scan to confirm the current VIMS record.", qrX + 15.5, y + 39, { align: "center", maxWidth: 34 });

  y += outcomeH + 3;
  sectionHeader(doc, left, y, width, "RECORDED TECHNICAL MEASUREMENTS", "Values are reproduced from the completed inspection record.");
  y += 8;
  const measurements = [
    ["SERVICE BRAKE EFFICIENCY", percentReading(inspection.serviceBrakeEfficiency)],
    ["PARKING BRAKE EFFICIENCY", percentReading(inspection.parkingBrakeEfficiency)],
    ["SMOKE TEST", resultReading(inspection.smokeTest)],
    ["NOISE READING", plainReading(inspection.noiseLevel)],
    ["EXHAUST EMISSION", plainReading(inspection.exhaustEmission)],
    ["OPACITY READING", plainReading(inspection.opacityTest)],
  ];
  const measureW = width / 3;
  const measureH = 8.4;
  measurements.forEach((field, index) => {
    drawMeasurement(doc, left + (index % 3) * measureW, y + Math.floor(index / 3) * measureH, measureW, measureH, field[0], field[1]);
  });

  y += measureH * 2 + 3;
  const rows = Math.max(1, Math.ceil(summaries.length / 3));
  const matrixH = summaries.length ? 10 + rows * 6.3 : 18;
  doc.setDrawColor(190, 203, 194);
  doc.roundedRect(left, y, width, matrixH, 1.3, 1.3);
  heading(doc, "CHECKLIST COMPLIANCE SUMMARY", left + 3, y + 4.2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(3.8);
  doc.setTextColor(100, 116, 139);
  doc.text(`PASS ${totalPass}   FAIL ${totalFail}   N/A ${totalNa}   TOTAL ${items.length}`, right - 3, y + 4.2, { align: "right" });

  if (!summaries.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(4.1);
    doc.setTextColor(148, 101, 7);
    doc.text(
      "Historical record: item-level checklist responses were not present in the source register; VIMS preserves the recorded overall result without inventing checklist answers.",
      left + 3,
      y + 10,
      { maxWidth: width - 6 },
    );
  } else {
    const colGap = 2;
    const colW = (width - 6 - colGap * 2) / 3;
    summaries.forEach((summary, index) => {
      const sx = left + 3 + (index % 3) * (colW + colGap);
      const sy = y + 7.2 + Math.floor(index / 3) * 6.3;
      drawSummary(doc, sx, sy, colW, 5.6, summary);
    });
  }

  y += matrixH + 3;
  const lowerH = 24;
  const leftBoxW = 113;
  doc.setDrawColor(203, 213, 225);
  doc.rect(left, y, leftBoxW, lowerH);
  doc.rect(left + leftBoxW + 2, y, width - leftBoxW - 2, lowerH);
  heading(doc, "DEFECTS / ATTENTION ITEMS", left + 2.5, y + 4);
  if (!failedItems.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(4.4);
    doc.setTextColor(0, 91, 43);
    doc.text("No failed checklist items were recorded.", left + 2.5, y + 9);
  } else {
    failedItems.slice(0, 3).forEach((item, index) => {
      const lineY = y + 8 + index * 4.7;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(3.8);
      doc.setTextColor(166, 27, 27);
      doc.text(short(`${item.section} · ${item.name}`, 52), left + 2.5, lineY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(3.3);
      doc.setTextColor(100, 116, 139);
      doc.text(short([item.severity && `${item.severity} defect`, item.remarks].filter(Boolean).join(" — ") || item.title, 74), left + 2.5, lineY + 2.2);
    });
    if (failedItems.length > 3) {
      doc.setFontSize(3.2);
      doc.setTextColor(100, 116, 139);
      doc.text(`+ ${failedItems.length - 3} additional failed item(s) in the VIMS record.`, left + 2.5, y + 22);
    }
  }

  const remarksX = left + leftBoxW + 4.5;
  heading(doc, "OFFICIAL REMARKS / CONDITIONS", remarksX, y + 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(3.7);
  doc.setTextColor(47, 58, 72);
  doc.text(doc.splitTextToSize(remarks, width - leftBoxW - 7).slice(0, 8), remarksX, y + 8);

  y += lowerH + 3;
  const authH = 23;
  const authW = 71;
  const sigW = (width - authW) / 2;
  doc.setDrawColor(203, 213, 225);
  doc.rect(left, y, width, authH);
  drawAuthField(doc, left, y, authW, authH / 3, "INSPECTOR", inspectorName);
  drawAuthField(doc, left, y + authH / 3, authW, authH / 3, "STATION / ADDRESS", stationAddress);
  drawAuthField(doc, left, y + (authH / 3) * 2, authW, authH / 3, "SUPERVISOR", supervisorName);
  drawSignature(
    doc,
    left + authW,
    y,
    sigW,
    authH,
    "INSPECTOR AUTHORIZATION",
    inspectorSig?.dataUrl || inspection.inspectorSignature || null,
    inspectorName,
    inspectorSig?.signedAt || null,
  );
  drawSignature(
    doc,
    left + authW + sigW,
    y,
    sigW,
    authH,
    settings.requireSupervisorApproval ? "SUPERVISOR AUTHORIZATION" : "SUPERVISOR AUTHORIZATION (OPTIONAL)",
    supervisorSig?.dataUrl || inspection.supervisorSignature || null,
    supervisorName,
    supervisorSig?.signedAt || null,
  );

  y += authH + 3;
  doc.setDrawColor(0, 91, 43);
  doc.setLineWidth(0.6);
  doc.line(left, y, right, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(4.4);
  doc.setTextColor(0, 91, 43);
  doc.text(settings.companyName, left, y + 3.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(3.3);
  doc.setTextColor(100, 116, 139);
  doc.text(
    short(settings.certificateFooter || "Electronically generated controlled certificate. Scan the QR code to verify authenticity and current status.", 175),
    left,
    y + 6.2,
    { maxWidth: 142 },
  );
  doc.setFont("courier", "bold");
  doc.setFontSize(4);
  doc.setTextColor(0, 91, 43);
  doc.text(`VERIFY ${verificationCode}`, right, y + 3.5, { align: "right" });

  const bytes = new Uint8Array(doc.output("arraybuffer"));
  const safeRegistration = vehicle.registrationNumber.replace(/[^A-Za-z0-9_-]+/g, "-");
  const filename = `Vehicle-Inspection-Certificate-${safeRegistration}-${inspection.inspectionNumber}.pdf`;
  return new Response(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function drawTopLine(doc: jsPDF, left: number, right: number) {
  doc.setDrawColor(0, 128, 61);
  doc.setLineWidth(0.55);
  doc.line(left, 3.8, right, 3.8);
}

function drawHeader(
  doc: jsPDF,
  input: {
    x: number;
    y: number;
    width: number;
    companyName: string;
    tagline: string;
    logoDataUrl: string | null;
    contacts: string[];
  },
) {
  const { x, y, width, companyName, tagline, logoDataUrl, contacts } = input;
  if (logoDataUrl && /^data:image\/(png|jpe?g);base64,/i.test(logoDataUrl)) {
    try {
      doc.addImage(logoDataUrl, /image\/png/i.test(logoDataUrl) ? "PNG" : "JPEG", x, y, 14, 14, undefined, "FAST");
    } catch {
      drawLogoFallback(doc, x + 7, y + 7);
    }
  } else {
    drawLogoFallback(doc, x + 7, y + 7);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(0, 91, 43);
  doc.text(short(companyName || "Road Safety Limited", 38).toUpperCase(), x + 17, y + 6.4);
  doc.setFontSize(6);
  doc.setTextColor(31, 41, 55);
  doc.text(short(tagline, 65), x + 17, y + 10.7);

  const splitX = x + width - 57;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.line(splitX, y - 0.2, splitX, y + 14.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.6);
  doc.setTextColor(71, 85, 105);
  contacts.slice(0, 4).forEach((line, index) => {
    doc.text(short(line, 50), splitX + 4, y + 2.6 + index * 3.3);
  });
}

function drawLogoFallback(doc: jsPDF, cx: number, cy: number) {
  doc.setDrawColor(0, 128, 61);
  doc.setLineWidth(0.6);
  doc.circle(cx, cy, 5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(0, 128, 61);
  doc.text("V", cx, cy + 2, { align: "center" });
}

function sectionHeader(doc: jsPDF, x: number, y: number, w: number, title: string, subtitle: string, rightText?: string) {
  doc.setFillColor(246, 250, 247);
  doc.setDrawColor(190, 203, 194);
  doc.rect(x, y, w, 8, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5);
  doc.setTextColor(0, 91, 43);
  doc.text(title, x + 2.5, y + 3.1);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(3.5);
  doc.setTextColor(100, 116, 139);
  doc.text(short(subtitle, 100), x + 2.5, y + 5.8);
  if (rightText) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(0, 91, 43);
    doc.text(short(rightText, 24), x + w - 2.5, y + 5, { align: "right" });
  }
}

function drawInfoCell(doc: jsPDF, x: number, y: number, w: number, h: number, label: string, value: string, mono = false) {
  doc.setDrawColor(220, 226, 222);
  doc.setLineWidth(0.18);
  doc.rect(x, y, w, h);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(3.7);
  doc.setTextColor(100, 116, 139);
  doc.text(label, x + 1.7, y + 2.9);
  doc.setFont(mono ? "courier" : "helvetica", "bold");
  doc.setFontSize(mono ? 4.5 : 5);
  doc.setTextColor(31, 41, 55);
  const lines = doc.splitTextToSize(short(String(value || "—"), 62), w - 3.4);
  doc.text(lines.slice(0, 2), x + 1.7, y + 6.1);
}

function drawStateChip(doc: jsPDF, x: number, y: number, w: number, h: number, state: CertificateState) {
  applyTone(doc, state.tone);
  doc.roundedRect(x, y, w, h, 1.2, 1.2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(3.4);
  doc.text("CERTIFICATE STATUS", x + w / 2, y + 3.2, { align: "center" });
  doc.setFontSize(6.2);
  doc.text(short(state.label, 32), x + w / 2, y + 8, { align: "center" });
}

function drawOutcomeBox(doc: jsPDF, x: number, y: number, w: number, h: number, state: CertificateState) {
  applyTone(doc, state.tone);
  doc.roundedRect(x, y, w, h, 1, 1, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(short(state.label, 44), x + w / 2, y + 4.5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(3.8);
  const lines = doc.splitTextToSize(state.description, w - 7);
  doc.text(lines.slice(0, 2), x + w / 2, y + 8, { align: "center" });
}

function applyTone(doc: jsPDF, tone: CertificateState["tone"]) {
  if (tone === "pass") {
    doc.setFillColor(237, 248, 240);
    doc.setDrawColor(0, 128, 61);
    doc.setTextColor(0, 91, 43);
    return;
  }
  if (tone === "fail") {
    doc.setFillColor(255, 241, 241);
    doc.setDrawColor(166, 27, 27);
    doc.setTextColor(166, 27, 27);
    return;
  }
  if (tone === "conditional" || tone === "expired") {
    doc.setFillColor(255, 248, 230);
    doc.setDrawColor(148, 101, 7);
    doc.setTextColor(148, 101, 7);
    return;
  }
  doc.setFillColor(238, 245, 255);
  doc.setDrawColor(23, 78, 166);
  doc.setTextColor(23, 78, 166);
}

function drawMetaBox(doc: jsPDF, x: number, y: number, w: number, h: number, label: string, value: string) {
  doc.setDrawColor(226, 232, 236);
  doc.setFillColor(251, 252, 253);
  doc.rect(x, y, w, h, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(3.1);
  doc.setTextColor(100, 116, 139);
  doc.text(label, x + 1.2, y + 1.8);
  doc.setFontSize(3.8);
  doc.setTextColor(31, 41, 55);
  doc.text(short(value, 42), x + 1.2, y + 4);
}

function drawMeasurement(doc: jsPDF, x: number, y: number, w: number, h: number, label: string, value: string) {
  doc.setDrawColor(220, 226, 222);
  doc.rect(x, y, w, h);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(3.4);
  doc.setTextColor(100, 116, 139);
  doc.text(label, x + 1.6, y + 2.7);
  doc.setFontSize(5.3);
  doc.setTextColor(31, 41, 55);
  doc.text(short(value, 35), x + 1.6, y + 6.2);
}

function drawSummary(doc: jsPDF, x: number, y: number, w: number, h: number, summary: Summary) {
  const failed = summary.fail > 0;
  const neutral = summary.pass === 0 && summary.fail === 0;
  doc.setDrawColor(220, 226, 222);
  doc.rect(x, y, w, h);
  doc.setFillColor(failed ? 166 : neutral ? 122 : 0, failed ? 27 : neutral ? 132 : 128, failed ? 27 : neutral ? 146 : 61);
  doc.circle(x + 2.7, y + h / 2, 1.25, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(3.55);
  doc.setTextColor(31, 41, 55);
  doc.text(short(`${summary.code} · ${summary.title}`, 34), x + 5, y + h / 2 + 0.7, { maxWidth: w - 18 });
  doc.setFont("courier", "normal");
  doc.setFontSize(2.9);
  doc.setTextColor(100, 116, 139);
  doc.text(`P${summary.pass} F${summary.fail} N${summary.na}`, x + w - 1.5, y + h / 2 + 0.7, { align: "right" });
}

function drawAuthField(doc: jsPDF, x: number, y: number, w: number, h: number, label: string, value: string) {
  doc.setDrawColor(220, 226, 230);
  doc.rect(x, y, w, h);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(3.2);
  doc.setTextColor(100, 116, 139);
  doc.text(label, x + 1.7, y + 2.4);
  doc.setFontSize(4.2);
  doc.setTextColor(31, 41, 55);
  doc.text(short(value, 48), x + 1.7, y + 5.3, { maxWidth: w - 3.4 });
}

function drawSignature(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  dataUrl: string | null,
  name: string,
  signedAt: Date | string | null,
) {
  doc.setDrawColor(220, 226, 230);
  doc.rect(x, y, w, h);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(3.1);
  doc.setTextColor(100, 116, 139);
  doc.text(short(title, 38), x + w / 2, y + 2.8, { align: "center" });

  if (dataUrl && /^data:image\/(png|jpe?g);base64,/i.test(dataUrl)) {
    try {
      doc.addImage(dataUrl, /image\/png/i.test(dataUrl) ? "PNG" : "JPEG", x + 5, y + 4.2, w - 10, 9, undefined, "FAST");
    } catch {
      // Old or malformed image data should not prevent certificate generation.
    }
  }

  doc.setDrawColor(100, 116, 139);
  doc.line(x + 5, y + 14.5, x + w - 5, y + 14.5);
  doc.setFontSize(3.6);
  doc.setTextColor(31, 41, 55);
  doc.text(short(name, 30), x + w / 2, y + 17.2, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(2.9);
  doc.setTextColor(100, 116, 139);
  doc.text(signedAt ? `Signed ${formatDate(signedAt)}` : "Signature date not recorded", x + w / 2, y + 20.1, { align: "center" });
}

function heading(doc: jsPDF, text: string, x: number, y: number, align: "left" | "center" | "right" = "left") {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(4.8);
  doc.setTextColor(0, 91, 43);
  doc.text(text, x, y, { align });
}

function certificateValidityText(result: string, issued: boolean, expired: boolean, validUntil: Date): string {
  if (!issued) return "Pending authorization";
  if (["fail", "reinspection_required"].includes(result)) return "No valid certification";
  if (expired) return `Expired ${formatDate(validUntil)}`;
  if (result === "conditional_pass") return `Conditional through ${formatDate(validUntil)}`;
  return `Valid through ${formatDate(validUntil)}`;
}

function certificateState(result: string, issued: boolean, expired: boolean): CertificateState {
  if (!issued) {
    return {
      label: "PENDING AUTHORIZATION",
      tone: "pending",
      description: "Required approval or digital authorization is still outstanding; this document is not yet an issued certificate.",
    };
  }
  if (result === "fail") {
    return {
      label: "FAIL",
      tone: "fail",
      description: "The vehicle did not meet the recorded inspection requirements. Corrective action is required before certification.",
    };
  }
  if (result === "reinspection_required") {
    return {
      label: "RE-INSPECTION REQUIRED",
      tone: "fail",
      description: "Corrective work and a subsequent inspection are required before a valid certification can be issued.",
    };
  }
  if (expired) {
    return {
      label: "EXPIRED",
      tone: "expired",
      description: "The recorded certificate validity period has ended. A current inspection is required to restore certification.",
    };
  }
  if (result === "conditional_pass") {
    return {
      label: "CONDITIONAL PASS",
      tone: "conditional",
      description: "The vehicle passed subject to the recorded remarks or corrective conditions. Review the conditions before continued operation.",
    };
  }
  if (result === "pass") {
    return {
      label: "PASS / CERTIFIED",
      tone: "pass",
      description: "The vehicle met the inspection requirements recorded in VIMS for this inspection.",
    };
  }
  return {
    label: result.replaceAll("_", " ").toUpperCase(),
    tone: "pending",
    description: "Recorded VIMS inspection outcome.",
  };
}

function plainReading(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not recorded";
  return String(value);
}

function percentReading(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not recorded";
  return `${value}%`;
}

function resultReading(value: string | null): string {
  if (!value) return "Not recorded";
  return value.replaceAll("_", " ").toUpperCase();
}

function short(value: string, max: number) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}
