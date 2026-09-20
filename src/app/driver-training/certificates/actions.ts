"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  trainingAssessments,
  trainingCertificates,
  trainingParticipants,
  trainingSessions,
} from "@/db/training-schema";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { canManageTrainingCertificates } from "@/lib/training-access";
import { calculateTrainingCompositeScore } from "@/lib/training-composite-score";
import {
  effectiveTrainingCertificateStatus,
  trainingCertificateRevocationSchema,
  trainingCertificateSchema,
  trainingValidationMessage,
} from "@/lib/training-policy";
import { newId } from "@/lib/utils";

const PASSING_RESULTS = ["pass", "competent"] as const;

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

async function requireTrainingCertificateManager() {
  const user = await getCurrentUser();
  if (!canManageTrainingCertificates(user)) {
    throw new Error("You do not have permission to issue or revoke Driver Training certificates");
  }
  return user;
}

function refreshCertificatePaths() {
  revalidatePath("/driver-training");
  revalidatePath("/driver-training/certificates");
  revalidatePath("/driver-training/analytics");
  revalidatePath("/driver-training/assessments/written-exams");
}

export async function issueAssuredTrainingCertificate(formData: FormData) {
  const user = await requireTrainingCertificateManager();
  const parsed = trainingCertificateSchema.safeParse({
    participantId: field(formData, "participantId"),
    validityMonths: field(formData, "validityMonths") || "12",
  });
  if (!parsed.success) throw new Error(trainingValidationMessage(parsed.error));
  const data = parsed.data;

  const id = newId();
  const certificateNumber = `DTA-${new Date().getUTCFullYear()}-${id.slice(0, 10).replace(/-/g, "").toUpperCase()}`;
  const verificationCode = newId().replace(/-/g, "");
  const issuedAt = new Date();
  const issueDate = issuedAt.toISOString().slice(0, 10);
  let expiryDate: string | null = null;
  if (data.validityMonths > 0) {
    const expiry = new Date(issuedAt);
    expiry.setUTCMonth(expiry.getUTCMonth() + data.validityMonths);
    expiryDate = expiry.toISOString().slice(0, 10);
  }

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${data.participantId}))`);

    const [participant] = await tx
      .select()
      .from(trainingParticipants)
      .where(eq(trainingParticipants.id, data.participantId))
      .limit(1);
    if (!participant) return { ok: false as const, error: "Training participant not found" };
    if (!participant.certificateEligible) {
      return { ok: false as const, error: "Participant is not currently eligible for certification" };
    }

    const [session] = await tx
      .select()
      .from(trainingSessions)
      .where(eq(trainingSessions.id, participant.sessionId))
      .limit(1);
    if (!session) return { ok: false as const, error: "Training session not found" };
    if (session.status !== "completed") {
      return { ok: false as const, error: "Training certificates can be issued only after the session is completed" };
    }

    const [passingAssessment] = await tx
      .select({
        id: trainingAssessments.id,
        result: trainingAssessments.result,
        reviewStatus: trainingAssessments.reviewStatus,
        assessorSignature: trainingAssessments.assessorSignature,
        reviewerSignature: trainingAssessments.reviewerSignature,
        theoryScore: trainingAssessments.theoryScore,
        roadSignScore: trainingAssessments.roadSignScore,
        practicalScore: trainingAssessments.practicalScore,
        overallScore: trainingAssessments.overallScore,
        assessedAt: trainingAssessments.assessedAt,
      })
      .from(trainingAssessments)
      .where(and(
        eq(trainingAssessments.participantId, participant.id),
        inArray(trainingAssessments.result, [...PASSING_RESULTS]),
      ))
      .orderBy(desc(trainingAssessments.assessedAt))
      .limit(1);
    if (!passingAssessment) {
      return { ok: false as const, error: "A passing or competent assessment is required before certificate issuance" };
    }
    if (passingAssessment.reviewStatus !== "approved") {
      return { ok: false as const, error: "The latest passing assessment must be independently approved before certificate issuance" };
    }
    if (!passingAssessment.assessorSignature || !passingAssessment.reviewerSignature) {
      return { ok: false as const, error: "Assessor and reviewer digital signatures are required before certificate issuance" };
    }

    const theoryScore = Number(passingAssessment.theoryScore);
    const roadSignScore = Number(passingAssessment.roadSignScore);
    const assessmentPerformanceScore = Number(passingAssessment.practicalScore);
    const storedTotalPerformance = Number(passingAssessment.overallScore);
    if (
      passingAssessment.theoryScore === null
      || passingAssessment.roadSignScore === null
      || passingAssessment.practicalScore === null
      || passingAssessment.overallScore === null
      || !Number.isFinite(theoryScore)
      || !Number.isFinite(roadSignScore)
      || !Number.isFinite(assessmentPerformanceScore)
      || !Number.isFinite(storedTotalPerformance)
    ) {
      return {
        ok: false as const,
        error: "Theory, Road Signs and Assessment Performance scores must be recorded and combined before certificate issuance",
      };
    }

    const calculatedTotalPerformance = calculateTrainingCompositeScore({
      theoryScore,
      roadSignScore,
      assessmentPerformanceScore,
    });
    if (Math.abs(calculatedTotalPerformance - storedTotalPerformance) > 0.01) {
      return {
        ok: false as const,
        error: "The stored Total Performance score is inconsistent. Re-save the written examination scores before issuing the certificate",
      };
    }

    const [latestRevoked] = await tx
      .select({ revokedAt: trainingCertificates.revokedAt, certificateNumber: trainingCertificates.certificateNumber })
      .from(trainingCertificates)
      .where(and(
        eq(trainingCertificates.participantId, participant.id),
        eq(trainingCertificates.sessionId, participant.sessionId),
        eq(trainingCertificates.status, "revoked"),
      ))
      .orderBy(desc(trainingCertificates.revokedAt))
      .limit(1);
    if (latestRevoked?.revokedAt && passingAssessment.assessedAt <= latestRevoked.revokedAt) {
      return {
        ok: false as const,
        error: `A new passing reassessment is required after revoked certificate ${latestRevoked.certificateNumber}`,
      };
    }

    const activeCertificates = await tx
      .select({ id: trainingCertificates.id, certificateNumber: trainingCertificates.certificateNumber, expiryDate: trainingCertificates.expiryDate })
      .from(trainingCertificates)
      .where(and(
        eq(trainingCertificates.participantId, participant.id),
        eq(trainingCertificates.sessionId, participant.sessionId),
        eq(trainingCertificates.status, "active"),
      ));

    const stillActive = activeCertificates.find((certificate) =>
      effectiveTrainingCertificateStatus("active", certificate.expiryDate, issuedAt) === "active"
    );
    if (stillActive) return { ok: false as const, error: `An active certificate already exists: ${stillActive.certificateNumber}` };

    const expiredIds = activeCertificates
      .filter((certificate) => effectiveTrainingCertificateStatus("active", certificate.expiryDate, issuedAt) === "expired")
      .map((certificate) => certificate.id);
    for (const expiredId of expiredIds) {
      await tx.update(trainingCertificates).set({ status: "expired" }).where(eq(trainingCertificates.id, expiredId));
    }

    const certificate = {
      id,
      certificateNumber,
      verificationCode,
      participantId: participant.id,
      sessionId: participant.sessionId,
      serviceId: session.serviceId,
      issueDate,
      expiryDate,
      status: "active",
      issuedBy: user.id,
      issuedAt,
    } as const;
    await tx.insert(trainingCertificates).values(certificate);
    return { ok: true as const, participant, session, certificate, expiredIds, calculatedTotalPerformance };
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
    after: { ...result.certificate, totalPerformanceScore: result.calculatedTotalPerformance, priorExpiredCertificatesNormalized: result.expiredIds },
  });

  refreshCertificatePaths();
}

export async function revokeTrainingCertificate(formData: FormData) {
  const user = await requireTrainingCertificateManager();
  const parsed = trainingCertificateRevocationSchema.safeParse({ certificateId: field(formData, "certificateId"), reason: field(formData, "reason") });
  if (!parsed.success) throw new Error(trainingValidationMessage(parsed.error));
  const data = parsed.data;

  const result = await db.transaction(async (tx) => {
    const [certificate] = await tx
      .select({ id: trainingCertificates.id, certificateNumber: trainingCertificates.certificateNumber, status: trainingCertificates.status, participantId: trainingCertificates.participantId, revokedAt: trainingCertificates.revokedAt, revocationReason: trainingCertificates.revocationReason })
      .from(trainingCertificates)
      .where(eq(trainingCertificates.id, data.certificateId))
      .limit(1);
    if (!certificate) return { ok: false as const, error: "Training certificate not found" };
    if (certificate.status === "revoked") return { ok: false as const, error: "Training certificate is already revoked" };

    const [participant] = await tx.select({ fullName: trainingParticipants.fullName }).from(trainingParticipants).where(eq(trainingParticipants.id, certificate.participantId)).limit(1);
    const revokedAt = new Date();
    await tx.update(trainingCertificates).set({ status: "revoked", revokedAt, revocationReason: data.reason }).where(eq(trainingCertificates.id, certificate.id));
    return { ok: true as const, certificate, participant, revokedAt };
  });

  if (!result.ok) throw new Error(result.error);

  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "reject",
    entityType: "training_certificate",
    entityId: result.certificate.id,
    entityLabel: result.certificate.certificateNumber,
    summary: `Revoked training certificate ${result.certificate.certificateNumber}`,
    before: { status: result.certificate.status, revokedAt: result.certificate.revokedAt, revocationReason: result.certificate.revocationReason },
    after: { status: "revoked", revokedAt: result.revokedAt, revocationReason: data.reason, participant: result.participant?.fullName || null },
  });

  refreshCertificatePaths();
}
