"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { trainingCertificates, trainingParticipants } from "@/db/training-schema";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { canManageTraining } from "@/lib/training-access";
import { trainingCertificateRevocationSchema, trainingValidationMessage } from "@/lib/training-policy";

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function revokeTrainingCertificate(formData: FormData) {
  const user = await getCurrentUser();
  if (!canManageTraining(user)) {
    throw new Error("You do not have permission to manage Driver Training certificates");
  }

  const parsed = trainingCertificateRevocationSchema.safeParse({
    certificateId: field(formData, "certificateId"),
    reason: field(formData, "reason"),
  });
  if (!parsed.success) throw new Error(trainingValidationMessage(parsed.error));
  const data = parsed.data;

  const result = await db.transaction(async (tx) => {
    const [certificate] = await tx
      .select({
        id: trainingCertificates.id,
        certificateNumber: trainingCertificates.certificateNumber,
        status: trainingCertificates.status,
        participantId: trainingCertificates.participantId,
        revokedAt: trainingCertificates.revokedAt,
        revocationReason: trainingCertificates.revocationReason,
      })
      .from(trainingCertificates)
      .where(eq(trainingCertificates.id, data.certificateId))
      .limit(1);
    if (!certificate) return { ok: false as const, error: "Training certificate not found" };
    if (certificate.status === "revoked") {
      return { ok: false as const, error: "Training certificate is already revoked" };
    }

    const [participant] = await tx
      .select({ fullName: trainingParticipants.fullName })
      .from(trainingParticipants)
      .where(eq(trainingParticipants.id, certificate.participantId))
      .limit(1);

    const revokedAt = new Date();
    await tx
      .update(trainingCertificates)
      .set({
        status: "revoked",
        revokedAt,
        revocationReason: data.reason,
      })
      .where(eq(trainingCertificates.id, certificate.id));

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
    before: {
      status: result.certificate.status,
      revokedAt: result.certificate.revokedAt,
      revocationReason: result.certificate.revocationReason,
    },
    after: {
      status: "revoked",
      revokedAt: result.revokedAt,
      revocationReason: data.reason,
      participant: result.participant?.fullName || null,
    },
  });

  revalidatePath("/driver-training");
  revalidatePath("/driver-training/certificates");
  revalidatePath("/driver-training/analytics");
}
