"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { trainingParticipants, trainingSessions } from "@/db/training-schema";
import { trainingQualityEvents, trainingQualityFindings, trainingSessionFeedback } from "@/db/training-quality-schema";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { canManageTrainingGovernance } from "@/lib/training-access";
import {
  canTransitionTrainingQualityFinding,
  feedbackQualitySignal,
  trainingFeedbackSchema,
  trainingQualityClosureSchema,
  trainingQualityFindingSchema,
  trainingQualityProgressSchema,
  trainingQualityValidationMessage,
} from "@/lib/training-quality-policy";
import { newId } from "@/lib/utils";

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function checked(formData: FormData, name: string) {
  return formData.has(name);
}

function refreshQualityPaths(participantId?: string) {
  revalidatePath("/driver-training");
  revalidatePath("/driver-training/quality");
  revalidatePath("/driver-training/analytics");
  if (participantId) revalidatePath(`/driver-training/participants/${participantId}`);
}

async function requireTrainingManager() {
  const user = await getCurrentUser();
  if (!canManageTrainingGovernance(user)) {
    throw new Error("You do not have permission to manage Driver Training quality records");
  }
  return user;
}

async function validateSessionParticipant(sessionId: string, participantId?: string) {
  const [session] = await db
    .select({ id: trainingSessions.id, referenceNumber: trainingSessions.referenceNumber, status: trainingSessions.status })
    .from(trainingSessions)
    .where(eq(trainingSessions.id, sessionId))
    .limit(1);
  if (!session) throw new Error("Training session not found");

  if (!participantId) return { session, participant: null };
  const [participant] = await db
    .select({ id: trainingParticipants.id, sessionId: trainingParticipants.sessionId, fullName: trainingParticipants.fullName })
    .from(trainingParticipants)
    .where(eq(trainingParticipants.id, participantId))
    .limit(1);
  if (!participant || participant.sessionId !== sessionId) {
    throw new Error("The selected participant does not belong to this training session");
  }
  return { session, participant };
}

async function validateOwner(ownerId?: string) {
  if (!ownerId) return null;
  const [owner] = await db
    .select({ id: users.id, name: users.name, role: users.role, isActive: users.isActive })
    .from(users)
    .where(eq(users.id, ownerId))
    .limit(1);
  if (!owner || !owner.isActive || owner.role === "transporter_user") {
    throw new Error("Quality action owners must be active internal VIMS users");
  }
  return owner;
}

export async function submitTrainingFeedback(formData: FormData) {
  const actor = await requireTrainingManager();
  const parsed = trainingFeedbackSchema.safeParse({
    sessionId: field(formData, "sessionId"),
    participantId: field(formData, "participantId"),
    respondentType: field(formData, "respondentType"),
    contentRating: field(formData, "contentRating"),
    instructorRating: field(formData, "instructorRating"),
    practicalRating: field(formData, "practicalRating"),
    safetyRating: field(formData, "safetyRating"),
    overallRating: field(formData, "overallRating"),
    wouldRecommend: field(formData, "wouldRecommend"),
    comments: field(formData, "comments"),
    improvementSuggestions: field(formData, "improvementSuggestions"),
    anonymous: checked(formData, "anonymous"),
  });
  if (!parsed.success) throw new Error(trainingQualityValidationMessage(parsed.error));
  const data = parsed.data;
  const context = await validateSessionParticipant(data.sessionId, data.participantId);
  if (!["in_progress", "completed"].includes(context.session.status)) {
    throw new Error("Training feedback can only be recorded for in-progress or completed sessions");
  }
  const signal = feedbackQualitySignal(data.overallRating, data.safetyRating);
  const createdAt = new Date();

  const result = await db.transaction(async (tx) => {
    const [feedback] = await tx
      .insert(trainingSessionFeedback)
      .values({
        id: newId(),
        sessionId: data.sessionId,
        participantId: data.participantId || null,
        respondentType: data.respondentType,
        contentRating: data.contentRating,
        instructorRating: data.instructorRating,
        practicalRating: data.practicalRating,
        safetyRating: data.safetyRating,
        overallRating: data.overallRating,
        wouldRecommend: data.wouldRecommend ?? null,
        comments: data.comments || null,
        improvementSuggestions: data.improvementSuggestions || null,
        anonymous: data.anonymous,
        submittedBy: actor.id,
        createdAt,
      })
      .returning();

    let finding = null;
    if (signal === "high" || signal === "critical") {
      const findingId = newId();
      const category = data.safetyRating <= 2 ? "safety" : "training_content";
      [finding] = await tx
        .insert(trainingQualityFindings)
        .values({
          id: findingId,
          sessionId: data.sessionId,
          participantId: data.participantId || null,
          source: "feedback",
          category,
          severity: signal,
          status: "open",
          title: `Low ${category.replaceAll("_", " ")} feedback requires review`,
          description: `Feedback ${feedback?.id || "record"} rated overall ${data.overallRating}/5 and safety ${data.safetyRating}/5. Review the response and determine corrective or preventive action.`,
          createdBy: actor.id,
          createdAt,
          updatedAt: createdAt,
        })
        .returning();
      if (finding) {
        await tx.insert(trainingQualityEvents).values({
          id: newId(),
          findingId: finding.id,
          eventType: "created",
          summary: `Quality finding automatically raised from ${signal} feedback signal`,
          createdBy: actor.id,
          createdAt,
        });
      }
    }
    return { feedback, finding };
  });

  await logAudit({
    userId: actor.id,
    userName: actor.name,
    action: "create",
    entityType: "training_session_feedback",
    entityId: result.feedback?.id || null,
    entityLabel: context.session.referenceNumber,
    summary: `Captured ${data.respondentType} Driver Training feedback for ${context.session.referenceNumber} (${data.overallRating}/5 overall)${result.finding ? "; quality finding opened" : ""}`,
    before: null,
    after: result,
  });
  refreshQualityPaths(data.participantId);
}

export async function createTrainingQualityFinding(formData: FormData) {
  const actor = await requireTrainingManager();
  const parsed = trainingQualityFindingSchema.safeParse({
    sessionId: field(formData, "sessionId"),
    participantId: field(formData, "participantId"),
    source: field(formData, "source"),
    category: field(formData, "category"),
    severity: field(formData, "severity") || "medium",
    title: field(formData, "title"),
    description: field(formData, "description"),
    ownerId: field(formData, "ownerId"),
    dueDate: field(formData, "dueDate"),
    rootCause: field(formData, "rootCause"),
    actionPlan: field(formData, "actionPlan"),
  });
  if (!parsed.success) throw new Error(trainingQualityValidationMessage(parsed.error));
  const data = parsed.data;
  const context = await validateSessionParticipant(data.sessionId, data.participantId);
  await validateOwner(data.ownerId);
  const createdAt = new Date();

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`training-quality:${data.sessionId}:${data.title.toLowerCase()}`}))`);
    const [finding] = await tx
      .insert(trainingQualityFindings)
      .values({
        id: newId(),
        sessionId: data.sessionId,
        participantId: data.participantId || null,
        source: data.source,
        category: data.category,
        severity: data.severity,
        status: "open",
        title: data.title,
        description: data.description,
        rootCause: data.rootCause || null,
        actionPlan: data.actionPlan || null,
        ownerId: data.ownerId || null,
        dueDate: data.dueDate || null,
        createdBy: actor.id,
        createdAt,
        updatedAt: createdAt,
      })
      .returning();
    if (!finding) throw new Error("Unable to create quality finding");
    await tx.insert(trainingQualityEvents).values({
      id: newId(),
      findingId: finding.id,
      eventType: "created",
      summary: `Quality finding opened with ${data.severity} severity from ${data.source.replaceAll("_", " ")}`,
      createdBy: actor.id,
      createdAt,
    });
    return finding;
  });

  await logAudit({
    userId: actor.id,
    userName: actor.name,
    action: "create",
    entityType: "training_quality_finding",
    entityId: result.id,
    entityLabel: `${context.session.referenceNumber} · ${data.title}`,
    summary: `Opened Driver Training quality finding: ${data.title}`,
    before: null,
    after: result,
  });
  refreshQualityPaths(data.participantId);
}

export async function updateTrainingQualityFinding(formData: FormData) {
  const actor = await requireTrainingManager();
  const parsed = trainingQualityProgressSchema.safeParse({
    findingId: field(formData, "findingId"),
    status: field(formData, "status"),
    ownerId: field(formData, "ownerId"),
    dueDate: field(formData, "dueDate"),
    rootCause: field(formData, "rootCause"),
    actionPlan: field(formData, "actionPlan"),
    note: field(formData, "note"),
  });
  if (!parsed.success) throw new Error(trainingQualityValidationMessage(parsed.error));
  const data = parsed.data;
  await validateOwner(data.ownerId);
  const updatedAt = new Date();

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`training-quality-finding:${data.findingId}`}))`);
    const [before] = await tx.select().from(trainingQualityFindings).where(eq(trainingQualityFindings.id, data.findingId)).limit(1);
    if (!before) throw new Error("Training quality finding not found");
    if (["closed", "dismissed"].includes(before.status)) throw new Error(`The finding is already ${before.status}`);
    if (!canTransitionTrainingQualityFinding(before.status, data.status)) {
      throw new Error(`Cannot move a quality finding from ${before.status} to ${data.status}`);
    }

    const [after] = await tx
      .update(trainingQualityFindings)
      .set({
        status: data.status,
        ownerId: data.ownerId || null,
        dueDate: data.dueDate || null,
        rootCause: data.rootCause || null,
        actionPlan: data.actionPlan || null,
        updatedAt,
      })
      .where(eq(trainingQualityFindings.id, before.id))
      .returning();
    if (!after) throw new Error("Unable to update quality finding");

    const eventType = before.status === after.status ? "progress_updated" : "status_changed";
    const summaryParts = [`Quality finding ${eventType === "status_changed" ? `moved from ${before.status} to ${after.status}` : "progress updated"}`];
    if (data.note) summaryParts.push(data.note);
    await tx.insert(trainingQualityEvents).values({
      id: newId(),
      findingId: before.id,
      eventType,
      summary: summaryParts.join(": ").slice(0, 4000),
      createdBy: actor.id,
      createdAt: updatedAt,
    });
    return { before, after };
  });

  await logAudit({
    userId: actor.id,
    userName: actor.name,
    action: "update",
    entityType: "training_quality_finding",
    entityId: result.after.id,
    entityLabel: result.after.title,
    summary: `Updated Driver Training quality finding ${result.after.title}: ${result.before.status} → ${result.after.status}`,
    before: result.before,
    after: result.after,
  });
  refreshQualityPaths(result.after.participantId || undefined);
}

export async function closeTrainingQualityFinding(formData: FormData) {
  const actor = await requireTrainingManager();
  const parsed = trainingQualityClosureSchema.safeParse({
    findingId: field(formData, "findingId"),
    rootCause: field(formData, "rootCause"),
    actionPlan: field(formData, "actionPlan"),
    closureEvidence: field(formData, "closureEvidence"),
    effectivenessReview: field(formData, "effectivenessReview"),
  });
  if (!parsed.success) throw new Error(trainingQualityValidationMessage(parsed.error));
  const data = parsed.data;
  const closedAt = new Date();

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`training-quality-finding:${data.findingId}`}))`);
    const [before] = await tx.select().from(trainingQualityFindings).where(eq(trainingQualityFindings.id, data.findingId)).limit(1);
    if (!before) throw new Error("Training quality finding not found");
    if (before.status !== "verification") {
      throw new Error("Move the finding to verification before controlled closure");
    }
    if (!canTransitionTrainingQualityFinding(before.status, "closed")) {
      throw new Error(`Cannot close a quality finding from ${before.status}`);
    }

    const [after] = await tx
      .update(trainingQualityFindings)
      .set({
        status: "closed",
        rootCause: data.rootCause,
        actionPlan: data.actionPlan,
        closureEvidence: data.closureEvidence,
        effectivenessReview: data.effectivenessReview,
        closedBy: actor.id,
        closedAt,
        updatedAt: closedAt,
      })
      .where(eq(trainingQualityFindings.id, before.id))
      .returning();
    if (!after) throw new Error("Unable to close quality finding");
    await tx.insert(trainingQualityEvents).values({
      id: newId(),
      findingId: before.id,
      eventType: "closed",
      summary: "Quality finding closed after root-cause, corrective-action, closure-evidence, and effectiveness review",
      createdBy: actor.id,
      createdAt: closedAt,
    });
    return { before, after };
  });

  await logAudit({
    userId: actor.id,
    userName: actor.name,
    action: "update",
    entityType: "training_quality_finding",
    entityId: result.after.id,
    entityLabel: result.after.title,
    summary: `Closed Driver Training quality finding after effectiveness review: ${result.after.title}`,
    before: result.before,
    after: result.after,
  });
  refreshQualityPaths(result.after.participantId || undefined);
}
