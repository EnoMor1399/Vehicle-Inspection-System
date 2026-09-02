"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { transporters, vehicles, inspections } from "@/db/schema";
import { and, eq, isNull, ne } from "drizzle-orm";
import { newId } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, canEditTransporters, canAccessTransporterScope } from "@/lib/auth";
import { adminValidationMessage, transporterAdminSchema } from "@/lib/admin-entity-policy";

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

function parseTransporterInput(data: TransporterFormData) {
  const parsed = transporterAdminSchema.safeParse(data);
  if (!parsed.success) throw new Error(adminValidationMessage(parsed.error));
  return parsed.data;
}

function transporterValues(data: ReturnType<typeof parseTransporterInput>) {
  return {
    companyName: data.companyName,
    registrationNumber: data.registrationNumber || null,
    tinNumber: data.tinNumber || null,
    gpsAddress: data.gpsAddress || null,
    contactPerson: data.contactPerson || null,
    mobile: data.mobile || null,
    email: data.email?.toLowerCase() || null,
    physicalAddress: data.physicalAddress || null,
    region: data.region || null,
    district: data.district || null,
    insuranceCompany: data.insuranceCompany || null,
    insuranceExpiry: data.insuranceExpiry || null,
  };
}

export async function createTransporter(data: TransporterFormData) {
  const user = await requireEditor();
  const parsed = parseTransporterInput(data);
  const [duplicate] = await db
    .select({ id: transporters.id })
    .from(transporters)
    .where(and(eq(transporters.companyName, parsed.companyName), isNull(transporters.deletedAt)))
    .limit(1);
  if (duplicate) throw new Error("An active transporter already uses this company name");

  const id = newId();
  const values = transporterValues(parsed);
  await db.insert(transporters).values({ id, ...values });
  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "create",
    entityType: "transporter",
    entityId: id,
    entityLabel: parsed.companyName,
    summary: `Created transporter ${parsed.companyName}`,
    after: values,
  });
  revalidatePath("/transporters");
  return { id };
}

export async function updateTransporter(id: string, data: TransporterFormData) {
  const user = await requireEditor();
  if (!id || id.length > 64) throw new Error("Transporter reference is invalid");
  const parsed = parseTransporterInput(data);

  const [before] = await db
    .select()
    .from(transporters)
    .where(and(eq(transporters.id, id), isNull(transporters.deletedAt)))
    .limit(1);
  if (!before) throw new Error("Transporter not found");

  const [duplicate] = await db
    .select({ id: transporters.id })
    .from(transporters)
    .where(and(
      eq(transporters.companyName, parsed.companyName),
      ne(transporters.id, id),
      isNull(transporters.deletedAt)
    ))
    .limit(1);
  if (duplicate) throw new Error("Another active transporter already uses this company name");

  const values = { ...transporterValues(parsed), updatedAt: new Date() };
  await db.update(transporters).set(values).where(eq(transporters.id, id));
  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "update",
    entityType: "transporter",
    entityId: id,
    entityLabel: parsed.companyName,
    summary: `Updated transporter ${parsed.companyName}`,
    before,
    after: values,
  });
  revalidatePath(`/transporters/${id}`);
  revalidatePath("/transporters");
}

export async function deleteTransporter(id: string) {
  const user = await requireEditor();
  if (!id || id.length > 64) throw new Error("Transporter reference is invalid");
  const [transporter] = await db
    .select()
    .from(transporters)
    .where(and(eq(transporters.id, id), isNull(transporters.deletedAt)))
    .limit(1);
  if (!transporter) return { deleted: false, notFound: true };

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
    entityLabel: transporter.companyName,
    summary: `Soft-deleted transporter ${transporter.companyName}`,
  });
  revalidatePath("/transporters");
  return { deleted: true };
}

export async function getTransporterDetail(id: string) {
  const user = await getCurrentUser();
  if (!id || id.length > 64) return null;
  if (user.role === "transporter_user") {
    if (!canAccessTransporterScope(user, id)) return null;
  } else if (!canEditTransporters(user)) {
    return null;
  }

  const [transporter] = await db.select().from(transporters).where(
    and(eq(transporters.id, id), isNull(transporters.deletedAt))
  ).limit(1);
  if (!transporter) return null;

  const fleet = await db.select().from(vehicles).where(eq(vehicles.transporterId, id));
  const inspectionRows = fleet.length
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
  return { transporter, fleet, inspections: inspectionRows };
}
