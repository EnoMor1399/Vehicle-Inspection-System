"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { transporters, vehicles, inspections } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { newId } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, canEditTransporters, canAccessTransporterScope } from "@/lib/auth";

export type TransporterFormData = {
  companyName: string;
  registrationNumber?: string;
  tinNumber?: string;
  gpsAddress?: string;
  contactPerson?: string;
  mobile?: string;
  email?: string;
  physicalAddress?: string;
  region?: string;
  district?: string;
  insuranceCompany?: string;
  insuranceExpiry?: string;
};

async function requireEditor() {
  const user = await getCurrentUser();
  if (!canEditTransporters(user)) {
    throw new Error("You are not authorised to manage transporters.");
  }
  return user;
}

export async function createTransporter(data: TransporterFormData) {
  const user = await requireEditor();
  if (!data.companyName.trim()) throw new Error("Company name is required");
  const id = newId();
  await db.insert(transporters).values({
    id,
    companyName: data.companyName.trim(),
    registrationNumber: data.registrationNumber || null,
    tinNumber: data.tinNumber || null,
    gpsAddress: data.gpsAddress || null,
    contactPerson: data.contactPerson || null,
    mobile: data.mobile || null,
    email: data.email || null,
    physicalAddress: data.physicalAddress || null,
    region: data.region || null,
    district: data.district || null,
    insuranceCompany: data.insuranceCompany || null,
    insuranceExpiry: data.insuranceExpiry || null,
  });
  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "create",
    entityType: "transporter",
    entityId: id,
    entityLabel: data.companyName,
    summary: `Created transporter ${data.companyName}`,
    after: data,
  });
  revalidatePath("/transporters");
  return { id };
}

export async function updateTransporter(id: string, data: TransporterFormData) {
  const user = await requireEditor();
  const [before] = await db.select().from(transporters).where(eq(transporters.id, id));
  if (!before) throw new Error("Transporter not found");
  await db
    .update(transporters)
    .set({
      companyName: data.companyName.trim(),
      registrationNumber: data.registrationNumber || null,
      tinNumber: data.tinNumber || null,
      gpsAddress: data.gpsAddress || null,
      contactPerson: data.contactPerson || null,
      mobile: data.mobile || null,
      email: data.email || null,
      physicalAddress: data.physicalAddress || null,
      region: data.region || null,
      district: data.district || null,
      insuranceCompany: data.insuranceCompany || null,
      insuranceExpiry: data.insuranceExpiry || null,
      updatedAt: new Date(),
    })
    .where(eq(transporters.id, id));
  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "update",
    entityType: "transporter",
    entityId: id,
    entityLabel: data.companyName,
    summary: `Updated transporter ${data.companyName}`,
    before,
    after: data,
  });
  revalidatePath(`/transporters/${id}`);
  revalidatePath("/transporters");
}

export async function deleteTransporter(id: string) {
  const user = await requireEditor();
  const [t] = await db.select().from(transporters).where(eq(transporters.id, id));
  if (!t) return;
  // soft delete
  await db
    .update(transporters)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(transporters.id, id));
  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "delete",
    entityType: "transporter",
    entityId: id,
    entityLabel: t.companyName,
    summary: `Soft-deleted transporter ${t.companyName}`,
  });
  revalidatePath("/transporters");
}

export async function getTransporterDetail(id: string) {
  const user = await getCurrentUser();
  if (!canAccessTransporterScope(user, id)) return null;
  const [t] = await db.select().from(transporters).where(
    and(eq(transporters.id, id), isNull(transporters.deletedAt))
  );
  if (!t) return null;
  const fleet = await db.select().from(vehicles).where(eq(vehicles.transporterId, id));
  const ids = fleet.map((v) => v.id);
  const insp = ids.length
    ? await db
        .select({
          id: inspections.id,
          vehicleId: inspections.vehicleId,
          inspectionNumber: inspections.inspectionNumber,
          inspectionDate: inspections.inspectionDate,
          overallResult: inspections.overallResult,
          regNumber: vehicles.registrationNumber,
        })
        .from(inspections)
        .innerJoin(vehicles, eq(inspections.vehicleId, vehicles.id))
        .where(eq(vehicles.transporterId, id))
    : [];
  return { transporter: t, fleet, inspections: insp };
}
