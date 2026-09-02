"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { vehicles, inspections, transporters } from "@/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import { newId } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, canEditVehicles, canAccessTransporterScope } from "@/lib/auth";
import { adminValidationMessage, vehicleAdminSchema } from "@/lib/admin-entity-policy";
import { validateGenericVehicleStatusTransition } from "@/lib/vehicle-lifecycle";
import { emitWebhookEvent } from "@/lib/webhook-delivery";

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

function parseVehicleInput(data: VehicleFormData) {
  const parsed = vehicleAdminSchema.safeParse(data);
  if (!parsed.success) throw new Error(adminValidationMessage(parsed.error));
  return parsed.data;
}

function integerOrNull(value: string | undefined) {
  return value ? Number(value) : null;
}

async function validateTransporterReference(transporterId: string | null | undefined) {
  if (!transporterId) return null;
  const [row] = await db
    .select({ id: transporters.id })
    .from(transporters)
    .where(and(eq(transporters.id, transporterId), isNull(transporters.deletedAt)))
    .limit(1);
  if (!row) throw new Error("Selected transporter was not found or is inactive");
  return row.id;
}

function buildVehiclePayload(data: ReturnType<typeof parseVehicleInput>, transporterId: string | null) {
  return {
    transporterId,
    registrationNumber: data.registrationNumber.toUpperCase(),
    oldRegistrationNumber: data.oldRegistrationNumber?.toUpperCase() || null,
    make: data.make,
    model: data.model || null,
    variant: data.variant || null,
    bodyType: data.bodyType || null,
    category: data.category || null,
    vehicleClass: data.vehicleClass || null,
    colour: data.colour || null,
    manufacturingYear: integerOrNull(data.manufacturingYear),
    countryOfManufacture: data.countryOfManufacture || null,
    engineNumber: data.engineNumber || null,
    chassisNumber: data.chassisNumber || null,
    vin: data.vin?.toUpperCase() || null,
    fuelType: (data.fuelType || null) as typeof vehicles.$inferInsert.fuelType,
    transmission: (data.transmission || null) as typeof vehicles.$inferInsert.transmission,
    engineCapacity: integerOrNull(data.engineCapacity),
    seatingCapacity: integerOrNull(data.seatingCapacity),
    grossWeight: data.grossWeight || null,
    netWeight: data.netWeight || null,
    numberOfAxles: integerOrNull(data.numberOfAxles),
    odometerReading: integerOrNull(data.odometerReading),
    ownerName: data.ownerName || null,
    ownerContact: data.ownerContact || null,
    insuranceCompany: data.insuranceCompany || null,
    policyNumber: data.policyNumber || null,
    insuranceExpiry: data.insuranceExpiry || null,
    roadworthyExpiry: data.roadworthyExpiry || null,
    roadFundExpiry: data.roadFundExpiry || null,
  };
}

export async function createVehicle(data: VehicleFormData) {
  const user = await requireEditor();
  const parsed = parseVehicleInput(data);
  const status = parsed.status || "active";
  if (status !== "active" && status !== "suspended") {
    throw new Error("New vehicles can start only as active or suspended");
  }

  const transporterId = await validateTransporterReference(parsed.transporterId);
  const id = newId();
  const payload = {
    id,
    ...buildVehiclePayload(parsed, transporterId),
    status,
  };

  try {
    await db.insert(vehicles).values(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/unique|duplicate/i.test(message)) throw new Error("Vehicle registration already exists");
    throw new Error("Vehicle could not be created");
  }

  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "create",
    entityType: "vehicle",
    entityId: id,
    entityLabel: payload.registrationNumber,
    summary: `Created vehicle ${payload.registrationNumber}`,
    after: payload,
  });

  await emitWebhookEvent("vehicle.created", {
    id,
    registrationNumber: payload.registrationNumber,
    transporterId,
    status,
  });

  revalidatePath("/vehicles");
  return { id };
}

export async function updateVehicle(id: string, data: VehicleFormData) {
  const user = await requireEditor();
  if (!id || id.length > 64) throw new Error("Vehicle reference is invalid");
  const parsed = parseVehicleInput(data);

  const [before] = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
  if (!before) throw new Error("Vehicle not found");
  if (before.status === "decommissioned") {
    throw new Error("A decommissioned vehicle cannot be edited");
  }

  const requestedStatus = parsed.status || before.status;
  const transition = validateGenericVehicleStatusTransition(before.status, requestedStatus);
  if (!transition.ok) throw new Error(transition.message);

  const transporterId = await validateTransporterReference(parsed.transporterId);
  const payload = {
    ...buildVehiclePayload(parsed, transporterId),
    status: requestedStatus,
    updatedAt: new Date(),
  };

  try {
    await db.update(vehicles).set(payload).where(eq(vehicles.id, id));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/unique|duplicate/i.test(message)) throw new Error("Vehicle registration already exists");
    throw new Error("Vehicle could not be updated");
  }

  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "update",
    entityType: "vehicle",
    entityId: id,
    entityLabel: payload.registrationNumber,
    summary: `Updated vehicle ${payload.registrationNumber}`,
    before,
    after: payload,
  });

  await emitWebhookEvent("vehicle.updated", {
    id,
    registrationNumber: payload.registrationNumber,
    transporterId,
    status: requestedStatus,
  });

  revalidatePath(`/vehicles/${id}`);
  revalidatePath("/vehicles");
}

export async function decommissionVehicle(id: string) {
  const user = await requireEditor();
  if (!id || id.length > 64) throw new Error("Vehicle reference is invalid");
  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
  if (!vehicle) return { decommissioned: false, notFound: true };
  if (vehicle.status === "decommissioned") return { decommissioned: true, alreadyDecommissioned: true };

  await db.update(vehicles).set({ status: "decommissioned", updatedAt: new Date() }).where(eq(vehicles.id, id));
  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "archive",
    entityType: "vehicle",
    entityId: id,
    entityLabel: vehicle.registrationNumber,
    summary: `Decommissioned vehicle ${vehicle.registrationNumber}`,
    before: { status: vehicle.status },
    after: { status: "decommissioned" },
  });

  await emitWebhookEvent("vehicle.updated", {
    id,
    registrationNumber: vehicle.registrationNumber,
    transporterId: vehicle.transporterId,
    status: "decommissioned",
  });

  revalidatePath(`/vehicles/${id}`);
  revalidatePath("/vehicles");
  return { decommissioned: true, alreadyDecommissioned: false };
}

export async function getVehicleDetail(id: string) {
  const user = await getCurrentUser();
  if (user.role !== "transporter_user" && !canEditVehicles(user)) return null;
  if (!id || id.length > 64) return null;
  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
  if (!vehicle || !canAccessTransporterScope(user, vehicle.transporterId)) return null;
  const inspectionRows = await db
    .select()
    .from(inspections)
    .where(eq(inspections.vehicleId, id))
    .orderBy(desc(inspections.inspectionDate));
  return { vehicle, inspections: inspectionRows };
}