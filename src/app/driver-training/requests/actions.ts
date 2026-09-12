"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { locations, users } from "@/db/schema";
import { trainingQuotations } from "@/db/training-commercial-schema";
import { trainingSessions } from "@/db/training-schema";
import { trainingRequestEvents, trainingRequests } from "@/db/training-request-schema";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { canManageTraining } from "@/lib/training-access";
import {
  canTransitionTrainingRequest,
  requestSchedulingCapacityIsValid,
  trainingRequestCreateSchema,
  trainingRequestNeedsReviewAttribution,
  trainingRequestScheduleSchema,
  trainingRequestTransitionSchema,
  trainingRequestValidationMessage,
} from "@/lib/training-request-policy";
import { newId } from "@/lib/utils";

const COMMERCIAL_AUTHORIZATION_MESSAGE = "Client training request requires an accepted, valid quotation before scheduling";

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function refreshRequestPaths() {
  revalidatePath("/driver-training");
  revalidatePath("/driver-training/requests");
  revalidatePath("/driver-training/sessions");
}

function commercialWorkspacePath(requestId: string) {
  const params = new URLSearchParams({ requestId, notice: "quotation-required" });
  return `/driver-training/commercials?${params.toString()}`;
}

function isCommercialAuthorizationError(error: unknown) {
  const queue: unknown[] = [error];
  const visited = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    if (current instanceof Error) {
      if (current.message.includes(COMMERCIAL_AUTHORIZATION_MESSAGE)) return true;
      const cause = (current as Error & { cause?: unknown }).cause;
      if (cause) queue.push(cause);
      continue;
    }

    if (typeof current === "object") {
      const record = current as { message?: unknown; cause?: unknown };
      if (typeof record.message === "string" && record.message.includes(COMMERCIAL_AUTHORIZATION_MESSAGE)) return true;
      if (record.cause) queue.push(record.cause);
    }
  }

  return false;
}

async function requireTrainingManager() {
  const user = await getCurrentUser();
  if (!canManageTraining(user)) {
    throw new Error("You do not have permission to manage Driver Training & Assessment records");
  }
  return user;
}

export async function createTrainingRequest(formData: FormData) {
  const user = await requireTrainingManager();
  const parsed = trainingRequestCreateSchema.safeParse({
    requestType: field(formData, "requestType"),
    serviceId: field(formData, "serviceId"),
    title: field(formData, "title"),
    clientName: field(formData, "clientName"),
    contactName: field(formData, "contactName"),
    contactEmail: field(formData, "contactEmail"),
    contactPhone: field(formData, "contactPhone"),
    requestedParticipants: field(formData, "requestedParticipants") || "1",
    preferredStartDate: field(formData, "preferredStartDate"),
    preferredEndDate: field(formData, "preferredEndDate"),
    locationId: field(formData, "locationId"),
    venue: field(formData, "venue"),
    deliveryMode: field(formData, "deliveryMode"),
    priority: field(formData, "priority") || "normal",
    businessNeed: field(formData, "businessNeed"),
    notes: field(formData, "notes"),
  });
  if (!parsed.success) throw new Error(trainingRequestValidationMessage(parsed.error));
  const data = parsed.data;

  if (data.locationId) {
    const [location] = await db.select({ id: locations.id }).from(locations).where(eq(locations.id, data.locationId)).limit(1);
    if (!location) throw new Error("Selected training location does not exist");
  }

  const id = newId();
  const requestNumber = `TRQ-${new Date().getUTCFullYear()}-${id.slice(0, 8).toUpperCase()}`;
  const values = {
    id,
    requestNumber,
    requestType: data.requestType,
    serviceId: data.serviceId,
    title: data.title,
    clientName: data.clientName || null,
    contactName: data.contactName || null,
    contactEmail: data.contactEmail?.toLowerCase() || null,
    contactPhone: data.contactPhone || null,
    requestedParticipants: data.requestedParticipants,
    preferredStartDate: data.preferredStartDate || null,
    preferredEndDate: data.preferredEndDate || null,
    locationId: data.locationId || null,
    venue: data.venue || null,
    deliveryMode: data.deliveryMode,
    priority: data.priority,
    status: "draft",
    businessNeed: data.businessNeed || null,
    notes: data.notes || null,
    requestedBy: user.id,
    updatedAt: new Date(),
  } as const;

  await db.transaction(async (tx) => {
    await tx.insert(trainingRequests).values(values);
    await tx.insert(trainingRequestEvents).values({
      id: newId(),
      requestId: id,
      eventType: "created",
      fromStatus: null,
      toStatus: "draft",
      summary: `Training request ${requestNumber} created`,
      createdBy: user.id,
    });
  });

  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "create",
    entityType: "training_request",
    entityId: id,
    entityLabel: requestNumber,
    summary: `Created training request ${requestNumber}`,
    after: values,
  });
  refreshRequestPaths();
}

export async function transitionTrainingRequest(formData: FormData) {
  const user = await requireTrainingManager();
  const parsed = trainingRequestTransitionSchema.safeParse({
    requestId: field(formData, "requestId"),
    status: field(formData, "status"),
    reviewNotes: field(formData, "reviewNotes"),
  });
  if (!parsed.success) throw new Error(trainingRequestValidationMessage(parsed.error));
  const data = parsed.data;
  if (data.status === "rejected" && !data.reviewNotes) {
    throw new Error("Rejected training requests require review notes");
  }

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${data.requestId}))`);
    const [before] = await tx.select().from(trainingRequests).where(eq(trainingRequests.id, data.requestId)).limit(1);
    if (!before) return { ok: false as const, error: "Training request not found" };
    if (!canTransitionTrainingRequest(before.status, data.status)) {
      return { ok: false as const, error: `Training request cannot move from ${before.status} to ${data.status}` };
    }

    const now = new Date();
    const reviewRequired = trainingRequestNeedsReviewAttribution(data.status);
    const patch = {
      status: data.status,
      submittedAt: data.status === "submitted" ? (before.submittedAt || now) : before.submittedAt,
      reviewedBy: reviewRequired ? user.id : before.reviewedBy,
      reviewedAt: reviewRequired ? now : before.reviewedAt,
      reviewNotes: data.reviewNotes || before.reviewNotes,
      updatedAt: now,
    } as const;

    await tx.update(trainingRequests).set(patch).where(eq(trainingRequests.id, before.id));
    const eventType = data.status === "submitted"
      ? "submitted"
      : data.status === "under_review"
        ? "review_started"
        : data.status;
    await tx.insert(trainingRequestEvents).values({
      id: newId(),
      requestId: before.id,
      eventType,
      fromStatus: before.status,
      toStatus: data.status,
      summary: `Training request moved from ${before.status} to ${data.status}`,
      createdBy: user.id,
    });
    return { ok: true as const, before, patch };
  });

  if (!result.ok) throw new Error(result.error);
  await logAudit({
    userId: user.id,
    userName: user.name,
    action: data.status === "approved" ? "approve" : data.status === "rejected" ? "reject" : "update",
    entityType: "training_request",
    entityId: result.before.id,
    entityLabel: result.before.requestNumber,
    summary: `Changed training request status to ${data.status}`,
    before: { status: result.before.status },
    after: { status: data.status, reviewNotes: data.reviewNotes || null },
  });
  refreshRequestPaths();
}

export async function scheduleApprovedTrainingRequest(formData: FormData) {
  const user = await requireTrainingManager();
  const parsed = trainingRequestScheduleSchema.safeParse({
    requestId: field(formData, "requestId"),
    startAt: field(formData, "startAt"),
    endAt: field(formData, "endAt"),
    instructorId: field(formData, "instructorId"),
    instructorName: field(formData, "instructorName"),
    capacity: field(formData, "capacity"),
    venue: field(formData, "venue"),
    locationId: field(formData, "locationId"),
    notes: field(formData, "notes"),
  });
  if (!parsed.success) throw new Error(trainingRequestValidationMessage(parsed.error));
  const data = parsed.data;

  const sessionId = newId();
  const referenceNumber = `TRN-${new Date().getUTCFullYear()}-${sessionId.slice(0, 8).toUpperCase()}`;

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${data.requestId}))`);
    const [request] = await tx.select().from(trainingRequests).where(eq(trainingRequests.id, data.requestId)).limit(1);
    if (!request) return { ok: false as const, error: "Training request not found" };
    if (request.status !== "approved") return { ok: false as const, error: "Only approved training requests can be scheduled" };
    if (request.scheduledSessionId) return { ok: false as const, error: "This training request already has a scheduled session" };

    if (request.requestType === "client") {
      const today = new Date().toISOString().slice(0, 10);
      const [acceptedQuotation] = await tx
        .select({ id: trainingQuotations.id })
        .from(trainingQuotations)
        .where(and(
          eq(trainingQuotations.requestId, request.id),
          eq(trainingQuotations.status, "accepted"),
          gte(trainingQuotations.validUntil, today),
        ))
        .limit(1);
      if (!acceptedQuotation) {
        return {
          ok: false as const,
          error: COMMERCIAL_AUTHORIZATION_MESSAGE,
          redirectToCommercials: true as const,
        };
      }
    }

    if (!requestSchedulingCapacityIsValid(request.requestedParticipants, data.capacity)) {
      return { ok: false as const, error: "Session capacity cannot be below the requested participant count" };
    }

    const locationId = data.locationId || request.locationId;
    if (locationId) {
      const [location] = await tx.select({ id: locations.id }).from(locations).where(eq(locations.id, locationId)).limit(1);
      if (!location) return { ok: false as const, error: "Selected training location does not exist" };
    }
    if (data.instructorId) {
      const [instructor] = await tx.select({ id: users.id, isActive: users.isActive }).from(users).where(eq(users.id, data.instructorId)).limit(1);
      if (!instructor?.isActive) return { ok: false as const, error: "Selected instructor is unavailable" };
    }

    const sessionValues = {
      id: sessionId,
      referenceNumber,
      serviceId: request.serviceId,
      title: request.title,
      clientName: request.clientName,
      transporterId: null,
      locationId: locationId || null,
      venue: data.venue || request.venue,
      deliveryMode: request.deliveryMode,
      startAt: data.startAt,
      endAt: data.endAt,
      instructorId: data.instructorId || null,
      instructorName: data.instructorName || null,
      capacity: data.capacity,
      status: "scheduled",
      notes: data.notes || request.notes,
      createdBy: user.id,
      updatedAt: new Date(),
    } as const;

    await tx.insert(trainingSessions).values(sessionValues);
    await tx.update(trainingRequests).set({
      status: "scheduled",
      scheduledSessionId: sessionId,
      updatedAt: new Date(),
    }).where(eq(trainingRequests.id, request.id));
    await tx.insert(trainingRequestEvents).values({
      id: newId(),
      requestId: request.id,
      eventType: "scheduled",
      fromStatus: "approved",
      toStatus: "scheduled",
      summary: `Converted approved request to training session ${referenceNumber}`,
      createdBy: user.id,
    });
    return { ok: true as const, request, sessionValues };
  }).catch((error: unknown) => {
    if (isCommercialAuthorizationError(error)) {
      return {
        ok: false as const,
        error: COMMERCIAL_AUTHORIZATION_MESSAGE,
        redirectToCommercials: true as const,
      };
    }
    throw error;
  });

  if (!result.ok) {
    if ("redirectToCommercials" in result && result.redirectToCommercials) {
      redirect(commercialWorkspacePath(data.requestId));
    }
    throw new Error(result.error);
  }

  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "create",
    entityType: "training_session",
    entityId: sessionId,
    entityLabel: referenceNumber,
    summary: `Scheduled ${referenceNumber} from approved training request ${result.request.requestNumber}`,
    after: result.sessionValues,
  });
  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "update",
    entityType: "training_request",
    entityId: result.request.id,
    entityLabel: result.request.requestNumber,
    summary: `Converted approved training request to ${referenceNumber}`,
    before: { status: result.request.status, scheduledSessionId: result.request.scheduledSessionId },
    after: { status: "scheduled", scheduledSessionId: sessionId },
  });
  refreshRequestPaths();
}
