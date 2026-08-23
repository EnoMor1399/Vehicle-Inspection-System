"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { dailyInspections, vehicles } from "@/db/schema";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { newId } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, canApprove } from "@/lib/auth";
import type { DailyChecklistCategory } from "@/db/schema";
import { summarizeDailyChecklist } from "@/lib/daily-checklist";

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

export async function submitDailyInspection(input: DailyInspectionInput) {
  const user = await getCurrentUser();
  if (!input.vehicleId) throw new Error("Vehicle is required");
  if (!input.inspectionDate) throw new Error("Inspection date is required");

  // Verify vehicle exists
  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, input.vehicleId));
  if (!vehicle) throw new Error("Vehicle not found");

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

  // Determine status and trip clearance
  let status: "passed" | "failed" | "defect_noted" = "passed";
  let clearedForTrip = true;
  if (summary.failed > 0) {
    // Safety-critical failures block trip
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
    driverName: input.driverName || user.name,
    inspectionDate: input.inspectionDate,
    startTime: new Date(),
    completedAt: new Date(),
    odometer: input.odometer ? parseInt(input.odometer) : null,
    tripPurpose: input.tripPurpose || null,
    routeDescription: input.routeDescription || null,
    status,
    checklist: input.checklist,
    totalItems: summary.total,
    passedItems: summary.passed,
    failedItems: summary.failed,
    criticalDefects,
    driverSignature: input.driverSignature || null,
    clearedForTrip,
    notes: input.notes || null,
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
  const [row] = await db
    .select({
      inspection: dailyInspections,
      vehicle: vehicles,
    })
    .from(dailyInspections)
    .innerJoin(vehicles, eq(vehicles.id, dailyInspections.vehicleId))
    .where(eq(dailyInspections.id, id));
  return row || null;
}

export async function getTodaysInspection(vehicleId: string, date: string) {
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
  await db.update(dailyInspections).set({
    supervisorReview: true,
    supervisorId: user.id,
    supervisorNotes: supervisorNotes || null,
    updatedAt: new Date(),
  }).where(eq(dailyInspections.id, id));
  await logAudit({
    userId: user.id, userName: user.name, action: "approve",
    entityType: "daily_inspection", entityId: id,
    summary: "Approved daily inspection",
  });
  revalidatePath("/daily-inspections");
  revalidatePath(`/daily-inspections/${id}`);
}
