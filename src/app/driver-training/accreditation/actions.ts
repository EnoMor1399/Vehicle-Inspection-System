"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  trainingAccreditationRecords,
  trainingRegulatoryRequirements,
  trainingSessionComplianceReviews,
} from "@/db/training-accreditation-schema";
import { trainingSessions } from "@/db/training-schema";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { canManageTraining } from "@/lib/training-access";
import {
  evaluateTrainingRegulatoryCompliance,
  trainingAccreditationDecisionSchema,
  trainingAccreditationRecordSchema,
  trainingAccreditationValidationMessage,
  trainingRegulatoryRequirementSchema,
  trainingSessionComplianceReviewSchema,
} from "@/lib/training-accreditation-policy";
import { newId } from "@/lib/utils";

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function refreshAccreditationPaths() {
  revalidatePath("/driver-training");
  revalidatePath("/driver-training/accreditation");
  revalidatePath("/driver-training/sessions");
  revalidatePath("/driver-training/readiness");
}

async function requireTrainingManager() {
  const user = await getCurrentUser();
  if (!canManageTraining(user)) throw new Error("You do not have permission to manage Driver Training accreditation records");
  return user;
}

export async function createTrainingRegulatoryRequirement(formData: FormData) {
  const user = await requireTrainingManager();
  const parsed = trainingRegulatoryRequirementSchema.safeParse({
    requirementCode: field(formData, "requirementCode"),
    serviceId: field(formData, "serviceId"),
    title: field(formData, "title"),
    authority: field(formData, "authority"),
    standardReference: field(formData, "standardReference"),
    requirementType: field(formData, "requirementType"),
    mandatory: formData.has("mandatory"),
    status: field(formData, "status") || "active",
    reviewDueDate: field(formData, "reviewDueDate"),
    notes: field(formData, "notes"),
  });
  if (!parsed.success) throw new Error(trainingAccreditationValidationMessage(parsed.error));
  const data = parsed.data;
  const id = newId();
  const values = {
    id,
    requirementCode: data.requirementCode,
    serviceId: data.serviceId || null,
    title: data.title,
    authority: data.authority,
    standardReference: data.standardReference || null,
    requirementType: data.requirementType,
    mandatory: data.mandatory,
    status: data.status,
    reviewDueDate: data.reviewDueDate || null,
    notes: data.notes || null,
    createdBy: user.id,
    updatedAt: new Date(),
  } as const;
  await db.insert(trainingRegulatoryRequirements).values(values);
  await logAudit({ userId: user.id, userName: user.name, action: "create", entityType: "training_regulatory_requirement", entityId: id, entityLabel: data.requirementCode, summary: `Created Driver Training regulatory requirement ${data.requirementCode}`, after: values });
  refreshAccreditationPaths();
}

export async function setTrainingRegulatoryRequirementStatus(formData: FormData) {
  const user = await requireTrainingManager();
  const requirementId = field(formData, "requirementId");
  const status = field(formData, "status");
  if (!/^[0-9a-f-]{36}$/i.test(requirementId) || !["active", "inactive"].includes(status)) throw new Error("Invalid regulatory requirement status change");
  const [before] = await db.select().from(trainingRegulatoryRequirements).where(eq(trainingRegulatoryRequirements.id, requirementId)).limit(1);
  if (!before) throw new Error("Regulatory requirement not found");
  await db.update(trainingRegulatoryRequirements).set({ status, updatedAt: new Date() }).where(eq(trainingRegulatoryRequirements.id, requirementId));
  await logAudit({ userId: user.id, userName: user.name, action: "update", entityType: "training_regulatory_requirement", entityId: before.id, entityLabel: before.requirementCode, summary: `Changed regulatory requirement to ${status}`, before: { status: before.status }, after: { status } });
  refreshAccreditationPaths();
}

export async function createTrainingAccreditationRecord(formData: FormData) {
  const user = await requireTrainingManager();
  const parsed = trainingAccreditationRecordSchema.safeParse({
    requirementId: field(formData, "requirementId"),
    credentialNumber: field(formData, "credentialNumber"),
    issuingAuthority: field(formData, "issuingAuthority"),
    issuedDate: field(formData, "issuedDate"),
    validFrom: field(formData, "validFrom"),
    validUntil: field(formData, "validUntil"),
    evidenceReference: field(formData, "evidenceReference"),
  });
  if (!parsed.success) throw new Error(trainingAccreditationValidationMessage(parsed.error));
  const data = parsed.data;
  const [requirement] = await db.select().from(trainingRegulatoryRequirements).where(eq(trainingRegulatoryRequirements.id, data.requirementId)).limit(1);
  if (!requirement) throw new Error("Regulatory requirement not found");
  if (requirement.status !== "active") throw new Error("Accreditation evidence can only be added to an active requirement");
  const id = newId();
  const values = {
    id,
    requirementId: requirement.id,
    credentialNumber: data.credentialNumber || null,
    issuingAuthority: data.issuingAuthority,
    issuedDate: data.issuedDate || null,
    validFrom: data.validFrom,
    validUntil: data.validUntil || null,
    evidenceReference: data.evidenceReference,
    status: "pending",
    createdBy: user.id,
    updatedAt: new Date(),
  } as const;
  await db.insert(trainingAccreditationRecords).values(values);
  await logAudit({ userId: user.id, userName: user.name, action: "create", entityType: "training_accreditation", entityId: id, entityLabel: requirement.requirementCode, summary: `Added accreditation evidence for ${requirement.requirementCode}`, after: values });
  refreshAccreditationPaths();
}

export async function decideTrainingAccreditationRecord(formData: FormData) {
  const user = await requireTrainingManager();
  const parsed = trainingAccreditationDecisionSchema.safeParse({
    accreditationId: field(formData, "accreditationId"),
    status: field(formData, "status"),
    verificationNotes: field(formData, "verificationNotes"),
  });
  if (!parsed.success) throw new Error(trainingAccreditationValidationMessage(parsed.error));
  const data = parsed.data;
  if ((data.status === "rejected" || data.status === "revoked") && !data.verificationNotes) throw new Error(`${data.status === "rejected" ? "Rejection" : "Revocation"} requires verification notes`);

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${data.accreditationId}))`);
    const [record] = await tx.select().from(trainingAccreditationRecords).where(eq(trainingAccreditationRecords.id, data.accreditationId)).limit(1);
    if (!record) return { ok: false as const, error: "Accreditation record not found" };
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`training-accreditation:${record.requirementId}`}))`);
    const allowed = record.status === "pending"
      ? ["verified", "rejected"].includes(data.status)
      : record.status === "verified"
        ? ["revoked", "superseded"].includes(data.status)
        : false;
    if (!allowed) return { ok: false as const, error: `Accreditation record cannot move from ${record.status} to ${data.status}` };

    const now = new Date();
    if (data.status === "verified") {
      await tx.update(trainingAccreditationRecords).set({ status: "superseded", updatedAt: now }).where(and(
        eq(trainingAccreditationRecords.requirementId, record.requirementId),
        eq(trainingAccreditationRecords.status, "verified"),
      ));
    }
    const patch = {
      status: data.status,
      verificationNotes: data.verificationNotes || record.verificationNotes,
      verifiedBy: data.status === "verified" ? user.id : record.verifiedBy,
      verifiedAt: data.status === "verified" ? now : record.verifiedAt,
      updatedAt: now,
    } as const;
    await tx.update(trainingAccreditationRecords).set(patch).where(eq(trainingAccreditationRecords.id, record.id));
    return { ok: true as const, record, patch };
  });
  if (!result.ok) throw new Error(result.error);
  await logAudit({ userId: user.id, userName: user.name, action: data.status === "verified" ? "approve" : data.status === "rejected" ? "reject" : "update", entityType: "training_accreditation", entityId: result.record.id, entityLabel: result.record.credentialNumber || result.record.id, summary: `Changed accreditation evidence from ${result.record.status} to ${data.status}`, before: { status: result.record.status }, after: { status: data.status, verificationNotes: data.verificationNotes || null } });
  refreshAccreditationPaths();
}

export async function reviewTrainingSessionRegulatoryCompliance(formData: FormData) {
  const user = await requireTrainingManager();
  const parsed = trainingSessionComplianceReviewSchema.safeParse({ sessionId: field(formData, "sessionId"), notes: field(formData, "notes") });
  if (!parsed.success) throw new Error(trainingAccreditationValidationMessage(parsed.error));
  const data = parsed.data;

  const [session] = await db.select().from(trainingSessions).where(eq(trainingSessions.id, data.sessionId)).limit(1);
  if (!session) throw new Error("Training session not found");
  if (!["scheduled", "in_progress"].includes(session.status)) throw new Error("Regulatory compliance review is only available for scheduled or in-progress sessions");
  const [requirements, accreditations] = await Promise.all([
    db.select().from(trainingRegulatoryRequirements),
    db.select().from(trainingAccreditationRecords),
  ]);
  const evaluation = evaluateTrainingRegulatoryCompliance(session.serviceId, requirements, accreditations);
  const now = new Date();
  const [existing] = await db.select().from(trainingSessionComplianceReviews).where(eq(trainingSessionComplianceReviews.sessionId, session.id)).limit(1);
  const values = { status: evaluation.ready ? "ready" : "blocked", blockers: evaluation.blockers, reviewedBy: user.id, reviewedAt: now, notes: data.notes || null, updatedAt: now } as const;
  if (existing) await db.update(trainingSessionComplianceReviews).set(values).where(eq(trainingSessionComplianceReviews.id, existing.id));
  else await db.insert(trainingSessionComplianceReviews).values({ id: newId(), sessionId: session.id, ...values });

  await logAudit({ userId: user.id, userName: user.name, action: "review", entityType: "training_session_compliance", entityId: session.id, entityLabel: session.referenceNumber, summary: `Reviewed regulatory compliance: ${evaluation.ready ? "ready" : "blocked"}`, after: { ...values, applicableRequirements: evaluation.applicableCount } });
  refreshAccreditationPaths();
}
