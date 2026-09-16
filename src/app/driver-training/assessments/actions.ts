"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { trainingAssessments, trainingParticipants, trainingSessions } from "@/db/training-schema";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  calculateDriverAssessment,
  deriveDriverAssessmentOutcome,
  DRIVER_ASSESSMENT_CRITICAL_VIOLATIONS,
  DRIVER_ASSESSMENT_SECTIONS,
  DRIVER_ASSESSMENT_TOTAL_CRITERIA,
} from "@/lib/driver-assessment-template";
import {
  canAdministrativelySelfReviewTrainingAssessment,
  canManageTraining,
  canReviewTrainingAssessments,
} from "@/lib/training-access";
import { isValidTrainingDate, TRAINING_ASSESSMENT_TYPES } from "@/lib/training-policy";
import { newId } from "@/lib/utils";

const VALID_ASSESSMENT_TYPES = new Set<string>(TRAINING_ASSESSMENT_TYPES);
const VALID_CRITICAL_VIOLATIONS = new Set<string>(DRIVER_ASSESSMENT_CRITICAL_VIOLATIONS.map((item) => item.id));
const VALID_REVIEW_DECISIONS = new Set(["approved", "returned"]);

function text(formData: FormData, name: string, max = 4000) {
  const value = formData.get(name);
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function parseDevelopmentPlan(formData: FormData) {
  const items: Array<{ area: string; action: string; targetDate?: string }> = [];
  for (let index = 1; index <= 4; index += 1) {
    const area = text(formData, `developmentArea${index}`, 500);
    const action = text(formData, `developmentAction${index}`, 1200);
    const targetDate = text(formData, `developmentTarget${index}`, 20);
    if (!area && !action) continue;
    if (!area || !action) throw new Error("Each development-plan item needs both an area and a required action");
    if (targetDate && !isValidTrainingDate(targetDate)) throw new Error("Use a valid target date in the development plan");
    items.push({ area, action, ...(targetDate ? { targetDate } : {}) });
  }
  return items;
}

function refreshAssessmentPaths(assessmentId?: string) {
  revalidatePath("/driver-training");
  revalidatePath("/driver-training/assessments");
  revalidatePath("/driver-training/assessments/written-exams");
  revalidatePath("/driver-training/assessments/review");
  if (assessmentId) {
    revalidatePath(`/driver-training/assessments/${assessmentId}`);
    revalidatePath(`/driver-training/assessments/${assessmentId}/print`);
  }
  revalidatePath("/driver-training/participants");
  revalidatePath("/driver-training/certificates");
  revalidatePath("/driver-training/analytics");
  revalidatePath("/driver-training/compliance");
}

export async function recordComprehensiveDriverAssessment(formData: FormData) {
  const user = await getCurrentUser();
  if (!canManageTraining(user)) throw new Error("You do not have permission to record driver assessments");

  const participantId = text(formData, "participantId", 36);
  const assessmentType = text(formData, "assessmentType", 40);
  if (!participantId) throw new Error("Select a participant to assess");
  if (!VALID_ASSESSMENT_TYPES.has(assessmentType)) throw new Error("Select a valid assessment type");

  const ratings: Record<string, number> = {};
  const sectionNotes: Record<string, string> = {};
  for (const section of DRIVER_ASSESSMENT_SECTIONS) {
    let sectionRated = 0;
    for (const criterion of section.criteria) {
      const raw = formData.get(`rating__${criterion.id}`);
      if (raw === null || raw === "") continue;
      const rating = Number(raw);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error(`Invalid rating for ${criterion.label}`);
      ratings[criterion.id] = rating;
      sectionRated += 1;
    }
    if (sectionRated === 0) throw new Error(`Rate at least one criterion in ${section.title}`);
    const note = text(formData, `sectionNote__${section.id}`, 2000);
    if (note) sectionNotes[`section:${section.id}`] = note;
  }

  const calculated = calculateDriverAssessment(ratings);
  const minimumRequired = Math.ceil(DRIVER_ASSESSMENT_TOTAL_CRITERIA * 0.75);
  if (calculated.ratedCriteria < minimumRequired || calculated.percentage === null || calculated.classification === null) {
    throw new Error(`Complete at least ${minimumRequired} of ${DRIVER_ASSESSMENT_TOTAL_CRITERIA} assessment criteria before submitting`);
  }
  const assessmentPerformanceScore = calculated.percentage;
  const classification = calculated.classification;

  const criticalViolations = formData
    .getAll("criticalViolations")
    .filter((value): value is string => typeof value === "string" && VALID_CRITICAL_VIOLATIONS.has(value));

  const provisionalOutcome = deriveDriverAssessmentOutcome(assessmentPerformanceScore, criticalViolations.length);
  const strengths = text(formData, "strengths");
  const improvementText = text(formData, "improvementAreas");
  const improvementAreas = improvementText
    ? [...new Set(improvementText.split(/[,\n]/).map((item) => item.trim()).filter(Boolean))].slice(0, 30)
    : [];
  const developmentPlan = parseDevelopmentPlan(formData);
  const qualitativeFeedback = {
    safetyObservations: text(formData, "safetyObservations") || undefined,
    vehicleHandlingObservations: text(formData, "vehicleHandlingObservations") || undefined,
    communicationObservations: text(formData, "communicationObservations") || undefined,
    trainerComments: text(formData, "trainerComments") || undefined,
    immediateCorrectiveAction: text(formData, "immediateCorrectiveAction") || undefined,
  };
  const driverAcknowledged = formData.get("driverAcknowledged") === "on";
  const driverComments = text(formData, "driverComments");
  const id = newId();

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${participantId}))`);
    const [participant] = await tx.select().from(trainingParticipants).where(eq(trainingParticipants.id, participantId)).limit(1);
    if (!participant) return { ok: false as const, error: "Training participant not found" };
    if (participant.attendanceStatus === "absent" || participant.attendanceStatus === "withdrawn") {
      return { ok: false as const, error: "Absent or withdrawn participants cannot receive a practical driver assessment" };
    }

    const [session] = await tx.select().from(trainingSessions).where(eq(trainingSessions.id, participant.sessionId)).limit(1);
    if (!session) return { ok: false as const, error: "Training session not found" };
    if (session.status === "cancelled") return { ok: false as const, error: "Cancelled training sessions cannot be assessed" };

    const assessment = {
      id,
      participantId: participant.id,
      sessionId: participant.sessionId,
      assessorId: user.id,
      assessmentType,
      assessmentVersion: "driver-v2",
      theoryScore: null,
      roadSignScore: null,
      practicalScore: assessmentPerformanceScore.toFixed(2),
      overallScore: null,
      scoredPoints: calculated.score,
      maximumPoints: calculated.maximum,
      classification,
      result: provisionalOutcome.result,
      riskLevel: provisionalOutcome.riskLevel,
      criteriaRatings: ratings,
      criteriaComments: sectionNotes,
      sectionScores: calculated.sectionScores,
      criticalViolations,
      qualitativeFeedback,
      developmentPlan,
      finalRecommendation: provisionalOutcome.finalRecommendation,
      strengths: strengths || null,
      improvementAreas,
      remarks: text(formData, "remarks") || null,
      driverAcknowledged,
      driverComments: driverComments || null,
      reviewStatus: "pending_review",
    } as const;

    await tx.insert(trainingAssessments).values(assessment);
    await tx
      .update(trainingParticipants)
      .set({
        attendanceStatus: participant.attendanceStatus === "registered" ? "attended" : participant.attendanceStatus,
        assessmentStatus: "assessed",
        certificateEligible: false,
        riskLevel: provisionalOutcome.riskLevel,
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
    summary: `Driving assessment recorded at ${assessmentPerformanceScore}%; written exam scores required before final review and certification`,
    after: {
      assessmentType,
      assessmentPerformanceScore,
      theoryScore: null,
      roadSignScore: null,
      totalPerformanceScore: null,
      provisionalClassification: classification,
      provisionalResult: provisionalOutcome.result,
      riskLevel: provisionalOutcome.riskLevel,
      criticalViolations,
      finalRecommendation: provisionalOutcome.finalRecommendation,
      reviewStatus: "pending_review",
    },
  });

  refreshAssessmentPaths(id);
  redirect(`/driver-training/assessments/${id}`);
}

export async function reviewDriverAssessment(formData: FormData) {
  const user = await getCurrentUser();
  if (!canReviewTrainingAssessments(user)) throw new Error("You do not have permission to review driver assessments");

  const assessmentId = text(formData, "assessmentId", 36);
  const decision = text(formData, "decision", 24);
  const reviewComments = text(formData, "reviewComments", 4000);
  if (!assessmentId) throw new Error("Assessment reference is required");
  if (!VALID_REVIEW_DECISIONS.has(decision)) throw new Error("Select a valid assessment review decision");
  if (decision === "returned" && reviewComments.length < 5) throw new Error("Explain what the trainer must correct before reassessment");

  const result = await db.transaction(async (tx) => {
    const [initial] = await tx.select().from(trainingAssessments).where(eq(trainingAssessments.id, assessmentId)).limit(1);
    if (!initial) return { ok: false as const, error: "Driver assessment not found" };

    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${initial.participantId}))`);
    const [assessment] = await tx.select().from(trainingAssessments).where(eq(trainingAssessments.id, assessmentId)).limit(1);
    if (!assessment) return { ok: false as const, error: "Driver assessment not found" };
    if (assessment.reviewStatus !== "pending_review") return { ok: false as const, error: "This assessment has already been reviewed" };

    const isSelfReview = Boolean(assessment.assessorId && assessment.assessorId === user.id);
    const administrativeSelfReviewOverride = isSelfReview && canAdministrativelySelfReviewTrainingAssessment(user);
    if (isSelfReview && !administrativeSelfReviewOverride) {
      return { ok: false as const, error: "Assessors cannot approve or return their own assessment" };
    }
    if (administrativeSelfReviewOverride && reviewComments.length < 5) {
      return { ok: false as const, error: "Administrative self-review requires review comments explaining the decision" };
    }

    const [latestAssessment] = await tx
      .select({ id: trainingAssessments.id })
      .from(trainingAssessments)
      .where(eq(trainingAssessments.participantId, assessment.participantId))
      .orderBy(desc(trainingAssessments.assessedAt), desc(trainingAssessments.createdAt))
      .limit(1);
    if (!latestAssessment || latestAssessment.id !== assessment.id) {
      return { ok: false as const, error: "A newer assessment exists for this driver. Review the latest assessment instead" };
    }

    const [participant] = await tx.select().from(trainingParticipants).where(eq(trainingParticipants.id, assessment.participantId)).limit(1);
    if (!participant) return { ok: false as const, error: "Training participant not found" };

    const writtenScoresComplete = assessment.theoryScore !== null
      && assessment.roadSignScore !== null
      && assessment.practicalScore !== null
      && assessment.overallScore !== null;
    if (decision === "approved" && assessment.assessmentType !== "pre_training" && !writtenScoresComplete) {
      return {
        ok: false as const,
        error: "Record the Theory and Road Signs paper scores and calculate Total Performance before approving this assessment",
      };
    }

    const criticalCount = Array.isArray(assessment.criticalViolations) ? assessment.criticalViolations.length : 0;
    const passed = assessment.result === "competent" || assessment.result === "pass";
    const isBaseline = assessment.assessmentType === "pre_training";
    const certificateEligible = decision === "approved"
      && !isBaseline
      && writtenScoresComplete
      && passed
      && criticalCount === 0
      && assessment.riskLevel !== "critical";
    const participantAssessmentStatus = decision === "returned" || isBaseline
      ? "assessed"
      : passed
        ? "passed"
        : "failed";
    const reviewedAt = new Date();

    await tx
      .update(trainingAssessments)
      .set({
        reviewStatus: decision,
        reviewerId: user.id,
        reviewComments: reviewComments || null,
        reviewedAt,
      })
      .where(eq(trainingAssessments.id, assessment.id));

    await tx
      .update(trainingParticipants)
      .set({
        assessmentStatus: participantAssessmentStatus,
        certificateEligible,
        riskLevel: assessment.riskLevel,
        updatedAt: reviewedAt,
      })
      .where(eq(trainingParticipants.id, participant.id));

    return { ok: true as const, assessment, participant, certificateEligible, administrativeSelfReviewOverride };
  });

  if (!result.ok) throw new Error(result.error);

  await logAudit({
    userId: user.id,
    userName: user.name,
    action: decision === "approved" ? "approve" : "reject",
    entityType: "training_assessment",
    entityId: assessmentId,
    entityLabel: result.participant.fullName,
    summary: result.administrativeSelfReviewOverride
      ? decision === "approved"
        ? "Driver assessment approved using administrative self-review override"
        : "Driver assessment returned using administrative self-review override"
      : decision === "approved"
        ? "Driver assessment independently approved"
        : "Driver assessment returned for corrective action",
    before: { reviewStatus: result.assessment.reviewStatus },
    after: {
      reviewStatus: decision,
      certificateEligible: result.certificateEligible,
      reviewComments: reviewComments || undefined,
      administrativeSelfReviewOverride: result.administrativeSelfReviewOverride,
    },
  });

  refreshAssessmentPaths(assessmentId);
  redirect(`/driver-training/assessments/${assessmentId}`);
}
