"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { trainingAssessments, trainingParticipants } from "@/db/training-schema";
import { trainingDevelopmentActions, trainingDevelopmentPlans } from "@/db/training-development-schema";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { canManageTraining } from "@/lib/training-access";
import {
  canTransitionTrainingDevelopmentAction,
  canTransitionTrainingDevelopmentPlan,
  trainingDevelopmentActionSchema,
  trainingDevelopmentActionTransitionSchema,
  trainingDevelopmentPlanSchema,
  trainingDevelopmentPlanTransitionSchema,
  trainingDevelopmentValidationMessage,
} from "@/lib/training-development-policy";
import { newId } from "@/lib/utils";

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function refreshDevelopmentPaths() {
  revalidatePath("/driver-training");
  revalidatePath("/driver-training/development");
  revalidatePath("/driver-training/participants");
}

async function requireTrainingManager() {
  const user = await getCurrentUser();
  if (!canManageTraining(user)) {
    throw new Error("You do not have permission to manage Driver Training & Assessment records");
  }
  return user;
}

async function validateInternalOwner(ownerId?: string) {
  if (!ownerId) return;
  const [owner] = await db
    .select({ id: users.id, isActive: users.isActive, role: users.role })
    .from(users)
    .where(and(eq(users.id, ownerId), ne(users.role, "transporter_user")))
    .limit(1);
  if (!owner?.isActive) throw new Error("Development plan owners must be active internal VIMS users");
}

export async function createTrainingDevelopmentPlan(formData: FormData) {
  const user = await requireTrainingManager();
  const parsed = trainingDevelopmentPlanSchema.safeParse({
    participantId: field(formData, "participantId"),
    sourceAssessmentId: field(formData, "sourceAssessmentId"),
    title: field(formData, "title"),
    priority: field(formData, "priority") || "medium",
    competencyGaps: field(formData, "competencyGaps"),
    targetDate: field(formData, "targetDate"),
    ownerId: field(formData, "ownerId"),
  });
  if (!parsed.success) throw new Error(trainingDevelopmentValidationMessage(parsed.error));
  const data = parsed.data;

  const [participant] = await db.select().from(trainingParticipants).where(eq(trainingParticipants.id, data.participantId)).limit(1);
  if (!participant) throw new Error("Training participant not found");
  if (data.sourceAssessmentId) {
    const [assessment] = await db
      .select({ id: trainingAssessments.id, participantId: trainingAssessments.participantId })
      .from(trainingAssessments)
      .where(eq(trainingAssessments.id, data.sourceAssessmentId))
      .limit(1);
    if (!assessment || assessment.participantId !== participant.id) {
      throw new Error("Source assessment must belong to the selected participant");
    }
  }
  await validateInternalOwner(data.ownerId);

  const id = newId();
  const values = {
    id,
    participantId: participant.id,
    sourceAssessmentId: data.sourceAssessmentId || null,
    title: data.title,
    status: "open",
    priority: data.priority,
    competencyGaps: data.competencyGaps,
    targetDate: data.targetDate || null,
    ownerId: data.ownerId || null,
    createdBy: user.id,
    updatedAt: new Date(),
  } as const;
  await db.insert(trainingDevelopmentPlans).values(values);
  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "create",
    entityType: "training_development_plan",
    entityId: id,
    entityLabel: participant.fullName,
    summary: `Created development plan for ${participant.fullName}`,
    after: values,
  });
  refreshDevelopmentPaths();
}

export async function addTrainingDevelopmentAction(formData: FormData) {
  const user = await requireTrainingManager();
  const parsed = trainingDevelopmentActionSchema.safeParse({
    planId: field(formData, "planId"),
    actionType: field(formData, "actionType"),
    description: field(formData, "description"),
    dueDate: field(formData, "dueDate"),
    notes: field(formData, "notes"),
  });
  if (!parsed.success) throw new Error(trainingDevelopmentValidationMessage(parsed.error));
  const data = parsed.data;
  const id = newId();

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`training-development:${data.planId}`}))`);
    const [plan] = await tx.select().from(trainingDevelopmentPlans).where(eq(trainingDevelopmentPlans.id, data.planId)).limit(1);
    if (!plan) return { ok: false as const, error: "Development plan not found" };
    if (!["open", "in_progress"].includes(plan.status)) {
      return { ok: false as const, error: "New remediation actions can only be added to open or in-progress plans" };
    }
    const values = {
      id,
      planId: plan.id,
      actionType: data.actionType,
      description: data.description,
      dueDate: data.dueDate || null,
      status: "pending",
      notes: data.notes || null,
      createdBy: user.id,
      updatedAt: new Date(),
    } as const;
    await tx.insert(trainingDevelopmentActions).values(values);
    return { ok: true as const, plan, values };
  });
  if (!result.ok) throw new Error(result.error);

  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "create",
    entityType: "training_development_action",
    entityId: id,
    entityLabel: result.plan.title,
    summary: `Added ${data.actionType} remediation action`,
    after: result.values,
  });
  refreshDevelopmentPaths();
}

export async function transitionTrainingDevelopmentAction(formData: FormData) {
  const user = await requireTrainingManager();
  const parsed = trainingDevelopmentActionTransitionSchema.safeParse({
    actionId: field(formData, "actionId"),
    status: field(formData, "status"),
    evidenceReference: field(formData, "evidenceReference"),
    notes: field(formData, "notes"),
  });
  if (!parsed.success) throw new Error(trainingDevelopmentValidationMessage(parsed.error));
  const data = parsed.data;
  if (data.status === "completed" && !data.evidenceReference) throw new Error("Completed development actions require evidence reference");
  if (data.status === "waived" && !data.notes) throw new Error("Waived development actions require a reason");

  const [lookup] = await db.select({ planId: trainingDevelopmentActions.planId }).from(trainingDevelopmentActions).where(eq(trainingDevelopmentActions.id, data.actionId)).limit(1);
  if (!lookup) throw new Error("Development action not found");

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`training-development:${lookup.planId}`}))`);
    const [action] = await tx.select().from(trainingDevelopmentActions).where(eq(trainingDevelopmentActions.id, data.actionId)).limit(1);
    if (!action) return { ok: false as const, error: "Development action not found" };
    const [plan] = await tx.select().from(trainingDevelopmentPlans).where(eq(trainingDevelopmentPlans.id, action.planId)).limit(1);
    if (!plan) return { ok: false as const, error: "Development plan not found" };
    if (["completed", "cancelled"].includes(plan.status)) return { ok: false as const, error: "Closed development plans cannot be changed" };
    if (!canTransitionTrainingDevelopmentAction(action.status, data.status)) {
      return { ok: false as const, error: `Development action cannot move from ${action.status} to ${data.status}` };
    }

    const now = new Date();
    const patch = {
      status: data.status,
      evidenceReference: data.evidenceReference || action.evidenceReference,
      notes: data.notes || action.notes,
      completedAt: data.status === "completed" ? now : action.completedAt,
      completedBy: data.status === "completed" ? user.id : action.completedBy,
      updatedAt: now,
    } as const;
    await tx.update(trainingDevelopmentActions).set(patch).where(eq(trainingDevelopmentActions.id, action.id));
    return { ok: true as const, action, plan, patch };
  });
  if (!result.ok) throw new Error(result.error);

  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "update",
    entityType: "training_development_action",
    entityId: result.action.id,
    entityLabel: result.plan.title,
    summary: `Changed development action status to ${data.status}`,
    before: { status: result.action.status },
    after: { status: data.status, evidenceReference: data.evidenceReference || null, notes: data.notes || null },
  });
  refreshDevelopmentPaths();
}

export async function transitionTrainingDevelopmentPlan(formData: FormData) {
  const user = await requireTrainingManager();
  const parsed = trainingDevelopmentPlanTransitionSchema.safeParse({
    planId: field(formData, "planId"),
    status: field(formData, "status"),
    verificationSummary: field(formData, "verificationSummary"),
  });
  if (!parsed.success) throw new Error(trainingDevelopmentValidationMessage(parsed.error));
  const data = parsed.data;
  if (data.status === "completed" && !data.verificationSummary) {
    throw new Error("Completed development plans require an effectiveness verification summary");
  }

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`training-development:${data.planId}`}))`);
    const [plan] = await tx.select().from(trainingDevelopmentPlans).where(eq(trainingDevelopmentPlans.id, data.planId)).limit(1);
    if (!plan) return { ok: false as const, error: "Development plan not found" };
    if (!canTransitionTrainingDevelopmentPlan(plan.status, data.status)) {
      return { ok: false as const, error: `Development plan cannot move from ${plan.status} to ${data.status}` };
    }

    if (data.status === "verification" || data.status === "completed") {
      const [totalRow] = await tx.select({ n: count() }).from(trainingDevelopmentActions).where(eq(trainingDevelopmentActions.planId, plan.id));
      const [openRow] = await tx.select({ n: count() }).from(trainingDevelopmentActions).where(and(
        eq(trainingDevelopmentActions.planId, plan.id),
        inArray(trainingDevelopmentActions.status, ["pending", "in_progress"]),
      ));
      if (Number(totalRow?.n || 0) === 0) return { ok: false as const, error: "Add at least one remediation action before verification" };
      if (Number(openRow?.n || 0) > 0) return { ok: false as const, error: "Complete or waive all remediation actions before verification or closure" };
    }

    const now = new Date();
    const patch = {
      status: data.status,
      verificationSummary: data.verificationSummary || plan.verificationSummary,
      completedAt: data.status === "completed" ? now : plan.completedAt,
      completedBy: data.status === "completed" ? user.id : plan.completedBy,
      updatedAt: now,
    } as const;
    await tx.update(trainingDevelopmentPlans).set(patch).where(eq(trainingDevelopmentPlans.id, plan.id));
    return { ok: true as const, plan, patch };
  });
  if (!result.ok) throw new Error(result.error);

  await logAudit({
    userId: user.id,
    userName: user.name,
    action: data.status === "completed" ? "approve" : "update",
    entityType: "training_development_plan",
    entityId: result.plan.id,
    entityLabel: result.plan.title,
    summary: `Changed development plan status to ${data.status}`,
    before: { status: result.plan.status },
    after: { status: data.status, verificationSummary: data.verificationSummary || null },
  });
  refreshDevelopmentPaths();
}
