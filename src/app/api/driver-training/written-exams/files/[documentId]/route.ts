import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { trainingAssessments } from "@/db/training-schema";
import { getCurrentUser } from "@/lib/auth";
import { fetchPrivateBlob } from "@/lib/private-blob-storage";
import { canViewTraining } from "@/lib/training-access";
import {
  isWrittenExamDocumentName,
  writtenExamOriginalFilename,
  WRITTEN_EXAM_OWNER_TYPE,
} from "@/lib/written-exam-evidence";

export const runtime = "nodejs";

function failure(error: string, status: number) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

function contentDisposition(filename: string, download: boolean) {
  const ascii = filename.replace(/[^a-zA-Z0-9._ -]/g, "_").replace(/["\\]/g, "_") || "written-exam-document";
  return `${download ? "attachment" : "inline"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  let user: Awaited<ReturnType<typeof getCurrentUser>>;
  try {
    user = await getCurrentUser();
  } catch {
    return failure("Authentication required", 401);
  }
  if (!canViewTraining(user)) return failure("You do not have access to Driver Training documents", 403);

  const { documentId } = await context.params;
  if (!documentId || documentId.length > 36) return failure("Document not found", 404);

  const [document] = await db
    .select({
      id: documents.id,
      ownerId: documents.ownerId,
      name: documents.name,
      url: documents.url,
      mimeType: documents.mimeType,
      sizeBytes: documents.sizeBytes,
    })
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.ownerType, WRITTEN_EXAM_OWNER_TYPE)))
    .limit(1);

  if (!document || !isWrittenExamDocumentName(document.name)) return failure("Document not found", 404);

  const [assessment] = await db
    .select({ id: trainingAssessments.id })
    .from(trainingAssessments)
    .where(eq(trainingAssessments.id, document.ownerId))
    .limit(1);
  if (!assessment) return failure("Assessment record not found", 404);

  let upstream: Response;
  try {
    upstream = await fetchPrivateBlob(document.url);
  } catch (error) {
    console.error("[written-exams] private document retrieval failed", error);
    return failure("The written exam document is temporarily unavailable", 502);
  }

  const download = new URL(request.url).searchParams.get("download") === "1";
  const filename = writtenExamOriginalFilename(document.name);
  const headers = new Headers({
    "Cache-Control": "private, no-store, max-age=0",
    "Content-Disposition": contentDisposition(filename, download),
    "Content-Type": document.mimeType || upstream.headers.get("content-type") || "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
  });
  const contentLength = upstream.headers.get("content-length");
  if (contentLength) headers.set("Content-Length", contentLength);

  return new Response(upstream.body, { status: 200, headers });
}
