"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { dailyInspections, vehicles } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { newId } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { tenantLocalActorUserId } from "@/lib/tenant-local-actor";
import { getCurrentUser, canApprove, canManageInspections, canAccessTransporterScope } from "@/lib/auth";
import type { DailyChecklistCategory, DailyPreloadingDetails, DailyInspectionVehicleType } from "@/db/schema";
import { summarizeDailyChecklist, validateCompletedDailyChecklist } from "@/lib/daily-checklist";
import { validateDailyInspectionEvidence, validateSignatureDataUrl } from "@/lib/inspection-evidence";

export type DailyInspectionInput = {
  vehicleId: string;
  driverName?: string;
  inspectionDate: string; // YYYY-MM-DD
  odometer?: string;
  tripPurpose?: string;
  routeDescription?: string;
  checklist: DailyChecklistCategory[];
  driverSignature?: string;
  notes?: string;
  preloadingDetails?: DailyPreloadingDetails;
};

const VALID_VEHICLE_TYPES = ["general", "bulk_tanker", "tractor_trailer", "container_flatbed"] as const;

function validatePreloadingDetails(details?: DailyPreloadingDetails): DailyPreloadingDetails {
  const record = details || {};
  const vehicleType = record.vehicleType || "general";
  if (!VALID_VEHICLE_TYPES.includes(vehicleType)) {
    throw new Error("Select a supported pre-trip inspection type.");
  }
  const textFields: (keyof DailyPreloadingDetails)[] = [
    "transporterName", "chassisNumber", "vehicleMake", "bulkIdentificationNumber",
    "bulkCapacity", "bulkCalibrationCertificateNumber", "driverLicenceClass",
    "inspectionPremises", "inspectorName",
  ];
  for (const key of textFields) {
    const value = record[key];
    if (value !== undefined && (typeof value !== "string" || value.length > 200)) {
      throw new Error("Inspection details contain an invalid field.");
    }
  }
  if (record.bulkCalibrationExpiryDate &&
    (!/^\\d{4}-\\d{2}-\\d{2}$/.test(record.bulkCalibrationExpiryDate) ||
    Number.isNaN(Date.parse(record.bulkCalibrationExpiryDate + "T00:00:00Z")))) {
    throw new Error("Bulk calibration certificate expiry date is invalid.");
  }
  if (vehicleType !== "general") {
    if (!record.inspectionPremises?.trim() || !record.inspectorName?.trim()) {
      throw new Error("Inspection premises and inspector name are required for pre-loading checks.");
    }
    if (!record.inspectorSignature) {
      throw new Error("Inspector signature is required for pre-loading validation.");
    }
    validateSignatureDataUrl(record.inspectorSignature, "Inspector signature");
    if (vehicleType === "bulk_tanker" && (
      !record.bulkIdentificationNumber?.trim() ||
      !record.bulkCapacity?.trim() ||
      !record.bulkCalibrationCertificateNumber?.trim() ||
      !record.bulkCalibrationExpiryDate
    )) {
      throw new Error("Bulk ID, capacity and calibration certificate/expiry details are required for tankers.");
    }
    if (vehicleType === "bulk_tanker" &&
      record.bulkCalibrationExpiryDate! < new Date().toISOString().slice(0, 10)) {
      throw new Error("An expired bulk calibration certificate cannot clear a pre-loading inspection.");
    }
  }
  return { ...record, vehicleType };
}

function parseOdometer(value?: string): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 20_000_000) {
    throw new Error("Odometer reading must be a whole number between 0 and 20000000");
  }
  return parsed;
}

function validateInspectionDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Inspection date is invalid");
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error("Inspection date is invalid");
  const tomorrow = new Date();
  tomorrow.setUTCHours(0, 0, 0, 0);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  if (date.getTime() >= tomorrow.getTime()) throw new Error("Inspection date cannot be in the future");
}

export async function submitDailyInspection(input: DailyInspectionInput) {
  const user = await getCurrentUser();
  const localActorId = await tenantLocalActorUserId(user);
  if (!canManageInspections(user)) throw new Error("You do not have permission to submit daily inspections");
  if (!input.vehicleId || input.vehicleId.length > 64) throw new Error("Vehicle is required");
  if (!input.inspectionDate) throw new Error("Inspection date is required");
  validateInspectionDate(input.inspectionDate);

  const driverName = input.driverName?.trim() || user.name;
  if (!driverName || driverName.length > 200) throw new Error("Driver name is invalid");
  if (input.tripPurpose && input.tripPurpose.length > 500) throw new Error("Trip purpose must not exceed 500 characters");
  if (input.routeDescription && input.routeDescription.length > 1000) throw new Error("Route description must not exceed 1000 characters");
  if (input.notes && input.notes.length > 2000) throw new Error("Inspection notes must not exceed 2000 characters");
  if (!input.driverSignature) throw new Error("Driver signature is required to attest this inspection");
  validateSignatureDataUrl(input.driverSignature, "Driver signature");
  const preloadingDetails = validatePreloadingDetails(input.preloadingDetails);
  const vehicleType: DailyInspectionVehicleType = preloadingDetails.vehicleType || "general";
  validateCompletedDailyChecklist(input.checklist, vehicleType);
  validateDailyInspectionEvidence(input.checklist);
  const odometer = parseOdometer(input.odometer);

  const [vehicle] = await db
    .select()
    .from(vehicles)
    .where(and(
      eq(vehicles.organizationId, user.organizationId),
      eq(vehicles.id, input.vehicleId),
    ))
    .limit(1);
  if (!vehicle) throw new Error("Vehicle not found");
  if (vehicle.status === "decommissioned") throw new Error("A decommissioned vehicle cannot receive a daily inspection");

  const id = newId();
  const summary = summarizeDailyChecklist(input.checklist);
  const criticalDefects: { item: string; notes: string; photo?: string }[] = [];
  for (const cat of input.checklist) {
    for (const it of cat.items) {
      if (it.result === "fail") {
        criticalDefects.push({
          item: `${cat.category}: ${it.name}`,
          notes: it.notes || "",
          photo: it.photos?.[0],
        });
      }
    }
  }

  // Pre-departure checks are fail-closed: every failed applicable item grounds
  // the vehicle. A supervisor's later review is NOT a clearance override.
  // Client exceptions must be documented and verified outside this workflow;
  // they never convert a failed safety check to an automatic PASS.
  const status: "passed" | "failed" = summary.failed > 0 ? "failed" : "passed";
  const clearedForTrip = summary.failed === 0;
  const checklistReference = "PT-" + input.inspectionDate.replaceAll("-", "") + "-" + id.slice(0, 8).toUpperCase();
  const inspectionMetadata: DailyPreloadingDetails = {
    ...preloadingDetails,
    vehicleMake: vehicle.make,
    chassisNumber: vehicle.chassisNumber || vehicle.vin || preloadingDetails.chassisNumber || "",
    checklistReference,
  };

  await db.insert(dailyInspections).values({
    id,
    organizationId: user.organizationId,
    vehicleId: input.vehicleId,
    driverId: localActorId,
    driverName,
    inspectionDate: input.inspectionDate,
    startTime: new Date(),
    completedAt: new Date(),
    odometer,
    tripPurpose: input.tripPurpose?.trim() || null,
    routeDescription: input.routeDescription?.trim() || null,
    status,
    checklist: input.checklist,
    totalItems: summary.total,
    passedItems: summary.passed,
    failedItems: summary.failed,
    criticalDefects,
    driverSignature: input.driverSignature,
    preloadingDetails: inspectionMetadata,
    clearedForTrip,
    notes: input.notes?.trim() || null,
  } as any);

  await logAudit({
    organizationId: user.organizationId,
    userId: user.id,
    userName: user.name,
    action: "inspect",
    entityType: "daily_inspection",
    entityId: id,
    entityLabel: `${vehicle.registrationNumber} on ${input.inspectionDate}`,
    summary: `Daily pre-trip inspection: ${status.toUpperCase()} (${summary.passed}/${summary.total} passed)`,
    after: { status, clearedForTrip, vehicle: vehicle.registrationNumber },
  });

  revalidatePath("/daily-inspections");
  revalidatePath("/");
  return { id, status, clearedForTrip, summary };
}

export async function getDailyInspectionDetail(id: string) {
  const user = await getCurrentUser();
  if (user.role !== "transporter_user" && !canManageInspections(user)) return null;
  if (!id || id.length > 64) return null;

  const [row] = await db
    .select({
      inspection: dailyInspections,
      vehicle: vehicles,
    })
    .from(dailyInspections)
    .innerJoin(vehicles, eq(vehicles.id, dailyInspections.vehicleId))
    .where(and(
      eq(dailyInspections.organizationId, user.organizationId),
      eq(vehicles.organizationId, user.organizationId),
      eq(dailyInspections.id, id),
    ));
  if (!row || !canAccessTransporterScope(user, row.vehicle.transporterId)) return null;
  return row;
}

export async function getTodaysInspection(vehicleId: string, date: string) {
  const user = await getCurrentUser();
  if (user.role !== "transporter_user" && !canManageInspections(user)) return null;
  if (!vehicleId || vehicleId.length > 64) return null;
  try {
    validateInspectionDate(date);
  } catch {
    return null;
  }

  const [vehicle] = await db
    .select()
    .from(vehicles)
    .where(and(
      eq(vehicles.organizationId, user.organizationId),
      eq(vehicles.id, vehicleId),
    ))
    .limit(1);
  if (!vehicle || !canAccessTransporterScope(user, vehicle.transporterId)) return null;
  const [row] = await db
    .select()
    .from(dailyInspections)
    .where(and(
      eq(dailyInspections.organizationId, user.organizationId),
      eq(dailyInspections.vehicleId, vehicleId),
      eq(dailyInspections.inspectionDate, date),
    ))
    .orderBy(desc(dailyInspections.createdAt))
    .limit(1);
  return row || null;
}

export async function approveDailyInspection(id: string, supervisorNotes?: string) {
  const user = await getCurrentUser();
  const localActorId = await tenantLocalActorUserId(user);
  if (!canApprove(user)) {
    throw new Error("You do not have permission to approve daily inspections");
  }
  if (!id || id.length > 64) throw new Error("Daily inspection reference is invalid");
  if (supervisorNotes && supervisorNotes.length > 4000) throw new Error("Supervisor notes must not exceed 4000 characters");

  const [existing] = await db.select({ id: dailyInspections.id, supervisorReview: dailyInspections.supervisorReview })
    .from(dailyInspections)
    .where(and(
      eq(dailyInspections.organizationId, user.organizationId),
      eq(dailyInspections.id, id),
    ))
    .limit(1);
  if (!existing) throw new Error("Daily inspection not found");
  if (existing.supervisorReview) return { approved: true, alreadyApproved: true };

  await db.update(dailyInspections).set({
    supervisorReview: true,
    supervisorId: localActorId,
    supervisorNotes: supervisorNotes?.trim() || null,
    updatedAt: new Date(),
  }).where(and(
    eq(dailyInspections.organizationId, user.organizationId),
    eq(dailyInspections.id, id),
  ));
  await logAudit({
    organizationId: user.organizationId,
    userId: user.id, userName: user.name, action: "approve",
    entityType: "daily_inspection", entityId: id,
    summary: "Approved daily inspection",
  });
  revalidatePath("/daily-inspections");
  revalidatePath(`/daily-inspections/${id}`);
  return { approved: true, alreadyApproved: false };
}
