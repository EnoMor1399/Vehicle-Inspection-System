"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { trainingSessions } from "@/db/training-schema";
import { trainingInstructorProfiles, trainingSessionReadiness } from "@/db/training-readiness-schema";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { canManageTraining, canServeAsInternalTrainingInstructor } from "@/lib/training-access";
import {
  evaluateTrainingReadiness,
  instructorDeploymentState,
  trainingInstructorProfileSchema,
  trainingReadinessValidationMessage,
  trainingSessionReadinessSchema,
} from "@/lib/training-readiness-policy";
import { newId } from "@/lib/utils";

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function checked(formData: FormData, name: string) {
  return formData.has(name);
}

function refreshReadinessPaths() {
  revalidatePath("/driver-training");
  revalidatePath("/driver-training/instructors");
  revalidatePath("/driver-training/readiness");
  revalidatePath("/driver-training/sessions");
}

async function requireTrainingManager() {
  const user = await getCurrentUser();
  if (!canManageTraining(user)) {
    throw new Error("You do not have permission to manage Driver Training instructor or readiness records");
  }
  return user;
}

export async function saveTrainingInstructorProfile(formData: FormData) {
  const actor = await requireTrainingManager();
  const parsed = trainingInstructorProfileSchema.safeParse({
    userId: field(formData, "userId"),
    status: field(formData, "status") || "active",
    specialties: field(formData, "specialties"),
    driverLicenseNumber: field(formData, "driverLicenseNumber"),
    driverLicenseExpiry: field(formData, "driverLicenseExpiry"),
    trainerCertification: field(formData, "trainerCertification"),
    trainerCertificationExpiry: field(formData, "trainerCertificationExpiry"),
    firstAidExpiry: field(formData, "firstAidExpiry"),
    medicalFitnessExpiry: field(formData, "medicalFitnessExpiry"),
    notes: field(formData, "notes"),
  });
  if (!parsed.success) throw new Error(trainingReadinessValidationMessage(parsed.error));
  const data = parsed.data;

  const [account] = await db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      permissions: users.permissions,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.id, data.userId))
    .limit(1);
  if (!account || !canServeAsInternalTrainingInstructor(account)) {
    throw new Error("Internal Instructor profiles can only be assigned to active Driver Training & Assessment users");
  }

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${data.userId}))`);
    const [before] = await tx
      .select()
      .from(trainingInstructorProfiles)
      .where(eq(trainingInstructorProfiles.userId, data.userId))
      .limit(1);

    const values = {
      status: data.status,
      specialties: data.specialties,
      driverLicenseNumber: data.driverLicenseNumber || null,
      driverLicenseExpiry: data.driverLicenseExpiry || null,
      trainerCertification: data.trainerCertification || null,
      trainerCertificationExpiry: data.trainerCertificationExpiry || null,
      firstAidExpiry: data.firstAidExpiry || null,
      medicalFitnessExpiry: data.medicalFitnessExpiry || null,
      notes: data.notes || null,
      updatedAt: new Date(),
    } as const;

    if (before) {
      const [updated] = await tx
        .update(trainingInstructorProfiles)
        .set(values)
        .where(eq(trainingInstructorProfiles.id, before.id))
        .returning();
      return { action: "update" as const, before, after: updated };
    }

    const id = newId();
    const instructorCode = `DTI-${new Date().getUTCFullYear()}-${id.slice(0, 8).toUpperCase()}`;
    const [created] = await tx
      .insert(trainingInstructorProfiles)
      .values({
        id,
        userId: data.userId,
        instructorCode,
        createdBy: actor.id,
        ...values,
      })
      .returning();
    return { action: "create" as const, before: null, after: created };
  });

  await logAudit({
    userId: actor.id,
    userName: actor.name,
    action: result.action,
    entityType: "training_instructor_profile",
    entityId: result.after?.id || null,
    entityLabel: account.name,
    summary: `${result.action === "create" ? "Created" : "Updated"} Driver Training instructor profile for ${account.name}`,
    before: result.before,
    after: result.after,
  });
  refreshReadinessPaths();
}

export async function saveTrainingSessionReadiness(formData: FormData) {
  const actor = await requireTrainingManager();
  const parsed = trainingSessionReadinessSchema.safeParse({
    sessionId: field(formData, "sessionId"),
    instructorConfirmed: checked(formData, "instructorConfirmed"),
    venueConfirmed: checked(formData, "venueConfirmed"),
    vehicleEquipmentReady: checked(formData, "vehicleEquipmentReady"),
    trainingMaterialsReady: checked(formData, "trainingMaterialsReady"),
    participantListConfirmed: checked(formData, "participantListConfirmed"),
    riskAssessmentComplete: checked(formData, "riskAssessmentComplete"),
    emergencyPlanConfirmed: checked(formData, "emergencyPlanConfirmed"),
    clientConfirmationReceived: checked(formData, "clientConfirmationReceived"),
    blockers: field(formData, "blockers"),
    notes: field(formData, "notes"),
  });
  if (!parsed.success) throw new Error(trainingReadinessValidationMessage(parsed.error));
  const data = parsed.data;

  const [session] = await db
    .select()
    .from(trainingSessions)
    .where(eq(trainingSessions.id, data.sessionId))
    .limit(1);
  if (!session) throw new Error("Training session not found");
  if (session.status === "completed" || session.status === "cancelled") {
    throw new Error("Readiness can only be reviewed for scheduled or in-progress sessions");
  }

  if (data.instructorConfirmed) {
    if (!session.instructorId) {
      throw new Error("Assign an internal instructor before confirming instructor readiness");
    }
    const [[account], [profile]] = await Promise.all([
      db
        .select({ role: users.role, permissions: users.permissions, isActive: users.isActive })
        .from(users)
        .where(eq(users.id, session.instructorId))
        .limit(1),
      db
        .select()
        .from(trainingInstructorProfiles)
        .where(eq(trainingInstructorProfiles.userId, session.instructorId))
        .limit(1),
    ]);
    if (!account || !canServeAsInternalTrainingInstructor(account) || !profile || profile.status !== "active") {
      throw new Error("The assigned Internal Instructor is not an active Driver Training & Assessment instructor");
    }
    const deploymentState = instructorDeploymentState(profile);
    if (["unavailable", "blocked", "incomplete"].includes(deploymentState)) {
      throw new Error(`The assigned instructor is not deployment-ready (${deploymentState})`);
    }
  }

  const evaluation = evaluateTrainingReadiness(data);
  const reviewedAt = new Date();
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${data.sessionId}))`);
    const [before] = await tx
      .select()
      .from(trainingSessionReadiness)
      .where(eq(trainingSessionReadiness.sessionId, data.sessionId))
      .limit(1);
    const values = {
      status: evaluation.status,
      instructorConfirmed: data.instructorConfirmed,
      venueConfirmed: data.venueConfirmed,
      vehicleEquipmentReady: data.vehicleEquipmentReady,
      trainingMaterialsReady: data.trainingMaterialsReady,
      participantListConfirmed: data.participantListConfirmed,
      riskAssessmentComplete: data.riskAssessmentComplete,
      emergencyPlanConfirmed: data.emergencyPlanConfirmed,
      clientConfirmationReceived: data.clientConfirmationReceived,
      blockers: data.blockers,
      notes: data.notes || null,
      reviewedBy: actor.id,
      reviewedAt,
      updatedAt: reviewedAt,
    } as const;

    if (before) {
      const [updated] = await tx
        .update(trainingSessionReadiness)
        .set(values)
        .where(eq(trainingSessionReadiness.id, before.id))
        .returning();
      return { action: "update" as const, before, after: updated };
    }

    const [created] = await tx
      .insert(trainingSessionReadiness)
      .values({ id: newId(), sessionId: data.sessionId, ...values })
      .returning();
    return { action: "create" as const, before: null, after: created };
  });

  await logAudit({
    userId: actor.id,
    userName: actor.name,
    action: result.action,
    entityType: "training_session_readiness",
    entityId: result.after?.id || null,
    entityLabel: session.referenceNumber,
    summary: `Reviewed training readiness for ${session.referenceNumber}: ${evaluation.status} (${evaluation.completed}/${evaluation.total})`,
    before: result.before,
    after: result.after,
  });
  refreshReadinessPaths();
}