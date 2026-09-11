"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, max, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { trainingParticipants, trainingSessions } from "@/db/training-schema";
import { trainingRiskAssessments, trainingSafetyHazards, trainingSafetyIncidents } from "@/db/training-safety-schema";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { canManageTraining } from "@/lib/training-access";
import {
  calculateTrainingSafetyRiskScore,
  canApproveTrainingRiskAssessment,
  canTransitionTrainingSafetyIncident,
  safetyIncidentRequiresStopWork,
  trainingRiskAssessmentSchema,
  trainingRiskAssessmentTransitionSchema,
  trainingSafetyHazardSchema,
  trainingSafetyIncidentClosureReady,
  trainingSafetyIncidentSchema,
  trainingSafetyIncidentTransitionSchema,
  trainingSafetyRiskLevel,
  trainingSafetyValidationMessage,
} from "@/lib/training-safety-policy";
import { newId } from "@/lib/utils";

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function refreshSafetyPaths() {
  revalidatePath("/driver-training");
  revalidatePath("/driver-training/safety");
  revalidatePath("/driver-training/readiness");
}

async function requireTrainingManager() {
  const user = await getCurrentUser();
  if (!canManageTraining(user)) throw new Error("You do not have permission to manage Driver Training & Assessment records");
  return user;
}

async function validateInternalOwner(ownerId?: string) {
  if (!ownerId) return;
  const [owner] = await db
    .select({ id: users.id, isActive: users.isActive, role: users.role })
    .from(users)
    .where(and(eq(users.id, ownerId), ne(users.role, "transporter_user")))
    .limit(1);
  if (!owner?.isActive) throw new Error("Safety action owners must be active internal VIMS users");
}

export async function createTrainingRiskAssessment(formData: FormData) {
  const user = await requireTrainingManager();
  const parsed = trainingRiskAssessmentSchema.safeParse({
    sessionId: field(formData, "sessionId"),
    activityScope: field(formData, "activityScope"),
    emergencyPlan: field(formData, "emergencyPlan"),
    overallRisk: field(formData, "overallRisk") || "medium",
    notes: field(formData, "notes"),
  });
  if (!parsed.success) throw new Error(trainingSafetyValidationMessage(parsed.error));
  const data = parsed.data;
  const id = newId();

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`training-risk:${data.sessionId}`}))`);
    const [session] = await tx.select().from(trainingSessions).where(eq(trainingSessions.id, data.sessionId)).limit(1);
    if (!session) return { ok: false as const, error: "Training session not found" };
    if (session.status !== "scheduled") return { ok: false as const, error: "Risk assessments can only be created for scheduled training sessions" };
    const [existing] = await tx.select({ id: trainingRiskAssessments.id }).from(trainingRiskAssessments).where(eq(trainingRiskAssessments.sessionId, session.id)).limit(1);
    if (existing) return { ok: false as const, error: "This training session already has a risk assessment" };
    const values = {
      id,
      sessionId: session.id,
      status: "draft",
      overallRisk: data.overallRisk,
      activityScope: data.activityScope,
      emergencyPlan: data.emergencyPlan,
      stopWorkRequired: false,
      notes: data.notes || null,
      assessedBy: user.id,
      assessedAt: new Date(),
      updatedAt: new Date(),
    } as const;
    await tx.insert(trainingRiskAssessments).values(values);
    return { ok: true as const, session, values };
  });
  if (!result.ok) throw new Error(result.error);

  await logAudit({ userId: user.id, userName: user.name, action: "create", entityType: "training_risk_assessment", entityId: id, entityLabel: result.session.referenceNumber, summary: `Created training risk assessment for ${result.session.referenceNumber}`, after: result.values });
  refreshSafetyPaths();
}

export async function addTrainingSafetyHazard(formData: FormData) {
  const user = await requireTrainingManager();
  const parsed = trainingSafetyHazardSchema.safeParse({
    assessmentId: field(formData, "assessmentId"),
    hazard: field(formData, "hazard"),
    consequence: field(formData, "consequence"),
    likelihood: field(formData, "likelihood"),
    severity: field(formData, "severity"),
    controls: field(formData, "controls"),
    residualLikelihood: field(formData, "residualLikelihood"),
    residualSeverity: field(formData, "residualSeverity"),
    status: field(formData, "status") || "controlled",
    ownerId: field(formData, "ownerId"),
  });
  if (!parsed.success) throw new Error(trainingSafetyValidationMessage(parsed.error));
  const data = parsed.data;
  await validateInternalOwner(data.ownerId);
  const initialRiskScore = calculateTrainingSafetyRiskScore(data.likelihood, data.severity);
  const residualRiskScore = calculateTrainingSafetyRiskScore(data.residualLikelihood, data.residualSeverity);
  if (initialRiskScore === null || residualRiskScore === null) throw new Error("Invalid risk score inputs");
  const id = newId();

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`training-risk-assessment:${data.assessmentId}`}))`);
    const [assessment] = await tx.select().from(trainingRiskAssessments).where(eq(trainingRiskAssessments.id, data.assessmentId)).limit(1);
    if (!assessment) return { ok: false as const, error: "Training risk assessment not found" };
    if (!["draft", "blocked"].includes(assessment.status)) return { ok: false as const, error: "Hazards can only be changed while the risk assessment is draft or blocked" };
    const values = {
      id,
      assessmentId: assessment.id,
      hazard: data.hazard,
      consequence: data.consequence,
      likelihood: data.likelihood,
      severity: data.severity,
      initialRiskScore,
      controls: data.controls,
      residualLikelihood: data.residualLikelihood,
      residualSeverity: data.residualSeverity,
      residualRiskScore,
      status: data.status,
      ownerId: data.ownerId || null,
      createdBy: user.id,
      updatedAt: new Date(),
    } as const;
    await tx.insert(trainingSafetyHazards).values(values);
    return { ok: true as const, assessment, values };
  });
  if (!result.ok) throw new Error(result.error);

  await logAudit({ userId: user.id, userName: user.name, action: "create", entityType: "training_safety_hazard", entityId: id, entityLabel: result.assessment.sessionId, summary: `Added ${trainingSafetyRiskLevel(residualRiskScore)} residual-risk hazard`, after: result.values });
  refreshSafetyPaths();
}

export async function transitionTrainingRiskAssessment(formData: FormData) {
  const user = await requireTrainingManager();
  const parsed = trainingRiskAssessmentTransitionSchema.safeParse({ assessmentId: field(formData, "assessmentId"), status: field(formData, "status"), notes: field(formData, "notes") });
  if (!parsed.success) throw new Error(trainingSafetyValidationMessage(parsed.error));
  const data = parsed.data;

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`training-risk-assessment:${data.assessmentId}`}))`);
    const [assessment] = await tx.select().from(trainingRiskAssessments).where(eq(trainingRiskAssessments.id, data.assessmentId)).limit(1);
    if (!assessment) return { ok: false as const, error: "Training risk assessment not found" };
    if (assessment.status === "approved" || assessment.status === "superseded") return { ok: false as const, error: "Approved or superseded risk assessments cannot be changed" };
    const [session] = await tx.select().from(trainingSessions).where(eq(trainingSessions.id, assessment.sessionId)).limit(1);
    if (!session) return { ok: false as const, error: "Training session not found" };

    if (data.status === "blocked") {
      await tx.update(trainingRiskAssessments).set({ status: "blocked", stopWorkRequired: true, notes: data.notes || assessment.notes, updatedAt: new Date() }).where(eq(trainingRiskAssessments.id, assessment.id));
      return { ok: true as const, assessment, session, nextStatus: "blocked" as const };
    }

    const [hazardCount] = await tx.select({ n: count() }).from(trainingSafetyHazards).where(eq(trainingSafetyHazards.assessmentId, assessment.id));
    const [openCount] = await tx.select({ n: count() }).from(trainingSafetyHazards).where(and(eq(trainingSafetyHazards.assessmentId, assessment.id), eq(trainingSafetyHazards.status, "open")));
    const [maxResidual] = await tx.select({ n: max(trainingSafetyHazards.residualRiskScore) }).from(trainingSafetyHazards).where(eq(trainingSafetyHazards.assessmentId, assessment.id));
    const approvalReady = canApproveTrainingRiskAssessment({ sessionStatus: session.status, stopWorkRequired: false, hazardCount: Number(hazardCount?.n || 0), openHazardCount: Number(openCount?.n || 0), maxResidualRiskScore: Number(maxResidual?.n || 0) });
    if (!approvalReady) return { ok: false as const, error: "Risk assessment cannot be approved until hazards are controlled, residual risk is acceptable, and the session remains scheduled" };

    await tx.update(trainingRiskAssessments).set({ status: "approved", stopWorkRequired: false, approvedBy: user.id, approvedAt: new Date(), notes: data.notes || assessment.notes, updatedAt: new Date() }).where(eq(trainingRiskAssessments.id, assessment.id));
    return { ok: true as const, assessment, session, nextStatus: "approved" as const };
  });
  if (!result.ok) throw new Error(result.error);

  await logAudit({ userId: user.id, userName: user.name, action: data.status === "approved" ? "approve" : "update", entityType: "training_risk_assessment", entityId: result.assessment.id, entityLabel: result.session.referenceNumber, summary: `Changed training risk assessment status to ${result.nextStatus}`, before: { status: result.assessment.status, stopWorkRequired: result.assessment.stopWorkRequired }, after: { status: result.nextStatus, stopWorkRequired: result.nextStatus === "blocked" } });
  refreshSafetyPaths();
}

export async function reportTrainingSafetyIncident(formData: FormData) {
  const user = await requireTrainingManager();
  const parsed = trainingSafetyIncidentSchema.safeParse({
    sessionId: field(formData, "sessionId"), participantId: field(formData, "participantId"), incidentType: field(formData, "incidentType"), severity: field(formData, "severity"), occurredAt: field(formData, "occurredAt"), location: field(formData, "location"), description: field(formData, "description"), immediateActions: field(formData, "immediateActions"), stopWork: field(formData, "stopWork"), ownerId: field(formData, "ownerId"),
  });
  if (!parsed.success) throw new Error(trainingSafetyValidationMessage(parsed.error));
  const data = parsed.data;
  await validateInternalOwner(data.ownerId);
  const requiredStopWork = safetyIncidentRequiresStopWork(data.severity, data.incidentType);
  const stopWork = data.stopWork || requiredStopWork;
  const id = newId();
  const incidentNumber = `TSI-${new Date().getUTCFullYear()}-${id.slice(0, 8).toUpperCase()}`;

  const result = await db.transaction(async (tx) => {
    const [session] = await tx.select().from(trainingSessions).where(eq(trainingSessions.id, data.sessionId)).limit(1);
    if (!session) return { ok: false as const, error: "Training session not found" };
    if (session.status === "cancelled") return { ok: false as const, error: "Safety incidents cannot be recorded against a cancelled training session" };
    if (data.participantId) {
      const [participant] = await tx.select({ id: trainingParticipants.id, sessionId: trainingParticipants.sessionId }).from(trainingParticipants).where(eq(trainingParticipants.id, data.participantId)).limit(1);
      if (!participant || participant.sessionId !== session.id) return { ok: false as const, error: "Selected participant does not belong to this training session" };
    }
    const values = {
      id,
      incidentNumber,
      sessionId: session.id,
      participantId: data.participantId || null,
      incidentType: data.incidentType,
      severity: data.severity,
      status: "open",
      occurredAt: data.occurredAt,
      location: data.location || null,
      description: data.description,
      immediateActions: data.immediateActions,
      stopWork,
      ownerId: data.ownerId || null,
      reportedBy: user.id,
      updatedAt: new Date(),
    } as const;
    await tx.insert(trainingSafetyIncidents).values(values);
    return { ok: true as const, session, values };
  });
  if (!result.ok) throw new Error(result.error);

  await logAudit({ userId: user.id, userName: user.name, action: "create", entityType: "training_safety_incident", entityId: id, entityLabel: incidentNumber, summary: `Reported ${data.severity} ${data.incidentType.replaceAll("_", " ")} for ${result.session.referenceNumber}${stopWork ? " with stop-work control" : ""}`, after: result.values });
  refreshSafetyPaths();
}

export async function transitionTrainingSafetyIncident(formData: FormData) {
  const user = await requireTrainingManager();
  const parsed = trainingSafetyIncidentTransitionSchema.safeParse({ incidentId: field(formData, "incidentId"), status: field(formData, "status"), rootCause: field(formData, "rootCause"), correctiveActions: field(formData, "correctiveActions"), evidenceReference: field(formData, "evidenceReference"), closureReview: field(formData, "closureReview") });
  if (!parsed.success) throw new Error(trainingSafetyValidationMessage(parsed.error));
  const data = parsed.data;

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`training-safety-incident:${data.incidentId}`}))`);
    const [incident] = await tx.select().from(trainingSafetyIncidents).where(eq(trainingSafetyIncidents.id, data.incidentId)).limit(1);
    if (!incident) return { ok: false as const, error: "Training safety incident not found" };
    if (!canTransitionTrainingSafetyIncident(incident.status, data.status)) return { ok: false as const, error: `Safety incident cannot move from ${incident.status} to ${data.status}` };

    const merged = {
      rootCause: data.rootCause || incident.rootCause,
      correctiveActions: data.correctiveActions || incident.correctiveActions,
      evidenceReference: data.evidenceReference || incident.evidenceReference,
      closureReview: data.closureReview || incident.closureReview,
    };
    if (data.status === "closed" && !trainingSafetyIncidentClosureReady({ status: incident.status, ...merged })) {
      return { ok: false as const, error: "Incident closure requires verification status, root cause, corrective actions, evidence, and closure review" };
    }
    if (data.status === "verification" && (!merged.rootCause || !merged.correctiveActions)) {
      return { ok: false as const, error: "Root cause and corrective actions are required before verification" };
    }

    const now = new Date();
    const patch = {
      status: data.status,
      ...merged,
      closedBy: data.status === "closed" ? user.id : incident.closedBy,
      closedAt: data.status === "closed" ? now : incident.closedAt,
      updatedAt: now,
    } as const;
    await tx.update(trainingSafetyIncidents).set(patch).where(eq(trainingSafetyIncidents.id, incident.id));
    return { ok: true as const, incident, patch };
  });
  if (!result.ok) throw new Error(result.error);

  await logAudit({ userId: user.id, userName: user.name, action: data.status === "closed" ? "approve" : "update", entityType: "training_safety_incident", entityId: result.incident.id, entityLabel: result.incident.incidentNumber, summary: `Changed safety incident status to ${data.status}`, before: { status: result.incident.status }, after: { status: data.status, rootCause: data.rootCause || undefined, correctiveActions: data.correctiveActions || undefined, evidenceReference: data.evidenceReference || undefined, closureReview: data.closureReview || undefined } });
  refreshSafetyPaths();
}
