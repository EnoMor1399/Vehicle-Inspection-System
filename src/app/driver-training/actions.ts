"use server";

import { revalidatePath } from "next/cache";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { locations, transporters, users } from "@/db/schema";
import {
  trainingAssessments,
  trainingCertificates,
  trainingParticipants,
  trainingSessions,
} from "@/db/training-schema";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { DRIVER_TRAINING_SERVICES } from "@/lib/driver-training";
import { canManageTraining } from "@/lib/training-access";
import {
  calculateOverallScore,
  canTransitionTrainingSession,
  isPassingTrainingResult,
  trainingAssessmentSchema,
  trainingAttendanceSchema,
  trainingCertificateSchema,
  trainingParticipantSchema,
  trainingSessionSchema,
  trainingSessionStatusSchema,
  trainingValidationMessage,
} from "@/lib/training-policy";
import { newId } from "@/lib/utils";

const PASSING_RESULTS = ["pass", "competent"] as const;

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function refreshTrainingPaths() {
  revalidatePath("/driver-training");
  revalidatePath("/driver-training/sessions");
  revalidatePath("/driver-training/participants");
  revalidatePath("/driver-training/certificates");
}

async function requireTrainingManager() {
  const user = await getCurrentUser();
  if (!canManageTraining(user)) {
    throw new Error("You do not have permission to manage Driver Training & Assessment records");
  }
  return user;
}

export async function createTrainingSession(formData: FormData) {
  const user = await requireTrainingManager();
  const parsed = trainingSessionSchema.safeParse({
    serviceId: field(formData, "serviceId"),
    title: field(formData, "title"),
    clientName: field(formData, "clientName"),
    transporterId: field(formData, "transporterId"),
    locationId: field(formData, "locationId"),
    venue: field(formData, "venue"),
    deliveryMode: field(formData, "deliveryMode"),
    startAt: field(formData, "startAt"),
    endAt: field(formData, "endAt"),
    instructorId: field(formData, "instructorId"),
    instructorName: field(formData, "instructorName"),
    capacity: field(formData, "capacity") || "20",
    notes: field(formData, "notes"),
  });
  if (!parsed.success) throw new Error(trainingValidationMessage(parsed.error));
  const data = parsed.data;

  if (data.transporterId) {
    const [transporter] = await db
      .select({ id: transporters.id, deletedAt: transporters.deletedAt })
      .from(transporters)
      .where(eq(transporters.id, data.transporterId))
      .limit(1);
    if (!transporter || transporter.deletedAt) throw new Error("Selected transporter is unavailable");
  }

  if (data.locationId) {
    const [location] = await db.select({ id: locations.id }).from(locations).where(eq(locations.id, data.locationId)).limit(1);
    if (!location) throw new Error("Selected station does not exist");
  }

  if (data.instructorId) {
    const [instructor] = await db
      .select({ id: users.id, isActive: users.isActive })
      .from(users)
      .where(eq(users.id, data.instructorId))
      .limit(1);
    if (!instructor?.isActive) throw new Error("Selected instructor is unavailable");
  }

  const id = newId();
  const referenceNumber = `TRN-${new Date().getUTCFullYear()}-${id.slice(0, 8).toUpperCase()}`;
  const service = DRIVER_TRAINING_SERVICES.find((item) => item.id === data.serviceId);
  const values = {
    id,
    referenceNumber,
    serviceId: data.serviceId,
    title: data.title,
    clientName: data.clientName || null,
    transporterId: data.transporterId || null,
    locationId: data.locationId || null,
    venue: data.venue || null,
    deliveryMode: data.deliveryMode,
    startAt: data.startAt,
    endAt: data.endAt,
    instructorId: data.instructorId || null,
    instructorName: data.instructorName || null,
    capacity: data.capacity,
    notes: data.notes || null,
    status: "scheduled",
    createdBy: user.id,
    updatedAt: new Date(),
  } as const;

  await db.insert(trainingSessions).values(values);
  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "create",
    entityType: "training_session",
    entityId: id,
    entityLabel: referenceNumber,
    summary: `Scheduled ${service?.title || data.title}`,
    after: values,
  });

  refreshTrainingPaths();
}

export async function updateTrainingSessionStatus(formData: FormData) {
  const user = await requireTrainingManager();
  const parsed = trainingSessionStatusSchema.safeParse({
    sessionId: field(formData, "sessionId"),
    status: field(formData, "status"),
  });
  if (!parsed.success) throw new Error(trainingValidationMessage(parsed.error));
  const data = parsed.data;

  const [before] = await db.select().from(trainingSessions).where(eq(trainingSessions.id, data.sessionId)).limit(1);
  if (!before) throw new Error("Training session not found");
  if (!canTransitionTrainingSession(before.status, data.status)) {
    throw new Error(`Training session cannot move from ${before.status} to ${data.status}`);
  }

  await db.update(trainingSessions).set({ status: data.status, updatedAt: new Date() }).where(eq(trainingSessions.id, data.sessionId));
  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "update",
    entityType: "training_session",
    entityId: before.id,
    entityLabel: before.referenceNumber,
    summary: `Changed training session status to ${data.status}`,
    before: { status: before.status },
    after: { status: data.status },
  });

  refreshTrainingPaths();
}

export async function addTrainingParticipant(formData: FormData) {
  const user = await requireTrainingManager();
  const parsed = trainingParticipantSchema.safeParse({
    sessionId: field(formData, "sessionId"),
    fullName: field(formData, "fullName"),
    companyName: field(formData, "companyName"),
    employeeNumber: field(formData, "employeeNumber"),
    phone: field(formData, "phone"),
    email: field(formData, "email"),
    driverLicenseNumber: field(formData, "driverLicenseNumber"),
    driverLicenseClass: field(formData, "driverLicenseClass"),
    driverLicenseExpiry: field(formData, "driverLicenseExpiry"),
    notes: field(formData, "notes"),
  });
  if (!parsed.success) throw new Error(trainingValidationMessage(parsed.error));
  const data = parsed.data;

  const id = newId();
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${data.sessionId}))`);
    const [session] = await tx.select().from(trainingSessions).where(eq(trainingSessions.id, data.sessionId)).limit(1);
    if (!session) return { ok: false as const, error: "Training session not found" };
    if (session.status === "completed" || session.status === "cancelled") {
      return { ok: false as const, error: "Participants cannot be added to a completed or cancelled session" };
    }

    const [capacity] = await tx.select({ n: count() }).from(trainingParticipants).where(eq(trainingParticipants.sessionId, data.sessionId));
    if (Number(capacity?.n || 0) >= session.capacity) {
      return { ok: false as const, error: "Training session has reached its participant capacity" };
    }

    if (data.driverLicenseNumber) {
      const [duplicateLicense] = await tx
        .select({ id: trainingParticipants.id })
        .from(trainingParticipants)
        .where(and(
          eq(trainingParticipants.sessionId, data.sessionId),
          eq(trainingParticipants.driverLicenseNumber, data.driverLicenseNumber),
        ))
        .limit(1);
      if (duplicateLicense) return { ok: false as const, error: "This driver licence is already registered for the session" };
    }

    if (data.email) {
      const [duplicateEmail] = await tx
        .select({ id: trainingParticipants.id })
        .from(trainingParticipants)
        .where(and(eq(trainingParticipants.sessionId, data.sessionId), eq(trainingParticipants.email, data.email.toLowerCase())))
        .limit(1);
      if (duplicateEmail) return { ok: false as const, error: "This email is already registered for the session" };
    }

    const values = {
      id,
      sessionId: data.sessionId,
      fullName: data.fullName,
      companyName: data.companyName || null,
      employeeNumber: data.employeeNumber || null,
      phone: data.phone || null,
      email: data.email?.toLowerCase() || null,
      driverLicenseNumber: data.driverLicenseNumber || null,
      driverLicenseClass: data.driverLicenseClass || null,
      driverLicenseExpiry: data.driverLicenseExpiry || null,
      notes: data.notes || null,
      createdBy: user.id,
      updatedAt: new Date(),
    } as const;
    await tx.insert(trainingParticipants).values(values);
    return { ok: true as const, session, values };
  });

  if (!result.ok) throw new Error(result.error);
  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "create",
    entityType: "training_participant",
    entityId: id,
    entityLabel: data.fullName,
    summary: `Registered ${data.fullName} for ${result.session.referenceNumber}`,
    after: result.values,
  });

  refreshTrainingPaths();
}

export async function updateTrainingAttendance(formData: FormData) {
  const user = await requireTrainingManager();
  const parsed = trainingAttendanceSchema.safeParse({
    participantId: field(formData, "participantId"),
    status: field(formData, "status"),
  });
  if (!parsed.success) throw new Error(trainingValidationMessage(parsed.error));
  const data = parsed.data;

  const [before] = await db.select().from(trainingParticipants).where(eq(trainingParticipants.id, data.participantId)).limit(1);
  if (!before) throw new Error("Training participant not found");

  await db
    .update(trainingParticipants)
    .set({ attendanceStatus: data.status, updatedAt: new Date() })
    .where(eq(trainingParticipants.id, data.participantId));
  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "update",
    entityType: "training_participant",
    entityId: before.id,
    entityLabel: before.fullName,
    summary: `Updated training attendance to ${data.status}`,
    before: { attendanceStatus: before.attendanceStatus },
    after: { attendanceStatus: data.status },
  });

  refreshTrainingPaths();
}

export async function recordTrainingAssessment(formData: FormData) {
  const user = await requireTrainingManager();
  const parsed = trainingAssessmentSchema.safeParse({
    participantId: field(formData, "participantId"),
    assessmentType: field(formData, "assessmentType"),
    theoryScore: field(formData, "theoryScore"),
    practicalScore: field(formData, "practicalScore"),
    result: field(formData, "result"),
    riskLevel: field(formData, "riskLevel"),
    strengths: field(formData, "strengths"),
    improvementAreas: field(formData, "improvementAreas"),
    remarks: field(formData, "remarks"),
  });
  if (!parsed.success) throw new Error(trainingValidationMessage(parsed.error));
  const data = parsed.data;
  const overallScore = calculateOverallScore(data.theoryScore, data.practicalScore);
  const passed = isPassingTrainingResult(data.result);
  const id = newId();

  const result = await db.transaction(async (tx) => {
    const [participant] = await tx.select().from(trainingParticipants).where(eq(trainingParticipants.id, data.participantId)).limit(1);
    if (!participant) return { ok: false as const, error: "Training participant not found" };
    const [session] = await tx.select().from(trainingSessions).where(eq(trainingSessions.id, participant.sessionId)).limit(1);
    if (!session) return { ok: false as const, error: "Training session not found" };
    if (session.status === "cancelled") return { ok: false as const, error: "Cancelled training sessions cannot be assessed" };
    if (participant.attendanceStatus === "absent" || participant.attendanceStatus === "withdrawn") {
      return { ok: false as const, error: "Absent or withdrawn participants cannot receive an assessment result" };
    }

    const assessment = {
      id,
      participantId: participant.id,
      sessionId: participant.sessionId,
      assessorId: user.id,
      assessmentType: data.assessmentType,
      theoryScore: data.theoryScore === undefined ? null : data.theoryScore.toFixed(2),
      practicalScore: data.practicalScore === undefined ? null : data.practicalScore.toFixed(2),
      overallScore: overallScore === null ? null : overallScore.toFixed(2),
      result: data.result,
      riskLevel: data.riskLevel || null,
      strengths: data.strengths || null,
      improvementAreas: data.improvementAreas,
      remarks: data.remarks || null,
    } as const;
    await tx.insert(trainingAssessments).values(assessment);
    await tx
      .update(trainingParticipants)
      .set({
        attendanceStatus: participant.attendanceStatus === "registered" ? "attended" : participant.attendanceStatus,
        assessmentStatus: passed ? "passed" : "failed",
        certificateEligible: passed,
        riskLevel: data.riskLevel || participant.riskLevel,
        updatedAt: new Date(),
      })
      .where(eq(trainingParticipants.id, participant.id));
    return { ok: true as const, participant, session, assessment };
  });

  if (!result.ok) throw new Error(result.error);
  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "inspect",
    entityType: "training_assessment",
    entityId: id,
    entityLabel: result.participant.fullName,
    summary: `Recorded ${data.assessmentType} assessment: ${data.result}`,
    after: result.assessment,
  });

  refreshTrainingPaths();
}

export async function issueTrainingCertificate(formData: FormData) {
  const user = await requireTrainingManager();
  const parsed = trainingCertificateSchema.safeParse({
    participantId: field(formData, "participantId"),
    validityMonths: field(formData, "validityMonths") || "12",
  });
  if (!parsed.success) throw new Error(trainingValidationMessage(parsed.error));
  const data = parsed.data;

  const id = newId();
  const certificateNumber = `DTA-${new Date().getUTCFullYear()}-${id.slice(0, 10).replace(/-/g, "").toUpperCase()}`;
  const verificationCode = newId().replace(/-/g, "");
  const issueDate = new Date();
  const issueDateText = issueDate.toISOString().slice(0, 10);
  let expiryDate: string | null = null;
  if (data.validityMonths > 0) {
    const expiry = new Date(issueDate);
    expiry.setUTCMonth(expiry.getUTCMonth() + data.validityMonths);
    expiryDate = expiry.toISOString().slice(0, 10);
  }

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${data.participantId}))`);
    const [participant] = await tx.select().from(trainingParticipants).where(eq(trainingParticipants.id, data.participantId)).limit(1);
    if (!participant) return { ok: false as const, error: "Training participant not found" };
    const [session] = await tx.select().from(trainingSessions).where(eq(trainingSessions.id, participant.sessionId)).limit(1);
    if (!session) return { ok: false as const, error: "Training session not found" };

    const [passingAssessment] = await tx
      .select({ id: trainingAssessments.id, result: trainingAssessments.result })
      .from(trainingAssessments)
      .where(and(
        eq(trainingAssessments.participantId, participant.id),
        inArray(trainingAssessments.result, [...PASSING_RESULTS]),
      ))
      .orderBy(desc(trainingAssessments.assessedAt))
      .limit(1);
    if (!passingAssessment || !participant.certificateEligible) {
      return { ok: false as const, error: "A passing or competent assessment is required before certificate issuance" };
    }

    const [existing] = await tx
      .select({ id: trainingCertificates.id, certificateNumber: trainingCertificates.certificateNumber })
      .from(trainingCertificates)
      .where(and(
        eq(trainingCertificates.participantId, participant.id),
        eq(trainingCertificates.sessionId, participant.sessionId),
        eq(trainingCertificates.status, "active"),
      ))
      .limit(1);
    if (existing) {
      return { ok: false as const, error: `An active certificate already exists: ${existing.certificateNumber}` };
    }

    const certificate = {
      id,
      certificateNumber,
      verificationCode,
      participantId: participant.id,
      sessionId: participant.sessionId,
      serviceId: session.serviceId,
      issueDate: issueDateText,
      expiryDate,
      status: "active",
      issuedBy: user.id,
    } as const;
    await tx.insert(trainingCertificates).values(certificate);
    return { ok: true as const, participant, session, certificate };
  });

  if (!result.ok) throw new Error(result.error);
  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "approve",
    entityType: "training_certificate",
    entityId: id,
    entityLabel: certificateNumber,
    summary: `Issued training certificate to ${result.participant.fullName}`,
    after: result.certificate,
  });

  refreshTrainingPaths();
}
