"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { vehicles, inspections } from "@/db/schema";
import { eq, and, desc, isNull, sql } from "drizzle-orm";
import { newId } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, canEditVehicles } from "@/lib/auth";

export type VehicleFormData = {
  transporterId?: string | null;
  registrationNumber: string;
  oldRegistrationNumber?: string;
  make: string;
  model?: string;
  variant?: string;
  bodyType?: string;
  category?: string;
  vehicleClass?: string;
  colour?: string;
  manufacturingYear?: string;
  countryOfManufacture?: string;
  engineNumber?: string;
  chassisNumber?: string;
  vin?: string;
  fuelType?: "petrol" | "diesel" | "electric" | "hybrid" | "cng" | "lpg" | "";
  transmission?: "manual" | "automatic" | "cvt" | "semi-automatic" | "";
  engineCapacity?: string;
  seatingCapacity?: string;
  grossWeight?: string;
  netWeight?: string;
  numberOfAxles?: string;
  odometerReading?: string;
  ownerName?: string;
  ownerContact?: string;
  insuranceCompany?: string;
  policyNumber?: string;
  insuranceExpiry?: string;
  roadworthyExpiry?: string;
  roadFundExpiry?: string;
  status?: "active" | "under_inspection" | "failed" | "passed" | "suspended" | "decommissioned";
};

async function requireEditor() {
  const user = await getCurrentUser();
  if (!canEditVehicles(user)) throw new Error("Not authorised");
  return user;
}

function toNumber(v: string | undefined): number | null {
  if (!v || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function createVehicle(data: VehicleFormData) {
  const user = await requireEditor();
  if (!data.registrationNumber.trim()) throw new Error("Registration number is required");
  if (!data.make.trim()) throw new Error("Vehicle make is required");
  const id = newId();
  const payload = {
    id,
    transporterId: data.transporterId || null,
    registrationNumber: data.registrationNumber.trim(),
    oldRegistrationNumber: data.oldRegistrationNumber || null,
    make: data.make.trim(),
    model: data.model || null,
    variant: data.variant || null,
    bodyType: data.bodyType || null,
    category: data.category || null,
    vehicleClass: data.vehicleClass || null,
    colour: data.colour || null,
    manufacturingYear: toNumber(data.manufacturingYear),
    countryOfManufacture: data.countryOfManufacture || null,
    engineNumber: data.engineNumber || null,
    chassisNumber: data.chassisNumber || null,
    vin: data.vin || null,
    fuelType: (data.fuelType || null) as any,
    transmission: (data.transmission || null) as any,
    engineCapacity: toNumber(data.engineCapacity),
    seatingCapacity: toNumber(data.seatingCapacity),
    grossWeight: data.grossWeight || null,
    netWeight: data.netWeight || null,
    numberOfAxles: toNumber(data.numberOfAxles),
    odometerReading: toNumber(data.odometerReading),
    ownerName: data.ownerName || null,
    ownerContact: data.ownerContact || null,
    insuranceCompany: data.insuranceCompany || null,
    policyNumber: data.policyNumber || null,
    insuranceExpiry: data.insuranceExpiry || null,
    roadworthyExpiry: data.roadworthyExpiry || null,
    roadFundExpiry: data.roadFundExpiry || null,
    status: data.status || "active",
  };
  await db.insert(vehicles).values(payload);
  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "create",
    entityType: "vehicle",
    entityId: id,
    entityLabel: data.registrationNumber,
    summary: `Created vehicle ${data.registrationNumber}`,
    after: payload,
  });
  revalidatePath("/vehicles");
  return { id };
}

export async function updateVehicle(id: string, data: VehicleFormData) {
  const user = await requireEditor();
  const [before] = await db.select().from(vehicles).where(eq(vehicles.id, id));
  if (!before) throw new Error("Vehicle not found");
  const payload = {
    transporterId: data.transporterId || null,
    registrationNumber: data.registrationNumber.trim(),
    oldRegistrationNumber: data.oldRegistrationNumber || null,
    make: data.make.trim(),
    model: data.model || null,
    variant: data.variant || null,
    bodyType: data.bodyType || null,
    category: data.category || null,
    vehicleClass: data.vehicleClass || null,
    colour: data.colour || null,
    manufacturingYear: toNumber(data.manufacturingYear),
    countryOfManufacture: data.countryOfManufacture || null,
    engineNumber: data.engineNumber || null,
    chassisNumber: data.chassisNumber || null,
    vin: data.vin || null,
    fuelType: (data.fuelType || null) as any,
    transmission: (data.transmission || null) as any,
    engineCapacity: toNumber(data.engineCapacity),
    seatingCapacity: toNumber(data.seatingCapacity),
    grossWeight: data.grossWeight || null,
    netWeight: data.netWeight || null,
    numberOfAxles: toNumber(data.numberOfAxles),
    odometerReading: toNumber(data.odometerReading),
    ownerName: data.ownerName || null,
    ownerContact: data.ownerContact || null,
    insuranceCompany: data.insuranceCompany || null,
    policyNumber: data.policyNumber || null,
    insuranceExpiry: data.insuranceExpiry || null,
    roadworthyExpiry: data.roadworthyExpiry || null,
    roadFundExpiry: data.roadFundExpiry || null,
    status: data.status || "active",
    updatedAt: new Date(),
  };
  await db.update(vehicles).set(payload).where(eq(vehicles.id, id));
  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "update",
    entityType: "vehicle",
    entityId: id,
    entityLabel: data.registrationNumber,
    summary: `Updated vehicle ${data.registrationNumber}`,
    before,
    after: payload,
  });
  revalidatePath(`/vehicles/${id}`);
  revalidatePath("/vehicles");
}

export async function deleteVehicle(id: string) {
  const user = await requireEditor();
  const [v] = await db.select().from(vehicles).where(eq(vehicles.id, id));
  if (!v) return;
  await db.delete(vehicles).where(eq(vehicles.id, id));
  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "delete",
    entityType: "vehicle",
    entityId: id,
    entityLabel: v.registrationNumber,
    summary: `Deleted vehicle ${v.registrationNumber}`,
  });
  revalidatePath("/vehicles");
}

export async function getVehicleDetail(id: string) {
  const [v] = await db.select().from(vehicles).where(eq(vehicles.id, id));
  if (!v) return null;
  const insp = await db
    .select()
    .from(inspections)
    .where(eq(inspections.vehicleId, id))
    .orderBy(desc(inspections.inspectionDate));
  return { vehicle: v, inspections: insp };
}
