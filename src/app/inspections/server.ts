"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { inspections, vehicles, signatures } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { newId } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, canManageInspections, canAccessTransporterScope, canApprove } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import {
  validateInspectionDocuments,
  validateInspectionEvidence,
  validateSignatureDataUrl,
} from "@/lib/inspection-evidence";
import type { InspectionDocument, InspectionSectionData } from "@/db/schema";
import { emitWebhookEvent } from "@/lib/webhook-delivery";

async function requireEditor() {
  const user = await getCurrentUser();
  if (!canManageInspections(user)) throw new Error("Not authorised to manage inspections");
  return user;
}

export type InspectionFormData = {
  vehicleId: string;
  inspectionDate: string;
  inspectorName: string;
  station: string;
  odometerReading?: string;
  sectionData: InspectionSectionData[];
  serviceBrakeEfficiency?: string;
  parkingBrakeEfficiency?: string;
  smokeTest?: "pass" | "fail" | "na";
  noiseLevel?: string;
  opacityTest?: string;
  overallResult: "pass" | "conditional_pass" | "reinspection_required" | "fail";
  inspectorRemarks?: string;
  nextInspectionDate?: string;
  reinspectionDate?: string;
  templateType?: string;
  inspectorSignature?: string;
  attachedDocuments?: InspectionDocument[];
};

const TEMPLATE_TYPES = new Set(["bus", "truck", "tanker", "trailer", "taxi", "private"]);

function inspectionNumber(id: string, at: Date): string {
  const stamp = at.toISOString().slice(0, 10).replaceAll("-", "");
  return `RSL-INS-${stamp}-${id.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

function boundedNumber(value: string | undefined, label: string, min: number, max: number): string | null {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${label} must be between ${min} and ${max}`);
  return String(n);
}

function boundedInteger(value: string | undefined, label: string, min: number, max: number): number | null {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < min || n > max) throw new Error(`${label} must be a whole number between ${min} and ${max}`);
  return n;
}

function validateOptionalDate(value: string | undefined, label: string) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(`${value}T12:00:00Z`).getTime())) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

function validateSections(sectionData: InspectionSectionData[]) {
  if (!Array.isArray(sectionData) || sectionData.length === 0 || sectionData.length > 24) {
    throw new Error("A valid inspection checklist is required");
  }

  let pass = 0;
  let fail = 0;
  let na = 0;
  let critical = 0;

  for (const section of sectionData) {
    if (!section || typeof section.section !== "string" || typeof section.title !== "string" || !Array.isArray(section.items)) {
      throw new Error("Inspection checklist contains an invalid section");
    }
    if (!section.section.trim() || section.section.length > 100 || !section.title.trim() || section.title.length > 200) {
      throw new Error("Inspection checklist contains an invalid section label");
    }
    if (section.items.length > 100) throw new Error("Inspection section contains too many checklist items");
    for (const item of section.items) {
      if (!item || typeof item.name !== "string" || item.name.trim().length === 0 || item.name.length > 200) {
        throw new Error("Checklist item name is invalid");
      }
      if (!(["pass", "fail", "na"] as const).includes(item.result)) throw new Error("Checklist item contains an invalid result");
      if (item.severity && !(["minor", "major", "critical"] as const).includes(item.severity)) {
        throw new Error("Checklist item contains an invalid severity");
      }
      if (item.result === "pass") pass += 1;
      if (item.result === "na") na += 1;
      if (item.result === "fail") {
        fail += 1;
        if (item.severity === "critical") critical += 1;
      }
      if (item.remarks && item.remarks.length > 2000) throw new Error("Checklist remarks must not exceed 2000 characters");
    }
  }

  const evidence = validateInspectionEvidence(sectionData);
  return { pass, fail, na, critical, photos: evidence.totalPhotos };
}

export async function createInspection(data: InspectionFormData) {
  const user = await requireEditor();
  const settings = await getSettings();

  if (!data.vehicleId) throw new Error("Vehicle is required");
  if (!data.station?.trim()) throw new Error("Inspection station is required");
  if (!data.inspectorName?.trim()) throw new Error("Inspector name is required");
  if (data.inspectorName.length > 200 || data.station.length > 200) throw new Error("Inspector or station value is too long");
  if (data.inspectorRemarks && data.inspectorRemarks.length > 4000) throw new Error("Inspector remarks must not exceed 4000 characters");
  if (data.templateType && !TEMPLATE_TYPES.has(data.templateType)) throw new Error("Inspection template is invalid");

  const inspectedAt = new Date(data.inspectionDate);
  if (Number.isNaN(inspectedAt.getTime())) throw new Error("Inspection date is invalid");
  if (inspectedAt.getTime() > Date.now() + 5 * 60_000) throw new Error("Inspection date cannot be in the future");

  const nextInspectionDate = validateOptionalDate(data.nextInspectionDate, "Next inspection date");
  const reinspectionDate = validateOptionalDate(data.reinspectionDate, "Re-inspection date");
  const odometerReading = boundedInteger(data.odometerReading, "Odometer reading", 0, 20_000_000);

  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, data.vehicleId));
  if (!vehicle) throw new Error("Vehicle not found");
  if (vehicle.status === "decommissioned") throw new Error("A decommissioned vehicle cannot be inspected");

  const totals = validateSections(data.sectionData);
  validateInspectionDocuments(data.attachedDocuments || []);
  if (data.inspectorSignature) validateSignatureDataUrl(data.inspectorSignature, "Inspector signature");

  if (data.overallResult === "pass" && (totals.fail > 0 || data.smokeTest === "fail")) {
    throw new Error("Overall result cannot be PASS while failed checklist or emissions items remain");
  }
  if (data.overallResult === "conditional_pass" && totals.critical > 0) {
    throw new Error("A conditional pass cannot be issued while critical defects remain");
  }
  if (settings.requireDigitalSignature && !data.inspectorSignature) {
    throw new Error("Inspector digital signature is required before submission");
  }

  const id = newId();
  const number = inspectionNumber(id, inspectedAt);
  const workflowStatus = "completed" as const;
  const payload = {
    id,
    inspectionNumber: number,
    vehicleId: data.vehicleId,
    inspectionDate: inspectedAt,
    inspectorId: user.id,
    inspectorName: data.inspectorName.trim() || user.name,
    supervisorId: null,
    supervisorName: null,
    station: data.station.trim(),
    odometerReading,
    workflowStatus,
    sectionData: data.sectionData,
    serviceBrakeEfficiency: boundedNumber(data.serviceBrakeEfficiency, "Service brake efficiency", 0, 100),
    parkingBrakeEfficiency: boundedNumber(data.parkingBrakeEfficiency, "Parking brake efficiency", 0, 100),
    smokeTest: data.smokeTest ?? null,
    noiseLevel: boundedNumber(data.noiseLevel, "Noise level", 0, 250),
    opacityTest: boundedNumber(data.opacityTest, "Opacity", 0, 100),
    overallResult: data.overallResult,
    inspectorRemarks: data.inspectorRemarks?.trim() || null,
    supervisorRemarks: null,
    nextInspectionDate,
    reinspectionDate,
    templateType: data.templateType || null,
    inspectorSignature: data.inspectorSignature || null,
    supervisorSignature: null,
    attachedDocuments: data.attachedDocuments || [],
    totalPhotos: totals.photos,
    status: "completed",
  } as const;

  await db.transaction(async (tx) => {
    await tx.insert(inspections).values(payload as any);
    if (data.inspectorSignature) {
      await tx.insert(signatures).values({
        id: newId(),
        inspectionId: id,
        type: "inspector",
        signerName: data.inspectorName.trim() || user.name,
        signerId: user.id,
        dataUrl: data.inspectorSignature,
      });
    }

    const awaitingApproval = settings.requireSupervisorApproval && data.overallResult !== "fail";
    const newStatus = data.overallResult === "fail"
      ? "failed"
      : awaitingApproval
        ? "under_inspection"
        : data.overallResult === "pass"
          ? "passed"
          : "under_inspection";
    await tx.update(vehicles).set({ status: newStatus as any, updatedAt: new Date() }).where(eq(vehicles.id, data.vehicleId));
  });

  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "inspect",
    entityType: "inspection",
    entityId: id,
    entityLabel: number,
    summary: `Completed inspection ${number} for ${vehicle.registrationNumber} — ${data.overallResult.toUpperCase()}`,
    after: { result: data.overallResult, workflowStatus, vehicle: vehicle.registrationNumber, failedItems: totals.fail },
  });

  const event = data.overallResult === "fail" ? "inspection.failed" : "inspection.completed";
  await emitWebhookEvent(event, {
    id,
    inspectionNumber: number,
    vehicleId: data.vehicleId,
    vehicleRegistration: vehicle.registrationNumber,
    overallResult: data.overallResult,
    workflowStatus,
    failedItemCount: totals.fail,
    criticalFailedItemCount: totals.critical,
  });

  revalidatePath("/inspections");
  revalidatePath(`/vehicles/${data.vehicleId}`);
  revalidatePath("/vehicles");
  revalidatePath("/");
  return { id, inspectionNumber: number };
}

export async function approveInspection(id: string, input: { remarks?: string; signature?: string }) {
  const user = await getCurrentUser();
  if (!canApprove(user)) throw new Error("You do not have permission to approve inspections");
  if (!id || id.length > 64) throw new Error("Inspection reference is invalid");
  if (input.signature) validateSignatureDataUrl(input.signature, "Supervisor signature");

  const [row] = await db
    .select({ inspection: inspections, vehicle: vehicles })
    .from(inspections)
    .innerJoin(vehicles, eq(vehicles.id, inspections.vehicleId))
    .where(eq(inspections.id, id));
  if (!row) throw new Error("Inspection not found");
  if (row.inspection.workflowStatus === "approved") return { approved: true };
  if (row.inspection.workflowStatus !== "completed") throw new Error("Only completed inspections can be approved");

  const settings = await getSettings();
  if (settings.requireDigitalSignature && !input.signature) {
    throw new Error("Supervisor digital signature is required for approval");
  }
  if (input.remarks && input.remarks.length > 4000) throw new Error("Supervisor remarks must not exceed 4000 characters");

  await db.transaction(async (tx) => {
    await tx.update(inspections).set({
      workflowStatus: "approved",
      supervisorId: user.id,
      supervisorName: user.name,
      supervisorRemarks: input.remarks?.trim() || null,
      supervisorSignature: input.signature || null,
      updatedAt: new Date(),
    }).where(eq(inspections.id, id));

    if (input.signature) {
      await tx.delete(signatures).where(and(eq(signatures.inspectionId, id), eq(signatures.type, "supervisor")));
      await tx.insert(signatures).values({
        id: newId(),
        inspectionId: id,
        type: "supervisor",
        signerName: user.name,
        signerId: user.id,
        dataUrl: input.signature,
      });
    }

    const status = row.inspection.overallResult === "pass"
      ? "passed"
      : row.inspection.overallResult === "fail"
        ? "failed"
        : "under_inspection";
    await tx.update(vehicles).set({ status: status as any, updatedAt: new Date() }).where(eq(vehicles.id, row.vehicle.id));
  });

  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "approve",
    entityType: "inspection",
    entityId: id,
    entityLabel: row.inspection.inspectionNumber,
    summary: `Approved inspection ${row.inspection.inspectionNumber} for ${row.vehicle.registrationNumber}`,
    before: { workflowStatus: row.inspection.workflowStatus },
    after: { workflowStatus: "approved", supervisor: user.name },
  });

  revalidatePath(`/inspections/${id}`);
  revalidatePath(`/certificate/${id}`);
  revalidatePath("/inspections");
  revalidatePath("/vehicles");
  revalidatePath("/");
  return { approved: true };
}

export async function getInspectionDetail(id: string) {
  const user = await getCurrentUser();
  if (user.role !== "transporter_user" && !canManageInspections(user)) return null;
  const [row] = await db
    .select({ inspection: inspections, vehicle: vehicles })
    .from(inspections)
    .innerJoin(vehicles, eq(inspections.vehicleId, vehicles.id))
    .where(eq(inspections.id, id));
  if (!row || !canAccessTransporterScope(user, row.vehicle.transporterId)) return null;
  return row;
}