"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  trainingCertificates,
  trainingComplianceCases,
  trainingComplianceEvents,
  trainingParticipants,
  trainingSessions,
} from "@/db/training-schema";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { DRIVER_TRAINING_SERVICES } from "@/lib/driver-training";
import { canManageTrainingCompliance } from "@/lib/training-access";
import {
  buildTrainingComplianceReminder,
  canTransitionTrainingComplianceCase,
  deriveTrainingCompliancePriority,
  trainingComplianceCaseSchema,
  trainingComplianceContactSchema,
  trainingComplianceReminderSchema,
  trainingComplianceStatusSchema,
  trainingValidationMessage,
} from "@/lib/training-policy";
import { newId } from "@/lib/utils";

const ACTIVE_CASE_STATUSES = ["open", "contacted", "scheduled"] as const;
const PRIORITY_RANK: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function refreshCompliancePaths(participantId?: string) {
  revalidatePath("/driver-training");
  revalidatePath("/driver-training/compliance");
  revalidatePath("/driver-training/participants");
  revalidatePath("/driver-training/certificates");
  if (participantId) revalidatePath(`/driver-training/participants/${participantId}`);
}

async function requireComplianceManager() {
  const user = await getCurrentUser();
  if (!canManageTrainingCompliance(user)) {
    throw new Error("You do not have permission to manage Driver Training compliance records");
  }
  return user;
}

export async function openTrainingComplianceCase(formData: FormData) {
  const user = await requireComplianceManager();
  const parsed = trainingComplianceCaseSchema.safeParse({
    participantId: field(formData, "participantId"),
    certificateId: field(formData, "certificateId"),
    caseType: field(formData, "caseType"),
    priority: field(formData, "priority") || "medium",
    dueDate: field(formData, "dueDate"),
    assignedTo: field(formData, "assignedTo"),
    preferredChannel: field(formData, "preferredChannel"),
    notes: field(formData, "notes"),
  });
  if (!parsed.success) throw new Error(trainingValidationMessage(parsed.error));
  const data = parsed.data;

  const [participant] = await db
    .select()
    .from(trainingParticipants)
    .where(eq(trainingParticipants.id, data.participantId))
    .limit(1);
  if (!participant) throw new Error("Training participant not found");

  let certificate: typeof trainingCertificates.$inferSelect | null = null;
  if (data.certificateId) {
    const [row] = await db
      .select()
      .from(trainingCertificates)
      .where(eq(trainingCertificates.id, data.certificateId))
      .limit(1);
    if (!row || row.participantId !== participant.id) {
      throw new Error("Selected certificate does not belong to this participant");
    }
    certificate = row;
  }
  if (data.caseType === "renewal" && !certificate) {
    throw new Error("Renewal cases must reference a training certificate");
  }

  if (data.assignedTo) {
    const [assignee] = await db
      .select({ id: users.id, isActive: users.isActive })
      .from(users)
      .where(eq(users.id, data.assignedTo))
      .limit(1);
    if (!assignee?.isActive) throw new Error("Selected compliance assignee is unavailable");
  }

  const derivedDueDate = data.caseType === "renewal" && certificate?.expiryDate
    ? certificate.expiryDate
    : data.caseType === "licence_expiry" && participant.driverLicenseExpiry
      ? participant.driverLicenseExpiry
      : data.dueDate || null;
  const derivedPriority = deriveTrainingCompliancePriority(data.caseType, derivedDueDate, participant.riskLevel);
  const priority = PRIORITY_RANK[data.priority] > PRIORITY_RANK[derivedPriority] ? data.priority : derivedPriority;
  const id = newId();

  const result = await db.transaction(async (tx) => {
    const lockKey = `${participant.id}:${data.caseType}:${certificate?.id || "none"}`;
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKey}))`);

    const certificateCondition = certificate
      ? eq(trainingComplianceCases.certificateId, certificate.id)
      : isNull(trainingComplianceCases.certificateId);
    const [existing] = await tx
      .select({ id: trainingComplianceCases.id })
      .from(trainingComplianceCases)
      .where(and(
        eq(trainingComplianceCases.participantId, participant.id),
        eq(trainingComplianceCases.caseType, data.caseType),
        certificateCondition,
        inArray(trainingComplianceCases.status, [...ACTIVE_CASE_STATUSES]),
      ))
      .limit(1);
    if (existing) return { ok: false as const, error: "An unresolved compliance case already exists for this item" };

    const values = {
      id,
      participantId: participant.id,
      certificateId: certificate?.id || null,
      caseType: data.caseType,
      status: "open",
      priority,
      dueDate: derivedDueDate,
      assignedTo: data.assignedTo || user.id,
      preferredChannel: data.preferredChannel || null,
      notes: data.notes || null,
      createdBy: user.id,
      updatedAt: new Date(),
    } as const;
    await tx.insert(trainingComplianceCases).values(values);
    await tx.insert(trainingComplianceEvents).values({
      id: newId(),
      caseId: id,
      eventType: "case_opened",
      channel: data.preferredChannel || null,
      summary: `Opened ${data.caseType.replaceAll("_", " ")} compliance case`,
      createdBy: user.id,
    });
    return { ok: true as const, values };
  });

  if (!result.ok) throw new Error(result.error);
  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "create",
    entityType: "training_compliance_case",
    entityId: id,
    entityLabel: participant.fullName,
    summary: `Opened ${data.caseType.replaceAll("_", " ")} case for ${participant.fullName}`,
    after: result.values,
  });

  refreshCompliancePaths(participant.id);
}

export async function prepareTrainingComplianceReminder(formData: FormData) {
  const user = await requireComplianceManager();
  const parsed = trainingComplianceReminderSchema.safeParse({
    caseId: field(formData, "caseId"),
    channel: field(formData, "channel"),
  });
  if (!parsed.success) throw new Error(trainingValidationMessage(parsed.error));
  const data = parsed.data;

  const [row] = await db
    .select({
      caseId: trainingComplianceCases.id,
      caseType: trainingComplianceCases.caseType,
      caseStatus: trainingComplianceCases.status,
      dueDate: trainingComplianceCases.dueDate,
      participantId: trainingParticipants.id,
      participantName: trainingParticipants.fullName,
      serviceId: trainingSessions.serviceId,
      certificateNumber: trainingCertificates.certificateNumber,
    })
    .from(trainingComplianceCases)
    .innerJoin(trainingParticipants, eq(trainingParticipants.id, trainingComplianceCases.participantId))
    .innerJoin(trainingSessions, eq(trainingSessions.id, trainingParticipants.sessionId))
    .leftJoin(trainingCertificates, eq(trainingCertificates.id, trainingComplianceCases.certificateId))
    .where(eq(trainingComplianceCases.id, data.caseId))
    .limit(1);
  if (!row) throw new Error("Training compliance case not found");
  if (!ACTIVE_CASE_STATUSES.includes(row.caseStatus as (typeof ACTIVE_CASE_STATUSES)[number])) {
    throw new Error("Reminders can only be prepared for unresolved compliance cases");
  }

  const serviceTitle = DRIVER_TRAINING_SERVICES.find((service) => service.id === row.serviceId)?.title || row.serviceId;
  const message = buildTrainingComplianceReminder({
    participantName: row.participantName,
    caseType: row.caseType,
    serviceTitle,
    certificateNumber: row.certificateNumber,
    dueDate: row.dueDate,
  });

  await db.transaction(async (tx) => {
    await tx.insert(trainingComplianceEvents).values({
      id: newId(),
      caseId: row.caseId,
      eventType: "reminder_prepared",
      channel: data.channel,
      summary: message,
      createdBy: user.id,
    });
    await tx
      .update(trainingComplianceCases)
      .set({ preferredChannel: data.channel, updatedAt: new Date() })
      .where(eq(trainingComplianceCases.id, row.caseId));
  });

  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "update",
    entityType: "training_compliance_case",
    entityId: row.caseId,
    entityLabel: row.participantName,
    summary: `Prepared ${data.channel} compliance reminder; no external message sent`,
    after: { channel: data.channel, reminderPrepared: true },
  });
  refreshCompliancePaths(row.participantId);
}

export async function recordTrainingComplianceContact(formData: FormData) {
  const user = await requireComplianceManager();
  const parsed = trainingComplianceContactSchema.safeParse({
    caseId: field(formData, "caseId"),
    channel: field(formData, "channel"),
    summary: field(formData, "summary"),
    nextFollowUpDate: field(formData, "nextFollowUpDate"),
  });
  if (!parsed.success) throw new Error(trainingValidationMessage(parsed.error));
  const data = parsed.data;

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${data.caseId}))`);
    const [before] = await tx
      .select()
      .from(trainingComplianceCases)
      .where(eq(trainingComplianceCases.id, data.caseId))
      .limit(1);
    if (!before) return { ok: false as const, error: "Training compliance case not found" };
    if (!ACTIVE_CASE_STATUSES.includes(before.status as (typeof ACTIVE_CASE_STATUSES)[number])) {
      return { ok: false as const, error: "Closed compliance cases cannot receive new contact records" };
    }

    const contactedAt = new Date();
    await tx
      .update(trainingComplianceCases)
      .set({
        status: "contacted",
        preferredChannel: data.channel,
        contactCount: sql<number>`${trainingComplianceCases.contactCount} + 1`,
        lastContactedAt: contactedAt,
        nextFollowUpDate: data.nextFollowUpDate || null,
        updatedAt: contactedAt,
      })
      .where(eq(trainingComplianceCases.id, before.id));
    await tx.insert(trainingComplianceEvents).values({
      id: newId(),
      caseId: before.id,
      eventType: "contact_recorded",
      channel: data.channel,
      summary: data.summary,
      createdBy: user.id,
    });
    return { ok: true as const, before, contactedAt };
  });

  if (!result.ok) throw new Error(result.error);
  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "update",
    entityType: "training_compliance_case",
    entityId: result.before.id,
    summary: `Recorded ${data.channel} compliance contact`,
    before: { status: result.before.status, contactCount: result.before.contactCount },
    after: { status: "contacted", channel: data.channel, nextFollowUpDate: data.nextFollowUpDate || null },
  });
  refreshCompliancePaths(result.before.participantId);
}

export async function updateTrainingComplianceStatus(formData: FormData) {
  const user = await requireComplianceManager();
  const parsed = trainingComplianceStatusSchema.safeParse({
    caseId: field(formData, "caseId"),
    status: field(formData, "status"),
    notes: field(formData, "notes"),
  });
  if (!parsed.success) throw new Error(trainingValidationMessage(parsed.error));
  const data = parsed.data;

  const [before] = await db
    .select()
    .from(trainingComplianceCases)
    .where(eq(trainingComplianceCases.id, data.caseId))
    .limit(1);
  if (!before) throw new Error("Training compliance case not found");
  if (!canTransitionTrainingComplianceCase(before.status, data.status)) {
    throw new Error(`Compliance case cannot move from ${before.status} to ${data.status}`);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(trainingComplianceCases)
      .set({ status: data.status, notes: data.notes || before.notes, updatedAt: new Date() })
      .where(eq(trainingComplianceCases.id, before.id));
    await tx.insert(trainingComplianceEvents).values({
      id: newId(),
      caseId: before.id,
      eventType: "status_changed",
      summary: data.notes ? `Status changed to ${data.status}: ${data.notes}` : `Status changed to ${data.status}`,
      createdBy: user.id,
    });
  });

  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "update",
    entityType: "training_compliance_case",
    entityId: before.id,
    summary: `Changed training compliance case status to ${data.status}`,
    before: { status: before.status },
    after: { status: data.status, notes: data.notes || null },
  });
  refreshCompliancePaths(before.participantId);
}
