"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { trainingAssessments, trainingCertificates, trainingParticipants } from "@/db/training-schema";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { deriveDriverAssessmentOutcome } from "@/lib/driver-assessment-template";
import { canManageTraining } from "@/lib/training-access";
import {
  calculateAssessmentPerformanceScore,
  calculateTrainingCompositeScore,
  classifyTrainingCompositeScore,
  normalizePercentageScore,
} from "@/lib/training-composite-score";

function text(formData: FormData, name: string, max = 80) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function percentage(formData: FormData, name: string, label: string) {
  const raw = text(formData, name, 16);
  if (!raw) throw new Error(`${label} is required`);
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${label} must be a number`);
  try {
    return normalizePercentageScore(value);
  } catch {
    throw new Error(`${label} must be between 0 and 100`);
  }
}

function refreshPaths(assessmentId: string) {
  revalidatePath("/driver-training");
  revalidatePath("/driver-training/assessments");
  revalidatePath("/driver-training/assessments/written-exams");
  revalidatePath("/driver-training/assessments/review");
  revalidatePath(`/driver-training/assessments/${assessmentId}`);
  revalidatePath(`/driver-training/assessments/${assessmentId}/print`);
  revalidatePath("/driver-training/participants");
  revalidatePath("/driver-training/certificates");
  revalidatePath("/driver-training/analytics");
}

export async function recordWrittenExamScores(formData: FormData) {
  const user = await getCurrentUser();
  if (!canManageTraining(user)) throw new Error("You do not have permission to record written examination scores");

  const assessmentId = text(formData, "assessmentId", 36);
  if (!assessmentId) throw new Error("Select an assessment record");

  const theoryScore = percentage(formData, "theoryScore", "Theory score");
  const roadSignScore = percentage(formData, "roadSignScore", "Road Signs score");

  const result = await db.transaction(async (tx) => {
    const [initial] = await tx
      .select()
      .from(trainingAssessments)
      .where(eq(trainingAssessments.id, assessmentId))
      .limit(1);
    if (!initial) return { ok: false as const, error: "Driver assessment not found" };

    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${initial.participantId}))`);

    const [assessment] = await tx
      .select()
      .from(trainingAssessments)
      .where(eq(trainingAssessments.id, assessmentId))
      .limit(1);
    if (!assessment) return { ok: false as const, error: "Driver assessment not found" };

    const [latestAssessment] = await tx
      .select({ id: trainingAssessments.id })
      .from(trainingAssessments)
      .where(eq(trainingAssessments.participantId, assessment.participantId))
      .orderBy(desc(trainingAssessments.assessedAt), desc(trainingAssessments.createdAt))
      .limit(1);
    if (!latestAssessment || latestAssessment.id !== assessment.id) {
      return { ok: false as const, error: "Written exam scores must be recorded against the driver's latest assessment" };
    }

    const [activeCertificate] = await tx
      .select({ certificateNumber: trainingCertificates.certificateNumber })
      .from(trainingCertificates)
      .where(and(
        eq(trainingCertificates.participantId, assessment.participantId),
        eq(trainingCertificates.sessionId, assessment.sessionId),
        eq(trainingCertificates.status, "active"),
      ))
      .limit(1);
    if (activeCertificate) {
      return {
        ok: false as const,
        error: `Written exam scores cannot be changed after active certificate ${activeCertificate.certificateNumber} has been issued`,
      };
    }

    const assessmentPerformanceScore = calculateAssessmentPerformanceScore(
      assessment.scoredPoints,
      assessment.maximumPoints,
    );
    if (assessmentPerformanceScore === null) {
      return { ok: false as const, error: "The driving assessment does not contain a valid performance score" };
    }

    const totalPerformanceScore = calculateTrainingCompositeScore({
      theoryScore,
      roadSignScore,
      assessmentPerformanceScore,
    });
    const criticalCount = Array.isArray(assessment.criticalViolations) ? assessment.criticalViolations.length : 0;
    const outcome = deriveDriverAssessmentOutcome(totalPerformanceScore, criticalCount);
    const classification = classifyTrainingCompositeScore(totalPerformanceScore);
    const reviewedBefore = assessment.reviewStatus !== "pending_review";

    await tx
      .update(trainingAssessments)
      .set({
        assessmentVersion: "driver-v2",
        theoryScore: theoryScore.toFixed(2),
        roadSignScore: roadSignScore.toFixed(2),
        practicalScore: assessmentPerformanceScore.toFixed(2),
        overallScore: totalPerformanceScore.toFixed(2),
        classification,
        result: outcome.result,
        riskLevel: outcome.riskLevel,
        finalRecommendation: outcome.finalRecommendation,
        reviewStatus: "pending_review",
        reviewerId: null,
        reviewComments: null,
        reviewedAt: null,
      })
      .where(eq(trainingAssessments.id, assessment.id));

    const [participant] = await tx
      .select({ id: trainingParticipants.id, fullName: trainingParticipants.fullName })
      .from(trainingParticipants)
      .where(eq(trainingParticipants.id, assessment.participantId))
      .limit(1);
    if (!participant) return { ok: false as const, error: "Training participant not found" };

    await tx
      .update(trainingParticipants)
      .set({
        assessmentStatus: "assessed",
        certificateEligible: false,
        riskLevel: outcome.riskLevel,
        updatedAt: new Date(),
      })
      .where(eq(trainingParticipants.id, participant.id));

    return {
      ok: true as const,
      assessment,
      participant,
      assessmentPerformanceScore,
      totalPerformanceScore,
      classification,
      outcome,
      reviewedBefore,
    };
  });

  if (!result.ok) throw new Error(result.error);

  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "update",
    entityType: "training_assessment",
    entityId: assessmentId,
    entityLabel: result.participant.fullName,
    summary: result.reviewedBefore
      ? "Written exam scores recorded; prior review reset because the total performance score changed"
      : "Written exam scores recorded and total performance score calculated",
    before: {
      theoryScore: result.assessment.theoryScore,
      roadSignScore: result.assessment.roadSignScore,
      assessmentPerformanceScore: result.assessment.practicalScore,
      totalPerformanceScore: result.assessment.overallScore,
      reviewStatus: result.assessment.reviewStatus,
    },
    after: {
      theoryScore,
      roadSignScore,
      assessmentPerformanceScore: result.assessmentPerformanceScore,
      totalPerformanceScore: result.totalPerformanceScore,
      classification: result.classification,
      result: result.outcome.result,
      riskLevel: result.outcome.riskLevel,
      reviewStatus: "pending_review",
      formula: "(theory + road signs + assessment performance) / 3",
    },
  });

  refreshPaths(assessmentId);
}
