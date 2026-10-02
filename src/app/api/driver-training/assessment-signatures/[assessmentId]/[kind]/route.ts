import { eq } from "drizzle-orm";
import { db } from "@/db";
import { trainingAssessments } from "@/db/training-schema";
import { getCurrentUser } from "@/lib/auth";
import {
  decodePngSignatureDataUrl,
  type AssessmentSignatureKind,
} from "@/lib/assessment-signature-storage";
import { fetchPrivateBlob } from "@/lib/private-blob-storage";
import { canViewTraining } from "@/lib/training-access";

export const runtime = "nodejs";

function failure(error: string, status: number) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ assessmentId: string; kind: string }> },
) {
  let user: Awaited<ReturnType<typeof getCurrentUser>>;
  try {
    user = await getCurrentUser();
  } catch {
    return failure("Authentication required", 401);
  }
  if (!canViewTraining(user)) return failure("Driver Training access required", 403);

  const { assessmentId, kind: rawKind } = await context.params;
  const kind = rawKind as AssessmentSignatureKind;
  if (!assessmentId || assessmentId.length > 36 || (kind !== "assessor" && kind !== "reviewer")) {
    return failure("Signature not found", 404);
  }

  const [assessment] = await db
    .select({
      assessorSignature: trainingAssessments.assessorSignature,
      reviewerSignature: trainingAssessments.reviewerSignature,
    })
    .from(trainingAssessments)
    .where(eq(trainingAssessments.id, assessmentId))
    .limit(1);

  const storedValue = kind === "assessor" ? assessment?.assessorSignature : assessment?.reviewerSignature;
  if (!storedValue) return failure("Signature not found", 404);

  const headers = new Headers({
    "Cache-Control": "private, no-store, max-age=0",
    "Content-Type": "image/png",
    "Content-Disposition": "inline",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
  });

  if (storedValue.startsWith("data:")) {
    const bytes = decodePngSignatureDataUrl(storedValue);
    if (!bytes) return failure("Stored signature is invalid", 500);
    return new Response(bytes, { status: 200, headers });
  }

  try {
    const upstream = await fetchPrivateBlob(storedValue, {
      oidcToken: request.headers.get("x-vercel-oidc-token"),
    });
    return new Response(upstream.body, { status: 200, headers });
  } catch (error) {
    console.error("[assessment-signature] private retrieval failed", error);
    return failure("Signature is temporarily unavailable", 502);
  }
}
