import { NextRequest } from "next/server";
import { addMonths } from "date-fns";
import { jsPDF } from "jspdf";
import { drawCertificatePdf } from "@/lib/certificate-pdf-layout";
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
import { and, eq } from "drizzle-orm";
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

  const [inspection] = await db
    .select()
    .from(inspections)
    .where(and(
      eq(inspections.organizationId, currentUser.organizationId),
      eq(inspections.id, id),
    ));
  if (!inspection) return new Response("Certificate not found", { status: 404 });

  const [vehicle] = await db
    .select()
    .from(vehicles)
    .where(and(
      eq(vehicles.organizationId, currentUser.organizationId),
      eq(vehicles.id, inspection.vehicleId),
    ));
  if (!vehicle || !canAccessTransporterScope(currentUser, vehicle.transporterId)) {
    return new Response("Certificate not found", { status: 404 });
  }
  if (currentUser.role !== "transporter_user" && !hasPermission(currentUser, "inspections")) {
    return new Response("Forbidden", { status: 403 });
  }

  const [transporter] = vehicle.transporterId
    ? await db.select().from(transporters).where(and(
        eq(transporters.organizationId, currentUser.organizationId),
        eq(transporters.id, vehicle.transporterId),
      ))
    : [];
  const [location] = inspection.locationId
    ? await db.select().from(locations).where(and(
        eq(locations.organizationId, currentUser.organizationId),
        eq(locations.id, inspection.locationId),
      ))
    : [];
  const [inspectorUser] = inspection.inspectorId
    ? await db.select().from(users).where(and(
        eq(users.organizationId, currentUser.organizationId),
        eq(users.id, inspection.inspectorId),
      ))
    : [];

  const sigs = await db
    .select()
    .from(signatures)
    .where(and(
      eq(signatures.organizationId, currentUser.organizationId),
      eq(signatures.inspectionId, id),
    ));
  const inspectorSig = sigs.find((sig) => sig.type === "inspector");
  const supervisorSig = sigs.find((sig) => sig.type === "supervisor");
  const settings = await getSettings(currentUser.organizationId);

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
  const remarks = inspection.supervisorRemarks || inspection.inspectorRemarks || "No additional remarks recorded.";

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  doc.setProperties({
    title: `Vehicle Inspection Certificate - ${vehicle.registrationNumber}`,
    subject: `VIMS certificate ${inspection.inspectionNumber}`,
    author: settings.companyName,
    creator: "Vehicle Inspection Management System (VIMS)",
  });

  const identity: [string, string][] = [
    ["MAKE / MODEL", [vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Not recorded"],
    ["VIN / CHASSIS", vehicle.vin || vehicle.chassisNumber || "Not recorded"],
    ["ENGINE NUMBER", vehicle.engineNumber || "Not recorded"],
    ["YEAR / BODY TYPE", String(vehicle.manufacturingYear || "Not recorded") + " / " + (vehicle.bodyType || "Not recorded")],
    ["CLASS / CATEGORY", vehicle.vehicleClass || vehicle.category || "Not recorded"],
    ["FUEL / AXLES", (vehicle.fuelType || "Not recorded") + " / " + (vehicle.numberOfAxles ?? "Not recorded") + " axle(s)"],
    ["TRANSPORTER / OWNER", operatorName],
    ["ODOMETER", inspection.odometerReading != null ? Number(inspection.odometerReading).toLocaleString() + " km" : "Not recorded"],
    ["INSPECTION TYPE", inspection.templateType ? inspection.templateType.replaceAll("_", " ") : "Comprehensive vehicle inspection"],
  ];

  drawCertificatePdf(doc, {
    companyName: settings.companyName,
    tagline: settings.tagline || "Vehicle Inspection Management System",
    contacts: [
      [settings.address, settings.city, settings.region].filter(Boolean).join(", "),
      settings.phone,
      settings.email,
      settings.website,
    ].filter(Boolean) as string[],
    logoDataUrl: settings.logoDataUrl,
    certificateNumber: inspection.inspectionNumber,
    registration: vehicle.registrationNumber,
    state,
    identity,
    inspectionDate: formatDate(inspection.inspectionDate),
    validity: validityText,
    station: stationName,
    workflow: inspection.workflowStatus.replaceAll("_", " ").toUpperCase(),
    qrDataUrl,
    verificationCode,
    measurements: [
      ["SERVICE BRAKE EFFICIENCY", percentReading(inspection.serviceBrakeEfficiency)],
      ["PARKING BRAKE EFFICIENCY", percentReading(inspection.parkingBrakeEfficiency)],
      ["SMOKE TEST", resultReading(inspection.smokeTest)],
      ["NOISE READING", plainReading(inspection.noiseLevel)],
      ["EXHAUST EMISSION", plainReading(inspection.exhaustEmission)],
      ["OPACITY READING", plainReading(inspection.opacityTest)],
    ],
    summaries,
    totals: { pass: totalPass, fail: totalFail, na: totalNa, total: items.length },
    defects: failedItems,
    remarks,
    inspector: inspectorName,
    stationAddress,
    supervisor: supervisorName,
    inspectorSignature: {
      dataUrl: inspectorSig?.dataUrl || inspection.inspectorSignature || null,
      name: inspectorName,
      signedAt: inspectorSig?.signedAt ? formatDate(inspectorSig.signedAt) : null,
    },
    supervisorSignature: {
      dataUrl: supervisorSig?.dataUrl || inspection.supervisorSignature || null,
      name: supervisorName,
      signedAt: supervisorSig?.signedAt ? formatDate(supervisorSig.signedAt) : null,
    },
    supervisorRequired: settings.requireSupervisorApproval,
    footer: settings.certificateFooter || "Electronically generated from the controlled VIMS record. Scan the QR code to verify authenticity and the current certificate status.",
  });

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
