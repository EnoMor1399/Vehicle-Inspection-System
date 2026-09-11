"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gt, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { locations } from "@/db/schema";
import { trainingSessions } from "@/db/training-schema";
import { trainingResourceAllocations, trainingResources } from "@/db/training-logistics-schema";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { canManageTraining } from "@/lib/training-access";
import {
  canAllocateTrainingResource,
  canTransitionTrainingResourceAllocation,
  resourceDemandFits,
  trainingLogisticsValidationMessage,
  trainingResourceAllocationSchema,
  trainingResourceAllocationStatusSchema,
  trainingResourceOperationalState,
  trainingResourceSchema,
  trainingResourceStatusSchema,
} from "@/lib/training-logistics-policy";
import { newId } from "@/lib/utils";

const ACTIVE_ALLOCATION_STATUSES = ["reserved", "confirmed"] as const;
const ACTIVE_SESSION_STATUSES = ["scheduled", "in_progress"] as const;

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function checked(formData: FormData, name: string) {
  return formData.has(name);
}

function refreshLogisticsPaths() {
  revalidatePath("/driver-training");
  revalidatePath("/driver-training/logistics");
  revalidatePath("/driver-training/readiness");
  revalidatePath("/driver-training/sessions");
}

async function requireTrainingManager() {
  const user = await getCurrentUser();
  if (!canManageTraining(user)) {
    throw new Error("You do not have permission to manage Driver Training logistics records");
  }
  return user;
}

export async function createTrainingResource(formData: FormData) {
  const actor = await requireTrainingManager();
  const parsed = trainingResourceSchema.safeParse({
    resourceCode: field(formData, "resourceCode"),
    name: field(formData, "name"),
    resourceType: field(formData, "resourceType"),
    status: field(formData, "status") || "available",
    locationId: field(formData, "locationId"),
    identifier: field(formData, "identifier"),
    isExclusive: checked(formData, "isExclusive"),
    availableQuantity: field(formData, "availableQuantity") || "1",
    capacity: field(formData, "capacity") || "1",
    serviceDueDate: field(formData, "serviceDueDate"),
    inspectionDueDate: field(formData, "inspectionDueDate"),
    notes: field(formData, "notes"),
  });
  if (!parsed.success) throw new Error(trainingLogisticsValidationMessage(parsed.error));
  const data = parsed.data;

  if (data.locationId) {
    const [location] = await db.select({ id: locations.id }).from(locations).where(eq(locations.id, data.locationId)).limit(1);
    if (!location) throw new Error("Selected resource location does not exist");
  }

  const id = newId();
  const createdAt = new Date();
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`training-resource:${data.resourceCode}`}))`);
    const [existing] = await tx.select({ id: trainingResources.id }).from(trainingResources).where(eq(trainingResources.resourceCode, data.resourceCode)).limit(1);
    if (existing) throw new Error("A training resource with this code already exists");
    const [created] = await tx.insert(trainingResources).values({
      id,
      resourceCode: data.resourceCode,
      name: data.name,
      resourceType: data.resourceType,
      status: data.status,
      locationId: data.locationId || null,
      identifier: data.identifier || null,
      isExclusive: data.isExclusive,
      availableQuantity: data.availableQuantity,
      capacity: data.capacity,
      serviceDueDate: data.serviceDueDate || null,
      inspectionDueDate: data.inspectionDueDate || null,
      notes: data.notes || null,
      createdBy: actor.id,
      createdAt,
      updatedAt: createdAt,
    }).returning();
    return created;
  });

  await logAudit({
    userId: actor.id,
    userName: actor.name,
    action: "create",
    entityType: "training_resource",
    entityId: result?.id || id,
    entityLabel: data.resourceCode,
    summary: `Created Driver Training ${data.resourceType.replaceAll("_", " ")} resource ${data.resourceCode}`,
    after: result,
  });
  refreshLogisticsPaths();
}

export async function updateTrainingResourceStatus(formData: FormData) {
  const actor = await requireTrainingManager();
  const parsed = trainingResourceStatusSchema.safeParse({
    resourceId: field(formData, "resourceId"),
    status: field(formData, "status"),
    note: field(formData, "note"),
  });
  if (!parsed.success) throw new Error(trainingLogisticsValidationMessage(parsed.error));
  const data = parsed.data;
  const updatedAt = new Date();

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`training-resource:${data.resourceId}`}))`);
    const [before] = await tx.select().from(trainingResources).where(eq(trainingResources.id, data.resourceId)).limit(1);
    if (!before) throw new Error("Training resource not found");
    if (before.status === "retired" && data.status !== "retired") throw new Error("Retired training resources cannot be returned to service");
    const [after] = await tx.update(trainingResources).set({ status: data.status, updatedAt }).where(eq(trainingResources.id, before.id)).returning();
    return { before, after };
  });

  await logAudit({
    userId: actor.id,
    userName: actor.name,
    action: "update",
    entityType: "training_resource",
    entityId: result.after?.id || data.resourceId,
    entityLabel: result.before.resourceCode,
    summary: `Changed training resource ${result.before.resourceCode} status from ${result.before.status} to ${data.status}${data.note ? `: ${data.note}` : ""}`,
    before: result.before,
    after: result.after,
  });
  refreshLogisticsPaths();
}

export async function reserveTrainingResource(formData: FormData) {
  const actor = await requireTrainingManager();
  const parsed = trainingResourceAllocationSchema.safeParse({
    resourceId: field(formData, "resourceId"),
    sessionId: field(formData, "sessionId"),
    quantity: field(formData, "quantity") || "1",
    notes: field(formData, "notes"),
  });
  if (!parsed.success) throw new Error(trainingLogisticsValidationMessage(parsed.error));
  const data = parsed.data;
  const allocatedAt = new Date();

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`training-resource-allocation:${data.resourceId}`}))`);
    const [resource] = await tx.select().from(trainingResources).where(eq(trainingResources.id, data.resourceId)).limit(1);
    if (!resource) throw new Error("Training resource not found");
    const [session] = await tx.select().from(trainingSessions).where(eq(trainingSessions.id, data.sessionId)).limit(1);
    if (!session) throw new Error("Training session not found");

    const resourceState = trainingResourceOperationalState(resource, allocatedAt);
    if (!canAllocateTrainingResource(session.status, resourceState)) {
      throw new Error(`Resource cannot be reserved for this session (${session.status}; resource ${resourceState})`);
    }
    if (data.quantity > resource.availableQuantity) {
      throw new Error(`Requested quantity exceeds available quantity (${resource.availableQuantity})`);
    }

    const [activeSameSession] = await tx
      .select({ id: trainingResourceAllocations.id })
      .from(trainingResourceAllocations)
      .where(and(
        eq(trainingResourceAllocations.resourceId, resource.id),
        eq(trainingResourceAllocations.sessionId, session.id),
        inArray(trainingResourceAllocations.status, [...ACTIVE_ALLOCATION_STATUSES]),
      ))
      .limit(1);
    if (activeSameSession) throw new Error("This resource is already actively allocated to the session");

    const concurrent = await tx
      .select({ quantity: trainingResourceAllocations.quantity, referenceNumber: trainingSessions.referenceNumber })
      .from(trainingResourceAllocations)
      .innerJoin(trainingSessions, eq(trainingSessions.id, trainingResourceAllocations.sessionId))
      .where(and(
        eq(trainingResourceAllocations.resourceId, resource.id),
        inArray(trainingResourceAllocations.status, [...ACTIVE_ALLOCATION_STATUSES]),
        inArray(trainingSessions.status, [...ACTIVE_SESSION_STATUSES]),
        lt(trainingSessions.startAt, session.endAt),
        gt(trainingSessions.endAt, session.startAt),
      ));

    if (!resourceDemandFits({
      isExclusive: resource.isExclusive,
      availableQuantity: resource.availableQuantity,
      requestedQuantity: data.quantity,
      concurrentQuantities: concurrent.map((item) => item.quantity),
    })) {
      const refs = concurrent.map((item) => item.referenceNumber).slice(0, 4).join(", ");
      throw new Error(`Resource demand conflicts with overlapping session allocation${refs ? `: ${refs}` : ""}`);
    }

    const [allocation] = await tx.insert(trainingResourceAllocations).values({
      id: newId(),
      resourceId: resource.id,
      sessionId: session.id,
      quantity: data.quantity,
      status: "reserved",
      notes: data.notes || null,
      allocatedBy: actor.id,
      allocatedAt,
      updatedAt: allocatedAt,
    }).returning();
    return { resource, session, allocation, resourceState };
  });

  await logAudit({
    userId: actor.id,
    userName: actor.name,
    action: "create",
    entityType: "training_resource_allocation",
    entityId: result.allocation?.id || null,
    entityLabel: `${result.resource.resourceCode} → ${result.session.referenceNumber}`,
    summary: `Reserved ${result.allocation?.quantity || data.quantity} × ${result.resource.name} for ${result.session.referenceNumber}`,
    after: result.allocation,
  });
  refreshLogisticsPaths();
}

export async function updateTrainingResourceAllocationStatus(formData: FormData) {
  const actor = await requireTrainingManager();
  const parsed = trainingResourceAllocationStatusSchema.safeParse({
    allocationId: field(formData, "allocationId"),
    status: field(formData, "status"),
    note: field(formData, "note"),
  });
  if (!parsed.success) throw new Error(trainingLogisticsValidationMessage(parsed.error));
  const data = parsed.data;
  const updatedAt = new Date();

  const result = await db.transaction(async (tx) => {
    const [before] = await tx.select().from(trainingResourceAllocations).where(eq(trainingResourceAllocations.id, data.allocationId)).limit(1);
    if (!before) throw new Error("Training resource allocation not found");
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`training-resource-allocation:${before.resourceId}`}))`);
    if (!canTransitionTrainingResourceAllocation(before.status, data.status)) {
      throw new Error(`Resource allocation cannot move from ${before.status} to ${data.status}`);
    }

    if (data.status === "confirmed") {
      const [resource] = await tx.select().from(trainingResources).where(eq(trainingResources.id, before.resourceId)).limit(1);
      const [session] = await tx.select().from(trainingSessions).where(eq(trainingSessions.id, before.sessionId)).limit(1);
      if (!resource || !session) throw new Error("Resource or training session is unavailable");
      const state = trainingResourceOperationalState(resource, updatedAt);
      if (!["ready", "attention"].includes(state)) throw new Error(`Resource cannot be confirmed while ${state}`);
      if (!["scheduled", "in_progress"].includes(session.status)) throw new Error(`Allocation cannot be confirmed for a ${session.status} session`);
    }

    const [after] = await tx
      .update(trainingResourceAllocations)
      .set({ status: data.status, notes: data.note || before.notes, updatedAt })
      .where(eq(trainingResourceAllocations.id, before.id))
      .returning();
    return { before, after };
  });

  await logAudit({
    userId: actor.id,
    userName: actor.name,
    action: "update",
    entityType: "training_resource_allocation",
    entityId: result.after?.id || data.allocationId,
    entityLabel: data.allocationId,
    summary: `Changed Driver Training resource allocation from ${result.before.status} to ${data.status}${data.note ? `: ${data.note}` : ""}`,
    before: result.before,
    after: result.after,
  });
  refreshLogisticsPaths();
}
