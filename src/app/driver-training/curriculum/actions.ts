"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { trainingSessions } from "@/db/training-schema";
import {
  trainingCurricula,
  trainingCurriculumVersions,
  trainingMatrixRequirements,
  trainingSessionCurricula,
} from "@/db/training-curriculum-schema";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { canManageTraining } from "@/lib/training-access";
import {
  buildTrainingMatrixRequirementKey,
  canApproveTrainingCurriculumVersion,
  canBindCurriculumToSession,
  trainingCurriculumApprovalSchema,
  trainingCurriculumSchema,
  trainingCurriculumValidationMessage,
  trainingCurriculumVersionSchema,
  trainingMatrixRequirementSchema,
  trainingSessionCurriculumSchema,
} from "@/lib/training-curriculum-policy";
import { newId } from "@/lib/utils";

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function checked(formData: FormData, name: string) {
  return formData.has(name);
}

function refreshCurriculumPaths() {
  revalidatePath("/driver-training");
  revalidatePath("/driver-training/curriculum");
  revalidatePath("/driver-training/sessions");
  revalidatePath("/driver-training/readiness");
}

async function requireTrainingManager() {
  const user = await getCurrentUser();
  if (!canManageTraining(user)) {
    throw new Error("You do not have permission to manage Driver Training curriculum records");
  }
  return user;
}

async function validateInternalOwner(ownerId?: string) {
  if (!ownerId) return null;
  const [owner] = await db
    .select({ id: users.id, name: users.name, role: users.role, isActive: users.isActive })
    .from(users)
    .where(eq(users.id, ownerId))
    .limit(1);
  if (!owner || !owner.isActive || owner.role === "transporter_user") {
    throw new Error("Curriculum owners must be active internal VIMS users");
  }
  return owner;
}

export async function createTrainingCurriculum(formData: FormData) {
  const actor = await requireTrainingManager();
  const parsed = trainingCurriculumSchema.safeParse({
    code: field(formData, "code"),
    serviceId: field(formData, "serviceId"),
    title: field(formData, "title"),
    status: field(formData, "status") || "active",
    ownerId: field(formData, "ownerId"),
    notes: field(formData, "notes"),
  });
  if (!parsed.success) throw new Error(trainingCurriculumValidationMessage(parsed.error));
  const data = parsed.data;
  await validateInternalOwner(data.ownerId);
  const id = newId();
  const createdAt = new Date();

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`training-curriculum:${data.code}`}))`);
    const [existing] = await tx.select({ id: trainingCurricula.id }).from(trainingCurricula).where(eq(trainingCurricula.code, data.code)).limit(1);
    if (existing) throw new Error("A curriculum with this code already exists");
    const [created] = await tx.insert(trainingCurricula).values({
      id,
      code: data.code,
      serviceId: data.serviceId,
      title: data.title,
      status: data.status,
      ownerId: data.ownerId || null,
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
    entityType: "training_curriculum",
    entityId: result?.id || id,
    entityLabel: data.code,
    summary: `Created Driver Training curriculum ${data.code}: ${data.title}`,
    after: result,
  });
  refreshCurriculumPaths();
}

export async function createTrainingCurriculumVersion(formData: FormData) {
  const actor = await requireTrainingManager();
  const parsed = trainingCurriculumVersionSchema.safeParse({
    curriculumId: field(formData, "curriculumId"),
    versionNumber: field(formData, "versionNumber"),
    effectiveFrom: field(formData, "effectiveFrom"),
    reviewDueDate: field(formData, "reviewDueDate"),
    totalHours: field(formData, "totalHours"),
    theoryPassMark: field(formData, "theoryPassMark"),
    practicalPassMark: field(formData, "practicalPassMark"),
    minimumAttendanceMinutes: field(formData, "minimumAttendanceMinutes") || "0",
    learningObjectives: field(formData, "learningObjectives"),
    competencies: field(formData, "competencies"),
    modules: field(formData, "modules"),
    changeSummary: field(formData, "changeSummary"),
  });
  if (!parsed.success) throw new Error(trainingCurriculumValidationMessage(parsed.error));
  const data = parsed.data;
  const id = newId();
  const createdAt = new Date();

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`training-curriculum-version:${data.curriculumId}`}))`);
    const [curriculum] = await tx.select().from(trainingCurricula).where(eq(trainingCurricula.id, data.curriculumId)).limit(1);
    if (!curriculum) throw new Error("Training curriculum not found");
    if (curriculum.status !== "active") throw new Error("Versions can only be added to active curricula");
    const [duplicate] = await tx
      .select({ id: trainingCurriculumVersions.id })
      .from(trainingCurriculumVersions)
      .where(and(eq(trainingCurriculumVersions.curriculumId, data.curriculumId), eq(trainingCurriculumVersions.versionNumber, data.versionNumber)))
      .limit(1);
    if (duplicate) throw new Error("This curriculum version already exists");
    const [created] = await tx.insert(trainingCurriculumVersions).values({
      id,
      curriculumId: data.curriculumId,
      versionNumber: data.versionNumber,
      status: "draft",
      effectiveFrom: data.effectiveFrom,
      reviewDueDate: data.reviewDueDate,
      totalHours: data.totalHours.toFixed(2),
      theoryPassMark: data.theoryPassMark,
      practicalPassMark: data.practicalPassMark,
      minimumAttendanceMinutes: data.minimumAttendanceMinutes,
      learningObjectives: data.learningObjectives,
      competencies: data.competencies,
      modules: data.modules,
      changeSummary: data.changeSummary || null,
      createdBy: actor.id,
      createdAt,
      updatedAt: createdAt,
    }).returning();
    return { curriculum, created };
  });

  await logAudit({
    userId: actor.id,
    userName: actor.name,
    action: "create",
    entityType: "training_curriculum_version",
    entityId: result.created?.id || id,
    entityLabel: `${result.curriculum.code} v${data.versionNumber}`,
    summary: `Created draft curriculum version ${result.curriculum.code} v${data.versionNumber}`,
    after: result.created,
  });
  refreshCurriculumPaths();
}

export async function approveTrainingCurriculumVersion(formData: FormData) {
  const actor = await requireTrainingManager();
  const parsed = trainingCurriculumApprovalSchema.safeParse({ versionId: field(formData, "versionId") });
  if (!parsed.success) throw new Error(trainingCurriculumValidationMessage(parsed.error));
  const approvedAt = new Date();

  const result = await db.transaction(async (tx) => {
    const [before] = await tx.select().from(trainingCurriculumVersions).where(eq(trainingCurriculumVersions.id, parsed.data.versionId)).limit(1);
    if (!before) throw new Error("Curriculum version not found");
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`training-curriculum-approval:${before.curriculumId}`}))`);
    if (!canApproveTrainingCurriculumVersion(before)) {
      throw new Error("This draft is not approval-ready or is no longer in draft status");
    }
    const [curriculum] = await tx.select().from(trainingCurricula).where(eq(trainingCurricula.id, before.curriculumId)).limit(1);
    if (!curriculum || curriculum.status !== "active") throw new Error("Only active curricula can have an approved version");

    await tx
      .update(trainingCurriculumVersions)
      .set({ status: "superseded", updatedAt: approvedAt })
      .where(and(eq(trainingCurriculumVersions.curriculumId, before.curriculumId), eq(trainingCurriculumVersions.status, "approved"), ne(trainingCurriculumVersions.id, before.id)));

    const [after] = await tx
      .update(trainingCurriculumVersions)
      .set({ status: "approved", approvedBy: actor.id, approvedAt, updatedAt: approvedAt })
      .where(eq(trainingCurriculumVersions.id, before.id))
      .returning();
    if (!after) throw new Error("Unable to approve curriculum version");
    return { curriculum, before, after };
  });

  await logAudit({
    userId: actor.id,
    userName: actor.name,
    action: "approve",
    entityType: "training_curriculum_version",
    entityId: result.after.id,
    entityLabel: `${result.curriculum.code} v${result.after.versionNumber}`,
    summary: `Approved Driver Training curriculum ${result.curriculum.code} v${result.after.versionNumber}; any prior approved version was superseded`,
    before: result.before,
    after: result.after,
  });
  refreshCurriculumPaths();
}

export async function assignTrainingSessionCurriculum(formData: FormData) {
  const actor = await requireTrainingManager();
  const parsed = trainingSessionCurriculumSchema.safeParse({
    sessionId: field(formData, "sessionId"),
    versionId: field(formData, "versionId"),
  });
  if (!parsed.success) throw new Error(trainingCurriculumValidationMessage(parsed.error));
  const data = parsed.data;
  const assignedAt = new Date();

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`training-session-curriculum:${data.sessionId}`}))`);
    const [session] = await tx.select().from(trainingSessions).where(eq(trainingSessions.id, data.sessionId)).limit(1);
    if (!session) throw new Error("Training session not found");
    const [versionRow] = await tx
      .select({ version: trainingCurriculumVersions, curriculum: trainingCurricula })
      .from(trainingCurriculumVersions)
      .innerJoin(trainingCurricula, eq(trainingCurricula.id, trainingCurriculumVersions.curriculumId))
      .where(eq(trainingCurriculumVersions.id, data.versionId))
      .limit(1);
    if (!versionRow) throw new Error("Curriculum version not found");
    if (!canBindCurriculumToSession(session.status, versionRow.version.status, session.serviceId, versionRow.curriculum.serviceId)) {
      throw new Error("Only a scheduled session can be bound to an approved curriculum version for the same service");
    }

    const [before] = await tx.select().from(trainingSessionCurricula).where(eq(trainingSessionCurricula.sessionId, session.id)).limit(1);
    if (before) {
      const [after] = await tx
        .update(trainingSessionCurricula)
        .set({ curriculumVersionId: data.versionId, assignedBy: actor.id, assignedAt })
        .where(eq(trainingSessionCurricula.id, before.id))
        .returning();
      return { session, curriculum: versionRow.curriculum, version: versionRow.version, before, after, action: "update" as const };
    }
    const [after] = await tx.insert(trainingSessionCurricula).values({
      id: newId(),
      sessionId: session.id,
      curriculumVersionId: data.versionId,
      assignedBy: actor.id,
      assignedAt,
    }).returning();
    return { session, curriculum: versionRow.curriculum, version: versionRow.version, before: null, after, action: "create" as const };
  });

  await logAudit({
    userId: actor.id,
    userName: actor.name,
    action: result.action,
    entityType: "training_session_curriculum",
    entityId: result.after?.id || null,
    entityLabel: result.session.referenceNumber,
    summary: `Bound ${result.session.referenceNumber} to approved curriculum ${result.curriculum.code} v${result.version.versionNumber}`,
    before: result.before,
    after: result.after,
  });
  refreshCurriculumPaths();
}

export async function saveTrainingMatrixRequirement(formData: FormData) {
  const actor = await requireTrainingManager();
  const parsed = trainingMatrixRequirementSchema.safeParse({
    scopeType: field(formData, "scopeType"),
    clientName: field(formData, "clientName"),
    jobRole: field(formData, "jobRole"),
    serviceId: field(formData, "serviceId"),
    recurrenceMonths: field(formData, "recurrenceMonths") || "12",
    minimumLicenseClass: field(formData, "minimumLicenseClass"),
    required: checked(formData, "required"),
    notes: field(formData, "notes"),
  });
  if (!parsed.success) throw new Error(trainingCurriculumValidationMessage(parsed.error));
  const data = parsed.data;
  const requirementKey = buildTrainingMatrixRequirementKey(data);
  const updatedAt = new Date();

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`training-matrix:${requirementKey}`}))`);
    const [before] = await tx.select().from(trainingMatrixRequirements).where(eq(trainingMatrixRequirements.requirementKey, requirementKey)).limit(1);
    const values = {
      scopeType: data.scopeType,
      clientName: data.scopeType === "client" ? data.clientName || null : null,
      jobRole: data.scopeType === "role" ? data.jobRole || null : null,
      serviceId: data.serviceId,
      recurrenceMonths: data.recurrenceMonths,
      minimumLicenseClass: data.minimumLicenseClass || null,
      required: data.required,
      notes: data.notes || null,
      updatedAt,
    } as const;
    if (before) {
      const [after] = await tx.update(trainingMatrixRequirements).set(values).where(eq(trainingMatrixRequirements.id, before.id)).returning();
      return { action: "update" as const, before, after };
    }
    const [after] = await tx.insert(trainingMatrixRequirements).values({
      id: newId(),
      requirementKey,
      createdBy: actor.id,
      createdAt: updatedAt,
      ...values,
    }).returning();
    return { action: "create" as const, before: null, after };
  });

  await logAudit({
    userId: actor.id,
    userName: actor.name,
    action: result.action,
    entityType: "training_matrix_requirement",
    entityId: result.after?.id || null,
    entityLabel: requirementKey,
    summary: `${result.action === "create" ? "Created" : "Updated"} Driver Training matrix requirement for ${data.scopeType} scope and ${data.serviceId}`,
    before: result.before,
    after: result.after,
  });
  refreshCurriculumPaths();
}
