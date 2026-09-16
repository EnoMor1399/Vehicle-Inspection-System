import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { trainingAssessments, trainingCertificates, trainingParticipants } from "@/db/training-schema";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { canManageTraining } from "@/lib/training-access";
import { isPrivateBlobStorageConfigured, putPrivateBlob } from "@/lib/private-blob-storage";
import { newId } from "@/lib/utils";
import {
  buildWrittenExamDocumentName,
  isWrittenExamEvidenceType,
  validateWrittenExamFileMetadata,
  validateWrittenExamFileSignature,
  writtenExamBlobPath,
  writtenExamEvidenceLabel,
  WRITTEN_EXAM_OWNER_TYPE,
} from "@/lib/written-exam-evidence";

export const runtime = "nodejs";

function failure(error: string, status: number) {
  return Response.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let user: Awaited<ReturnType<typeof getCurrentUser>>;
  try {
    user = await getCurrentUser();
  } catch {
    return failure("Authentication required", 401);
  }

  if (!canManageTraining(user)) return failure("You do not have permission to upload written exam evidence", 403);
  if (!isPrivateBlobStorageConfigured()) {
    return failure("Private document storage is not configured for this VIMS environment", 503);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return failure("Unable to read the written exam upload", 400);
  }

  const assessmentIdValue = formData.get("assessmentId");
  const evidenceTypeValue = formData.get("evidenceType");
  const fileValue = formData.get("file");
  const assessmentId = typeof assessmentIdValue === "string" ? assessmentIdValue.trim().slice(0, 36) : "";
  const evidenceType = typeof evidenceTypeValue === "string" ? evidenceTypeValue.trim() : "";

  if (!assessmentId) return failure("Select an assessment record", 400);
  if (!isWrittenExamEvidenceType(evidenceType)) return failure("Select a valid written exam evidence type", 400);
  if (!(fileValue instanceof File)) return failure("Select a written exam file", 400);

  const metadataError = validateWrittenExamFileMetadata(fileValue);
  if (metadataError) return failure(metadataError, 400);
  const signatureError = await validateWrittenExamFileSignature(fileValue);
  if (signatureError) return failure(signatureError, 400);

  const [assessment] = await db
    .select({
      id: trainingAssessments.id,
      participantId: trainingAssessments.participantId,
      sessionId: trainingAssessments.sessionId,
      participantName: trainingParticipants.fullName,
    })
    .from(trainingAssessments)
    .innerJoin(trainingParticipants, eq(trainingParticipants.id, trainingAssessments.participantId))
    .where(eq(trainingAssessments.id, assessmentId))
    .limit(1);
  if (!assessment) return failure("Driver assessment not found", 404);

  const [latestAssessment] = await db
    .select({ id: trainingAssessments.id })
    .from(trainingAssessments)
    .where(eq(trainingAssessments.participantId, assessment.participantId))
    .orderBy(desc(trainingAssessments.assessedAt), desc(trainingAssessments.createdAt))
    .limit(1);
  if (!latestAssessment || latestAssessment.id !== assessment.id) {
    return failure("Written exam evidence must be uploaded against the driver's latest assessment", 409);
  }

  const [activeCertificate] = await db
    .select({ certificateNumber: trainingCertificates.certificateNumber })
    .from(trainingCertificates)
    .where(and(
      eq(trainingCertificates.participantId, assessment.participantId),
      eq(trainingCertificates.sessionId, assessment.sessionId),
      eq(trainingCertificates.status, "active"),
    ))
    .limit(1);
  if (activeCertificate) {
    return failure(`Written exam evidence cannot be changed after active certificate ${activeCertificate.certificateNumber} has been issued`, 409);
  }

  const pathname = writtenExamBlobPath(assessment.id, evidenceType, fileValue.name);
  let blob;
  try {
    blob = await putPrivateBlob(pathname, fileValue, fileValue.type);
  } catch (error) {
    console.error("[written-exams] private upload failed", error);
    return failure("The written exam file could not be stored securely. Please try again.", 502);
  }

  const documentId = newId();
  const documentName = buildWrittenExamDocumentName(evidenceType, fileValue.name);
  try {
    await db.insert(documents).values({
      id: documentId,
      ownerType: WRITTEN_EXAM_OWNER_TYPE,
      ownerId: assessment.id,
      name: documentName,
      type: "other",
      url: blob.url,
      mimeType: fileValue.type,
      sizeBytes: fileValue.size,
      uploadedBy: user.id,
    });
  } catch (error) {
    console.error("[written-exams] document registry persistence failed", error);
    return failure("The file was stored but VIMS could not register the document. Contact an administrator before retrying.", 500);
  }

  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "create",
    entityType: "training_written_exam_document",
    entityId: documentId,
    entityLabel: assessment.participantName,
    summary: `Uploaded ${writtenExamEvidenceLabel(evidenceType)} evidence`,
    after: {
      assessmentId: assessment.id,
      evidenceType,
      fileName: documentName,
      mimeType: fileValue.type,
      sizeBytes: fileValue.size,
      storage: "private_blob",
    },
  });

  revalidatePath("/driver-training/assessments/written-exams");
  revalidatePath(`/driver-training/assessments/${assessment.id}`);

  return Response.json(
    { ok: true, document: { id: documentId, name: documentName, sizeBytes: fileValue.size } },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
