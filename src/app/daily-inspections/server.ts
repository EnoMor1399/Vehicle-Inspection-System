"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { dailyInspections, vehicles } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { newId } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, canApprove, canManageInspections, canAccessTransporterScope } from "@/lib/auth";
import type { DailyChecklistCategory } from "@/db/schema";
import { summarizeDailyChecklist } from "@/lib/daily-checklist";
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
};

function validateDailyChecklist(checklist: DailyChecklistCategory[]) {
  if (!Array.isArray(checklist) || checklist.length === 0 || checklist.length > 20) {
    throw new Error("A valid daily inspection checklist is required");
  }

  let totalItems = 0;
  for (const category of checklist) {
    if (!category || typeof category.category !== "string" || !category.category.trim() || category.category.length > 100) {
      throw new Error("Daily checklist contains an invalid category");
    }
    if (!Array.isArray(category.items) || category.items.length > 100) {
      throw new Error("Daily checklist category contains too many items");
    }

    totalItems += category.items.length;
    if (totalItems > 250) throw new Error("Daily checklist contains too many items");

    for (const item of category.items) {
      if (!item || typeof item.name !== "string" || !item.name.trim() || item.name.length > 200) {
        throw new Error("Daily checklist item name is invalid");
      }
      if (!(["pass", "fail", "na"] as const).includes(item.result)) {
        throw new Error("Daily checklist item contains an invalid result");
      }
      if (item.notes && item.notes.length > 1000) {
        throw new Error("Daily checklist item notes must not exceed 1000 characters");
      }
    }
  }

  validateDailyInspectionEvidence(checklist);
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
  validateDailyChecklist(input.checklist);
  const odometer = parseOdometer(input.odometer);

  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, input.vehicleId)).limit(1);
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

  let status: "passed" | "failed" | "defect_noted" = "passed";
  let clearedForTrip = true;
  if (summary.failed > 0) {
    const criticalCategories = ["Brakes", "Lights & Signals", "Tires & Wheels"];
    const hasCriticalFail = input.checklist.some(
      (cat) => criticalCategories.includes(cat.category) && cat.items.some((it) => it.result === "fail")
    );
    if (hasCriticalFail || summary.failed >= 3) {
      status = "failed";
      clearedForTrip = false;
    } else {
      status = "defect_noted";
    }
  }

  await db.insert(dailyInspections).values({
    id,
    vehicleId: input.vehicleId,
    driverId: user.id,
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
    clearedForTrip,
    notes: input.notes?.trim() || null,
  } as any);

  await logAudit({
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
    .where(eq(dailyInspections.id, id));
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

  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1);
  if (!vehicle || !canAccessTransporterScope(user, vehicle.transporterId)) return null;
  const [row] = await db
    .select()
    .from(dailyInspections)
    .where(and(eq(dailyInspections.vehicleId, vehicleId), eq(dailyInspections.inspectionDate, date)))
    .orderBy(desc(dailyInspections.createdAt))
    .limit(1);
  return row || null;
}

export async function approveDailyInspection(id: string, supervisorNotes?: string) {
  const user = await getCurrentUser();
  if (!canApprove(user)) {
    throw new Error("You do not have permission to approve daily inspections");
  }
  if (!id || id.length > 64) throw new Error("Daily inspection reference is invalid");
  if (supervisorNotes && supervisorNotes.length > 4000) throw new Error("Supervisor notes must not exceed 4000 characters");

  const [existing] = await db.select({ id: dailyInspections.id, supervisorReview: dailyInspections.supervisorReview })
    .from(dailyInspections)
    .where(eq(dailyInspections.id, id))
    .limit(1);
  if (!existing) throw new Error("Daily inspection not found");
  if (existing.supervisorReview) return { approved: true, alreadyApproved: true };

  await db.update(dailyInspections).set({
    supervisorReview: true,
    supervisorId: user.id,
    supervisorNotes: supervisorNotes?.trim() || null,
    updatedAt: new Date(),
  }).where(eq(dailyInspections.id, id));
  await logAudit({
    userId: user.id, userName: user.name, action: "approve",
    entityType: "daily_inspection", entityId: id,
    summary: "Approved daily inspection",
  });
  revalidatePath("/daily-inspections");
  revalidatePath(`/daily-inspections/${id}`);
  return { approved: true, alreadyApproved: false };
}
