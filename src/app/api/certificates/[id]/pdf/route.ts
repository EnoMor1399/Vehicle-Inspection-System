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
      .map((item) => ({ section: section.section, name: item.name, severity: item.severity, remarks: item.remarks })),
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
  const signedToken = createCertificateSignature(fingerprint);
  const verificationCode = certificateVerificationCode(fingerprint);
  const verifyUrl = `${request.nextUrl.origin}/verify/${inspection.id}?sig=${encodeURIComponent(signedToken)}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 256, margin: 1, errorCorrectionLevel: "M" });

  const state = getState(inspection.overallResult, issuanceRequirementsMet, expired);
  const passSelected = inspection.overallResult === "pass" && issuanceRequirementsMet && !expired;
  const failSelected = ["fail", "reinspection_required"].includes(inspection.overallResult);
  const operatorName = transporter?.contactPerson || vehicle.ownerName || transporter?.companyName || "Not recorded";
  const operatorPhone = transporter?.mobile || vehicle.ownerContact || "Not recorded";
  const operatorEmail = transporter?.email || "Not recorded";
  const inspectorName = inspection.inspectorName || inspectorSig?.signerName || inspectorUser?.name || "Not recorded";
  const supervisorName = inspection.supervisorName || supervisorSig?.signerName || (settings.requireSupervisorApproval ? "Pending" : "Not required");
  const stationName = location?.name || inspection.station || "Not recorded";
  const stationAddress = location?.address || inspection.station || "Not recorded";

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  doc.setProperties({
    title: `Vehicle Inspection Certificate - ${vehicle.registrationNumber}`,
    subject: `VIMS certificate ${inspection.inspectionNumber}`,
    author: settings.companyName,
    creator: "Vehicle Inspection Management System (VIMS)",
  });

  const left = 8;
  const right = 202;
  const pageW = right - left;
  let y = 8;

  doc.setDrawColor(0, 128, 61);
  doc.setLineWidth(0.45);
  doc.line(left, 3.8, right, 3.8);

  if (settings.logoDataUrl && /^data:image\/(png|jpe?g);base64,/i.test(settings.logoDataUrl)) {
    try {
      doc.addImage(settings.logoDataUrl, /image\/png/i.test(settings.logoDataUrl) ? "PNG" : "JPEG", left, y, 12, 12, undefined, "FAST");
    } catch {
      drawLogoFallback(doc, left + 6, y + 6);
    }
  } else {
    drawLogoFallback(doc, left + 6, y + 6);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(0, 91, 43);
  doc.text(short(settings.companyName || "Road Safety Limited", 40).toUpperCase(), left + 15, y + 5.4);
  doc.setFontSize(5.6);
  doc.setTextColor(17, 24, 39);
  doc.text(settings.tagline || "Vehicle Inspection Management System", left + 15, y + 9.2);

  doc.setDrawColor(203, 213, 225);
  doc.line(143, y - 0.5, 143, y + 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.3);
  const contacts = [
    [settings.address, settings.city, settings.region].filter(Boolean).join(", "),
    settings.phone,
    settings.email,
    settings.website,
  ].filter(Boolean).slice(0, 4) as string[];
  contacts.forEach((line, index) => doc.text(short(line, 52), 146, y + 2 + index * 3.1));

  y += 16;
  doc.setDrawColor(0, 128, 61);
  doc.setLineWidth(0.7);
  doc.line(left, y, 159, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(4.8);
  doc.setTextColor(0, 91, 43);
  doc.text(`CERTIFICATE NO. ${inspection.inspectionNumber}`, right, y + 1.2, { align: "right" });

  y += 6;
  doc.setFontSize(13.8);
  doc.setTextColor(17, 24, 39);
  doc.text("VEHICLE INSPECTION CERTIFICATE", 105, y, { align: "center" });
  y += 3.2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.2);
  doc.setTextColor(100, 116, 139);
  doc.text("Official single-page digital certificate generated from the VIMS inspection record.", 105, y, { align: "center" });

  y += 4;
  const fields = [
    ["REGISTRATION", vehicle.registrationNumber],
    ["MAKE / MODEL", `${vehicle.make} ${vehicle.model || ""}`.trim()],
    ["VIN / CHASSIS", vehicle.vin || vehicle.chassisNumber || "Not recorded"],
    ["YEAR / CLASS", `${vehicle.manufacturingYear || "—"} · ${vehicle.vehicleClass || vehicle.category || "Not recorded"}`],
    ["TRANSPORTER / OWNER", transporter?.companyName || vehicle.ownerName || "Not recorded"],
    ["OPERATOR / CONTACT", operatorName],
    ["PHONE / EMAIL", `${operatorPhone}${operatorEmail !== "Not recorded" ? ` · ${operatorEmail}` : ""}`],
    ["MILEAGE", inspection.odometerReading ? `${Number(inspection.odometerReading).toLocaleString()} km` : "Not recorded"],
  ];
  const fw = pageW / 4;
  const fh = 11.5;
  fields.forEach((field, index) => {
    drawField(doc, left + (index % 4) * fw, y + Math.floor(index / 4) * fh, fw, fh, field[0], field[1], index === 0);
  });

  y += 25.5;
  const qrW = 42;
  const resultW = pageW - qrW;
  const mainH = 39;
  doc.setDrawColor(0, 91, 43);
  doc.roundedRect(left, y, pageW, mainH, 1.5, 1.5);
  doc.line(left + resultW, y, left + resultW, y + mainH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(4.8);
  doc.setTextColor(0, 91, 43);
  doc.text("VEHICLE INSPECTION RESULT", left + 2.5, y + 4);

  drawResult(doc, left + 2.5, y + 6.2, 62, 12.5, "PASS", passSelected, true);
  drawResult(doc, left + 66.5, y + 6.2, 62, 12.5, "FAIL", failSelected, false);

  const stateY = y + 21;
  if (state.tone === "pass") {
    doc.setFillColor(240, 253, 244); doc.setDrawColor(0, 128, 61); doc.setTextColor(0, 91, 43);
  } else if (state.tone === "fail") {
    doc.setFillColor(254, 242, 242); doc.setDrawColor(185, 28, 28); doc.setTextColor(185, 28, 28);
  } else {
    doc.setFillColor(255, 251, 235); doc.setDrawColor(180, 83, 9); doc.setTextColor(180, 83, 9);
  }
  doc.roundedRect(left + 2.5, stateY, resultW - 5, 9.5, 1, 1, "FD");
  doc.setFontSize(4);
  doc.text("RECORDED VIMS OUTCOME", left + resultW / 2, stateY + 2.6, { align: "center" });
  doc.setFontSize(7.2);
  doc.text(state.label, left + resultW / 2, stateY + 5.8, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(3.5);
  doc.text(state.description, left + resultW / 2, stateY + 8, { align: "center", maxWidth: resultW - 10 });

  const metaY = y + 34.2;
  drawMeta(doc, left + 2.5, metaY, "INSPECTION", formatDate(inspection.inspectionDate));
  drawMeta(doc, left + 48, metaY, "VALID UNTIL", issuanceRequirementsMet && inspection.overallResult === "pass" ? formatDate(validUntil) : "Not roadworthy-valid");
  drawMeta(doc, left + 94, metaY, "STATION", stationName);

  const qrX = left + resultW + 4.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(4.8);
  doc.setTextColor(0, 91, 43);
  doc.text("SCAN TO VERIFY", qrX + 16.5, y + 4, { align: "center" });
  doc.rect(qrX + 3, y + 6, 27, 27);
  doc.addImage(qrDataUrl, "PNG", qrX + 4, y + 7, 25, 25, undefined, "FAST");
  doc.setFontSize(3.8);
  doc.text(verificationCode, qrX + 16.5, y + 35, { align: "center" });

  y += mainH + 3;
  const rows = Math.max(1, Math.ceil(summaries.length / 2));
  const matrixH = Math.min(58, 11 + rows * 6.4);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(left, y, pageW, matrixH, 1.3, 1.3);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(4.5);
  doc.setTextColor(0, 91, 43);
  doc.text("DIGITAL CHECKLIST COMPLIANCE MATRIX", left + 2.5, y + 4);
  doc.setFontSize(3.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`PASS ${totalPass}   FAIL ${totalFail}   N/A ${totalNa}   TOTAL ${items.length}`, right - 2.5, y + 4, { align: "right" });

  if (!summaries.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(4);
    doc.setTextColor(180, 83, 9);
    doc.text("Historical record: item-level checklist responses were not available in the source register.", left + 3, y + 11);
  } else {
    const colW = (pageW - 7.5) / 2;
    summaries.forEach((summary, index) => {
      const sx = left + 2.5 + (index % 2) * (colW + 2.5);
      const sy = y + 8 + Math.floor(index / 2) * 6.4;
      drawSummary(doc, sx, sy, colW, 5.7, summary);
    });
  }

  y += matrixH + 2.5;
  const lowerH = 25;
  const defectsW = 128;
  doc.setDrawColor(203, 213, 225);
  doc.rect(left, y, defectsW, lowerH);
  doc.rect(left + defectsW + 2, y, pageW - defectsW - 2, lowerH);
  heading(doc, "FAILED / ATTENTION ITEMS", left + 2, y + 3.7);
  if (!failedItems.length) {
    body(doc, "No failed checklist items recorded.", left + 2, y + 8, defectsW - 4);
  } else {
    failedItems.slice(0, 4).forEach((item, index) => {
      const lineY = y + 7 + index * 4.2;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(3.4);
      doc.setTextColor(185, 28, 28);
      doc.text(short(`${item.section} · ${item.name}`, 55), left + 2, lineY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(3);
      doc.setTextColor(100, 116, 139);
      doc.text(short([item.severity, item.remarks].filter(Boolean).join(" — ") || "Recorded checklist defect", 75), left + 2, lineY + 2);
    });
  }

  const remarks = short(inspection.inspectorRemarks || inspection.supervisorRemarks || "No additional remarks recorded.", 180);
  heading(doc, "OFFICIAL REMARKS", left + defectsW + 4, y + 3.7);
  body(doc, remarks, left + defectsW + 4, y + 8, pageW - defectsW - 6);

  y += lowerH + 2.5;
  const authH = 19.5;
  const authW = 94;
  const sigW = (pageW - authW) / 2;
  doc.rect(left, y, pageW, authH);
  drawField(doc, left, y, authW / 2, authH / 2, "INSPECTOR", inspectorName);
  drawField(doc, left + authW / 2, y, authW / 2, authH / 2, "INSPECTION ADDRESS / STATION", stationAddress);
  drawField(doc, left, y + authH / 2, authW / 2, authH / 2, "WORKFLOW", inspection.workflowStatus.replaceAll("_", " ").toUpperCase());
  drawField(doc, left + authW / 2, y + authH / 2, authW / 2, authH / 2, "SUPERVISOR", supervisorName);
  drawSignature(doc, left + authW, y, sigW, authH, "INSPECTOR SIGNATURE", inspectorSig?.dataUrl || inspection.inspectorSignature || null, inspectorName);
  drawSignature(doc, left + authW + sigW, y, sigW, authH, "SUPERVISOR SIGNATURE", supervisorSig?.dataUrl || inspection.supervisorSignature || null, supervisorName);

  y += authH + 2.5;
  doc.setDrawColor(0, 91, 43);
  doc.setLineWidth(0.5);
  doc.line(left, y, right, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(4);
  doc.setTextColor(0, 91, 43);
  doc.text(settings.companyName, left, y + 3.2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(3.1);
  doc.setTextColor(100, 116, 139);
  doc.text(short(settings.certificateFooter || "Electronically generated controlled certificate. Scan the QR code to verify authenticity.", 150), left, y + 5.8, { maxWidth: 145 });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(3.5);
  doc.setTextColor(0, 91, 43);
  doc.text("ONE-PAGE A4 CONTROLLED DOCUMENT", right, y + 3.2, { align: "right" });

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

function drawLogoFallback(doc: jsPDF, cx: number, cy: number) {
  doc.setDrawColor(0, 128, 61);
  doc.circle(cx, cy, 4.2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(0, 128, 61);
  doc.text("V", cx, cy + 1.7, { align: "center" });
}

function drawField(doc: jsPDF, x: number, y: number, w: number, h: number, label: string, value: string, strong = false) {
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, h);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(3.3);
  doc.setTextColor(100, 116, 139);
  doc.text(label, x + 1.4, y + 2.7);
  doc.setTextColor(strong ? 0 : 17, strong ? 91 : 24, strong ? 43 : 39);
  doc.setFontSize(strong ? 5.8 : 4.4);
  const lines = doc.splitTextToSize(short(String(value || "—"), 60), w - 2.8);
  doc.text(lines.slice(0, 2), x + 1.4, y + 6.1);
}

function drawResult(doc: jsPDF, x: number, y: number, w: number, h: number, label: string, active: boolean, pass: boolean) {
  const r = pass ? 0 : 185;
  const g = pass ? 128 : 28;
  const b = pass ? 61 : 28;
  if (active) doc.setFillColor(pass ? 240 : 254, pass ? 253 : 242, pass ? 244 : 242);
  else doc.setFillColor(250, 250, 250);
  doc.setDrawColor(active ? r : 203, active ? g : 213, active ? b : 225);
  doc.rect(x, y, w, h, "FD");
  doc.rect(x + w / 2 - 12, y + 4.1, 4.2, 4.2);
  if (active) {
    doc.setFillColor(r, g, b);
    doc.rect(x + w / 2 - 12, y + 4.1, 4.2, 4.2, "F");
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(r, g, b);
  doc.text(label, x + w / 2 + 2, y + 8.3, { align: "center" });
}

function drawMeta(doc: jsPDF, x: number, y: number, label: string, value: string) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(3.1);
  doc.setTextColor(100, 116, 139);
  doc.text(label, x, y);
  doc.setFontSize(3.7);
  doc.setTextColor(17, 24, 39);
  doc.text(short(value, 30), x, y + 2.3);
}

function drawSummary(doc: jsPDF, x: number, y: number, w: number, h: number, summary: Summary) {
  const failed = summary.fail > 0;
  doc.setDrawColor(203, 213, 225);
  doc.rect(x, y, w, h);
  doc.setFillColor(failed ? 185 : 0, failed ? 28 : 128, failed ? 28 : 61);
  doc.circle(x + 3, y + h / 2, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(3.6);
  doc.setTextColor(17, 24, 39);
  doc.text(short(`${summary.code} · ${summary.title}`, 42), x + 6, y + h / 2 + 0.8, { maxWidth: w - 26 });
  doc.setFont("courier", "normal");
  doc.setFontSize(3.1);
  doc.setTextColor(100, 116, 139);
  doc.text(`P${summary.pass} F${summary.fail} N${summary.na}`, x + w - 2, y + h / 2 + 0.8, { align: "right" });
}

function drawSignature(doc: jsPDF, x: number, y: number, w: number, h: number, title: string, dataUrl: string | null, name: string) {
  doc.setDrawColor(203, 213, 225);
  doc.rect(x, y, w, h);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(3.3);
  doc.setTextColor(100, 116, 139);
  doc.text(title, x + w / 2, y + 3, { align: "center" });
  if (dataUrl && /^data:image\/(png|jpe?g);base64,/i.test(dataUrl)) {
    try {
      doc.addImage(dataUrl, /image\/png/i.test(dataUrl) ? "PNG" : "JPEG", x + 5, y + 4.2, w - 10, 8, undefined, "FAST");
    } catch {
      // Keep the signature line if an old image cannot be decoded.
    }
  }
  doc.setDrawColor(100, 116, 139);
  doc.line(x + 5, y + 13.4, x + w - 5, y + 13.4);
  doc.setTextColor(17, 24, 39);
  doc.setFontSize(3.3);
  doc.text(short(name, 28), x + w / 2, y + 16.2, { align: "center" });
}

function heading(doc: jsPDF, text: string, x: number, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(4.2);
  doc.setTextColor(0, 91, 43);
  doc.text(text, x, y);
}

function body(doc: jsPDF, text: string, x: number, y: number, width: number) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(3.5);
  doc.setTextColor(17, 24, 39);
  doc.text(doc.splitTextToSize(text, width).slice(0, 7), x, y);
}

function getState(result: string, authorized: boolean, expired: boolean) {
  if (expired && authorized) return { tone: "pending", label: "EXPIRED", description: "The recorded certificate validity period has ended." };
  if (!authorized) return { tone: "pending", label: "PENDING AUTHORIZATION", description: "Approval or required digital signature is still outstanding." };
  if (result === "pass") return { tone: "pass", label: "PASS / CERTIFIED", description: "Vehicle met the recorded inspection requirements." };
  if (result === "fail") return { tone: "fail", label: "FAIL", description: "Vehicle did not meet the recorded inspection requirements." };
  if (result === "conditional_pass") return { tone: "pending", label: "CONDITIONAL PASS", description: "Vehicle passed subject to the recorded conditions." };
  if (result === "reinspection_required") return { tone: "fail", label: "RE-INSPECTION REQUIRED", description: "Vehicle requires re-inspection before certification." };
  return { tone: "pending", label: result.replaceAll("_", " ").toUpperCase(), description: "Recorded VIMS inspection outcome." };
}

function short(value: string, max: number) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}
