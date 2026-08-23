"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { inspections, vehicles } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { newId } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, canManageInspections } from "@/lib/auth";
import type { InspectionSectionData } from "@/db/schema";

async function requireEditor() {
  const user = await getCurrentUser();
  if (!canManageInspections(user)) throw new Error("Not authorised");
  return user;
}

export type InspectionFormData = {
  vehicleId: string;
  inspectionDate: string;
  inspectorName: string;
  supervisorName?: string;
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
  supervisorRemarks?: string;
  nextInspectionDate?: string;
  reinspectionDate?: string;
  templateType?: string;
  inspectorSignature?: string;
  supervisorSignature?: string;
  attachedDocuments?: import("@/db/schema").InspectionDocument[];
};

function toNextInspectionNumber(count: number): string {
  const year = new Date().getFullYear();
  const seq = String(count + 1).padStart(4, "0");
  return `RSL-INS-${year}-${seq}`;
}

export async function createInspection(data: InspectionFormData) {
  const user = await requireEditor();
  if (!data.vehicleId) throw new Error("Vehicle is required");
  const [countRow] = await db.select({ n: sql<number>`count(*)::int` }).from(inspections);
  const inspectionNumber = toNextInspectionNumber(countRow?.n ?? 0);
  const id = newId();
  const payload = {
    id,
    inspectionNumber,
    vehicleId: data.vehicleId,
    inspectionDate: new Date(data.inspectionDate),
    inspectorId: user.id,
    inspectorName: data.inspectorName || user.name,
    supervisorName: data.supervisorName || null,
    station: data.station,
    odometerReading: data.odometerReading ? Number(data.odometerReading) : null,
    sectionData: data.sectionData,
    serviceBrakeEfficiency: data.serviceBrakeEfficiency || null,
    parkingBrakeEfficiency: data.parkingBrakeEfficiency || null,
    smokeTest: data.smokeTest ?? null,
    noiseLevel: data.noiseLevel || null,
    opacityTest: data.opacityTest || null,
    overallResult: data.overallResult,
    inspectorRemarks: data.inspectorRemarks || null,
    supervisorRemarks: data.supervisorRemarks || null,
    nextInspectionDate: data.nextInspectionDate || null,
    reinspectionDate: data.reinspectionDate || null,
    templateType: data.templateType || null,
    inspectorSignature: data.inspectorSignature || null,
    supervisorSignature: data.supervisorSignature || null,
    attachedDocuments: data.attachedDocuments || [],
    totalPhotos: (data.sectionData || []).reduce(
      (sum, s) => sum + s.items.reduce((iSum, it) => iSum + (it.photos?.length || 0), 0),
      0
    ),
    status: "completed",
  } as const;
  await db.insert(inspections).values(payload as any);
  // Save signature rows
  const { signatures } = await import("@/db/schema");
  if (data.inspectorSignature) {
    await db.insert(signatures).values({
      id: newId(), inspectionId: id, type: "inspector",
      signerName: data.inspectorName || user.name, signerId: user.id,
      dataUrl: data.inspectorSignature,
    });
  }
  if (data.supervisorSignature) {
    await db.insert(signatures).values({
      id: newId(), inspectionId: id, type: "supervisor",
      signerName: data.supervisorName || data.inspectorName || user.name,
      dataUrl: data.supervisorSignature,
    });
  }
  // Update vehicle status
  let newStatus = "active";
  if (data.overallResult === "pass") newStatus = "passed";
  else if (data.overallResult === "fail") newStatus = "failed";
  else newStatus = "under_inspection";
  await db.update(vehicles).set({ status: newStatus as any, updatedAt: new Date() }).where(eq(vehicles.id, data.vehicleId));

  const [v] = await db.select().from(vehicles).where(eq(vehicles.id, data.vehicleId));
  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "inspect",
    entityType: "inspection",
    entityId: id,
    entityLabel: inspectionNumber,
    summary: `Completed inspection ${inspectionNumber} for ${v?.registrationNumber || "vehicle"} — ${data.overallResult.toUpperCase()}`,
    after: { result: data.overallResult, vehicle: v?.registrationNumber },
  });
  revalidatePath("/inspections");
  revalidatePath("/vehicles");
  revalidatePath("/");
  return { id, inspectionNumber };
}

export async function getInspectionDetail(id: string) {
  const [row] = await db
    .select({
      inspection: inspections,
      vehicle: vehicles,
    })
    .from(inspections)
    .innerJoin(vehicles, eq(inspections.vehicleId, vehicles.id))
    .where(eq(inspections.id, id));
  return row || null;
}
