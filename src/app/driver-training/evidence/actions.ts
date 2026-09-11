"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { trainingParticipants, trainingSessions } from "@/db/training-schema";
import { trainingAttendanceSignoffs, trainingEvidenceRecords } from "@/db/training-evidence-schema";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { canManageTraining } from "@/lib/training-access";
import {
  calculateAttendanceMinutes,
  trainingAttendanceActionSchema,
  trainingAttendanceConfirmationSchema,
  trainingAttendanceDisputeSchema,
  trainingEvidenceRecordSchema,
  trainingEvidenceValidationMessage,
  trainingEvidenceVerificationSchema,
} from "@/lib/training-evidence-policy";
import { newId } from "@/lib/utils";

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function checked(formData: FormData, name: string) {
  return formData.has(name);
}

function refreshEvidencePaths(participantId?: string) {
  revalidatePath("/driver-training");
  revalidatePath("/driver-training/evidence");
  revalidatePath("/driver-training/participants");
  revalidatePath("/driver-training/sessions");
  if (participantId) revalidatePath(`/driver-training/participants/${participantId}`);
}

async function requireTrainingManager() {
  const user = await getCurrentUser();
  if (!canManageTraining(user)) {
    throw new Error("You do not have permission to manage Driver Training attendance or evidence records");
  }
  return user;
}

async function participantContext(participantId: string) {
  const [row] = await db
    .select({
      participantId: trainingParticipants.id,
      sessionId: trainingParticipants.sessionId,
      fullName: trainingParticipants.fullName,
      attendanceStatus: trainingParticipants.attendanceStatus,
      sessionStatus: trainingSessions.status,
      referenceNumber: trainingSessions.referenceNumber,
    })
    .from(trainingParticipants)
    .innerJoin(trainingSessions, eq(trainingSessions.id, trainingParticipants.sessionId))
    .where(eq(trainingParticipants.id, participantId))
    .limit(1);
  if (!row) throw new Error("Training participant not found");
  return row;
}

export async function checkInTrainingParticipant(formData: FormData) {
  const actor = await requireTrainingManager();
  const parsed = trainingAttendanceActionSchema.safeParse({ participantId: field(formData, "participantId") });
  if (!parsed.success) throw new Error(trainingEvidenceValidationMessage(parsed.error));
  const context = await participantContext(parsed.data.participantId);
  if (context.attendanceStatus === "withdrawn") throw new Error("Withdrawn participants cannot be checked in");
  if (!["scheduled", "in_progress"].includes(context.sessionStatus)) {
    throw new Error("Check-in is only available for scheduled or in-progress training sessions");
  }

  const checkInAt = new Date();
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`training-attendance:${context.participantId}`}))`);
    const [before] = await tx
      .select()
      .from(trainingAttendanceSignoffs)
      .where(and(
        eq(trainingAttendanceSignoffs.participantId, context.participantId),
        eq(trainingAttendanceSignoffs.sessionId, context.sessionId),
      ))
      .limit(1);
    if (before?.status === "confirmed") throw new Error("Attendance has already been confirmed");
    if (before?.checkInAt) throw new Error("Participant is already checked in");

    if (before) {
      const [after] = await tx
        .update(trainingAttendanceSignoffs)
        .set({ checkInAt, checkOutAt: null, attendanceMinutes: 0, status: "open", updatedAt: checkInAt })
        .where(eq(trainingAttendanceSignoffs.id, before.id))
        .returning();
      return { action: "update" as const, before, after };
    }

    const [after] = await tx
      .insert(trainingAttendanceSignoffs)
      .values({
        id: newId(),
        participantId: context.participantId,
        sessionId: context.sessionId,
        checkInAt,
        createdBy: actor.id,
        updatedAt: checkInAt,
      })
      .returning();
    return { action: "create" as const, before: null, after };
  });

  await logAudit({
    userId: actor.id,
    userName: actor.name,
    action: result.action,
    entityType: "training_attendance_signoff",
    entityId: result.after?.id || null,
    entityLabel: `${context.fullName} · ${context.referenceNumber}`,
    summary: `Checked in ${context.fullName} for Driver Training session ${context.referenceNumber}`,
    before: result.before,
    after: result.after,
  });
  refreshEvidencePaths(context.participantId);
}

export async function checkOutTrainingParticipant(formData: FormData) {
  const actor = await requireTrainingManager();
  const parsed = trainingAttendanceActionSchema.safeParse({ participantId: field(formData, "participantId") });
  if (!parsed.success) throw new Error(trainingEvidenceValidationMessage(parsed.error));
  const context = await participantContext(parsed.data.participantId);
  if (!["in_progress", "completed"].includes(context.sessionStatus)) {
    throw new Error("Check-out is only available for in-progress or completed training sessions");
  }

  const checkOutAt = new Date();
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`training-attendance:${context.participantId}`}))`);
    const [before] = await tx
      .select()
      .from(trainingAttendanceSignoffs)
      .where(and(
        eq(trainingAttendanceSignoffs.participantId, context.participantId),
        eq(trainingAttendanceSignoffs.sessionId, context.sessionId),
      ))
      .limit(1);
    if (!before?.checkInAt) throw new Error("Check the participant in before recording check-out");
    if (before.status === "confirmed") throw new Error("Confirmed attendance cannot be checked out again");
    if (before.status === "void") throw new Error("Void attendance records cannot be checked out");
    if (before.checkOutAt) throw new Error("Participant has already been checked out");
    const attendanceMinutes = calculateAttendanceMinutes(before.checkInAt, checkOutAt);
    if (attendanceMinutes <= 0) throw new Error("Attendance duration is invalid");

    const [after] = await tx
      .update(trainingAttendanceSignoffs)
      .set({ checkOutAt, attendanceMinutes, status: "open", updatedAt: checkOutAt })
      .where(eq(trainingAttendanceSignoffs.id, before.id))
      .returning();
    return { before, after };
  });

  await logAudit({
    userId: actor.id,
    userName: actor.name,
    action: "update",
    entityType: "training_attendance_signoff",
    entityId: result.after?.id || null,
    entityLabel: `${context.fullName} · ${context.referenceNumber}`,
    summary: `Checked out ${context.fullName} after ${result.after?.attendanceMinutes || 0} training minutes`,
    before: result.before,
    after: result.after,
  });
  refreshEvidencePaths(context.participantId);
}

export async function confirmTrainingAttendance(formData: FormData) {
  const actor = await requireTrainingManager();
  const parsed = trainingAttendanceConfirmationSchema.safeParse({
    participantId: field(formData, "participantId"),
    participantAcknowledged: checked(formData, "participantAcknowledged"),
    instructorConfirmed: checked(formData, "instructorConfirmed"),
    notes: field(formData, "notes"),
  });
  if (!parsed.success) throw new Error(trainingEvidenceValidationMessage(parsed.error));
  const context = await participantContext(parsed.data.participantId);
  if (!["in_progress", "completed"].includes(context.sessionStatus)) {
    throw new Error("Attendance confirmation is only available for in-progress or completed sessions");
  }

  const confirmedAt = new Date();
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`training-attendance:${context.participantId}`}))`);
    const [before] = await tx
      .select()
      .from(trainingAttendanceSignoffs)
      .where(and(
        eq(trainingAttendanceSignoffs.participantId, context.participantId),
        eq(trainingAttendanceSignoffs.sessionId, context.sessionId),
      ))
      .limit(1);
    if (!before?.checkInAt || !before.checkOutAt) {
      throw new Error("Check-in and check-out must both be recorded before attendance confirmation");
    }
    if (["disputed", "void"].includes(before.status)) {
      throw new Error(`Attendance cannot be confirmed while the record is ${before.status}`);
    }
    const attendanceMinutes = calculateAttendanceMinutes(before.checkInAt, before.checkOutAt);
    if (attendanceMinutes <= 0) throw new Error("Attendance duration is invalid");

    const [after] = await tx
      .update(trainingAttendanceSignoffs)
      .set({
        attendanceMinutes,
        status: "confirmed",
        participantAcknowledged: true,
        instructorConfirmed: true,
        confirmedBy: actor.id,
        confirmedAt,
        notes: parsed.data.notes || null,
        updatedAt: confirmedAt,
      })
      .where(eq(trainingAttendanceSignoffs.id, before.id))
      .returning();

    await tx
      .update(trainingParticipants)
      .set({ attendanceStatus: "attended", updatedAt: confirmedAt })
      .where(eq(trainingParticipants.id, context.participantId));
    return { before, after };
  });

  await logAudit({
    userId: actor.id,
    userName: actor.name,
    action: "update",
    entityType: "training_attendance_signoff",
    entityId: result.after?.id || null,
    entityLabel: `${context.fullName} · ${context.referenceNumber}`,
    summary: `Confirmed auditable attendance for ${context.fullName} (${result.after?.attendanceMinutes || 0} minutes)`,
    before: result.before,
    after: result.after,
  });
  refreshEvidencePaths(context.participantId);
}

export async function disputeTrainingAttendance(formData: FormData) {
  const actor = await requireTrainingManager();
  const parsed = trainingAttendanceDisputeSchema.safeParse({
    participantId: field(formData, "participantId"),
    reason: field(formData, "reason"),
  });
  if (!parsed.success) throw new Error(trainingEvidenceValidationMessage(parsed.error));
  const context = await participantContext(parsed.data.participantId);
  const disputedAt = new Date();

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`training-attendance:${context.participantId}`}))`);
    const [before] = await tx
      .select()
      .from(trainingAttendanceSignoffs)
      .where(and(
        eq(trainingAttendanceSignoffs.participantId, context.participantId),
        eq(trainingAttendanceSignoffs.sessionId, context.sessionId),
      ))
      .limit(1);
    if (!before) throw new Error("Attendance record not found");
    if (before.status === "void") throw new Error("Void attendance records cannot be disputed");

    const [after] = await tx
      .update(trainingAttendanceSignoffs)
      .set({
        status: "disputed",
        confirmedBy: null,
        confirmedAt: null,
        notes: parsed.data.reason,
        updatedAt: disputedAt,
      })
      .where(eq(trainingAttendanceSignoffs.id, before.id))
      .returning();

    if (before.status === "confirmed") {
      await tx
        .update(trainingParticipants)
        .set({ attendanceStatus: "registered", updatedAt: disputedAt })
        .where(eq(trainingParticipants.id, context.participantId));
    }
    return { before, after };
  });

  await logAudit({
    userId: actor.id,
    userName: actor.name,
    action: "update",
    entityType: "training_attendance_signoff",
    entityId: result.after?.id || null,
    entityLabel: `${context.fullName} · ${context.referenceNumber}`,
    summary: `Marked training attendance as disputed for ${context.fullName}: ${parsed.data.reason}`,
    before: result.before,
    after: result.after,
  });
  refreshEvidencePaths(context.participantId);
}

export async function addTrainingEvidenceRecord(formData: FormData) {
  const actor = await requireTrainingManager();
  const parsed = trainingEvidenceRecordSchema.safeParse({
    sessionId: field(formData, "sessionId"),
    participantId: field(formData, "participantId"),
    evidenceType: field(formData, "evidenceType"),
    title: field(formData, "title"),
    reference: field(formData, "reference"),
    sha256: field(formData, "sha256"),
    reviewNotes: field(formData, "reviewNotes"),
  });
  if (!parsed.success) throw new Error(trainingEvidenceValidationMessage(parsed.error));
  const data = parsed.data;

  const [session] = await db
    .select({ id: trainingSessions.id, referenceNumber: trainingSessions.referenceNumber, status: trainingSessions.status })
    .from(trainingSessions)
    .where(eq(trainingSessions.id, data.sessionId))
    .limit(1);
  if (!session) throw new Error("Training session not found");

  let participantLabel: string | null = null;
  if (data.participantId) {
    const [participant] = await db
      .select({ id: trainingParticipants.id, sessionId: trainingParticipants.sessionId, fullName: trainingParticipants.fullName })
      .from(trainingParticipants)
      .where(eq(trainingParticipants.id, data.participantId))
      .limit(1);
    if (!participant || participant.sessionId !== data.sessionId) {
      throw new Error("Evidence participant must belong to the selected training session");
    }
    participantLabel = participant.fullName;
  }

  const capturedAt = new Date();
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`training-evidence:${data.sessionId}:${data.participantId || "session"}:${data.reference}`}))`);
    const [duplicate] = await tx
      .select({ id: trainingEvidenceRecords.id })
      .from(trainingEvidenceRecords)
      .where(and(
        eq(trainingEvidenceRecords.sessionId, data.sessionId),
        eq(trainingEvidenceRecords.reference, data.reference),
        data.participantId
          ? eq(trainingEvidenceRecords.participantId, data.participantId)
          : sql`${trainingEvidenceRecords.participantId} is null`,
      ))
      .limit(1);
    if (duplicate) throw new Error("This evidence reference is already registered for the selected scope");

    const [after] = await tx
      .insert(trainingEvidenceRecords)
      .values({
        id: newId(),
        sessionId: data.sessionId,
        participantId: data.participantId || null,
        evidenceType: data.evidenceType,
        title: data.title,
        reference: data.reference,
        sha256: data.sha256 || null,
        status: "pending",
        capturedBy: actor.id,
        capturedAt,
        reviewNotes: data.reviewNotes || null,
        updatedAt: capturedAt,
      })
      .returning();
    return after;
  });

  await logAudit({
    userId: actor.id,
    userName: actor.name,
    action: "create",
    entityType: "training_evidence_record",
    entityId: result?.id || null,
    entityLabel: `${session.referenceNumber} · ${data.title}`,
    summary: `Registered ${data.evidenceType.replaceAll("_", " ")} evidence for ${participantLabel || session.referenceNumber}`,
    before: null,
    after: result,
  });
  refreshEvidencePaths(data.participantId);
}

export async function verifyTrainingEvidenceRecord(formData: FormData) {
  const actor = await requireTrainingManager();
  const parsed = trainingEvidenceVerificationSchema.safeParse({
    evidenceId: field(formData, "evidenceId"),
    status: field(formData, "status"),
    reviewNotes: field(formData, "reviewNotes"),
  });
  if (!parsed.success) throw new Error(trainingEvidenceValidationMessage(parsed.error));
  const reviewedAt = new Date();

  const [before] = await db
    .select()
    .from(trainingEvidenceRecords)
    .where(eq(trainingEvidenceRecords.id, parsed.data.evidenceId))
    .limit(1);
  if (!before) throw new Error("Training evidence record not found");

  const [after] = await db
    .update(trainingEvidenceRecords)
    .set({
      status: parsed.data.status,
      verifiedBy: actor.id,
      verifiedAt: reviewedAt,
      reviewNotes: parsed.data.reviewNotes || null,
      updatedAt: reviewedAt,
    })
    .where(eq(trainingEvidenceRecords.id, before.id))
    .returning();

  await logAudit({
    userId: actor.id,
    userName: actor.name,
    action: "update",
    entityType: "training_evidence_record",
    entityId: after?.id || null,
    entityLabel: before.title,
    summary: `${parsed.data.status === "verified" ? "Verified" : "Rejected"} Driver Training evidence: ${before.title}`,
    before,
    after,
  });
  refreshEvidencePaths(before.participantId || undefined);
}
