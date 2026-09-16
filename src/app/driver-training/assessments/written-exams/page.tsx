import Link from "next/link";
import { and, desc, eq, like } from "drizzle-orm";
import { BookOpenCheck, Calculator, ClipboardCheck, Download, Eye, FileText, ShieldCheck } from "lucide-react";
import { db } from "@/db";
import { documents, users } from "@/db/schema";
import { trainingAssessments, trainingParticipants, trainingSessions } from "@/db/training-schema";
import { Badge, Button, Card, EmptyState, Field, PageHeader, Select, TextInput } from "@/components/ui";
import { requireInternalUser } from "@/lib/require-auth";
import { canManageTraining, canViewTraining } from "@/lib/training-access";
import { calculateAssessmentPerformanceScore } from "@/lib/training-composite-score";
import { isPrivateBlobStorageConfigured } from "@/lib/private-blob-storage";
import { formatDateTime } from "@/lib/utils";
import {
  WRITTEN_EXAM_DOCUMENT_PREFIX,
  WRITTEN_EXAM_OWNER_TYPE,
  writtenExamOriginalFilename,
} from "@/lib/written-exam-evidence";
import { recordWrittenExamScores } from "./actions";
import { WrittenExamEvidenceUpload } from "./WrittenExamEvidenceUpload";

export const dynamic = "force-dynamic";

function score(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "Pending";
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${numeric.toFixed(numeric % 1 === 0 ? 0 : 1)}%` : "Pending";
}

function reviewTone(status: string): "emerald" | "amber" | "red" | "slate" {
  if (status === "approved") return "emerald";
  if (status === "returned") return "red";
  if (status === "pending_review") return "amber";
  return "slate";
}

function fileSize(bytes: number | null) {
  if (!bytes || bytes < 1) return "—";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function evidenceTypeFromName(name: string) {
  const parts = name.split(" · ");
  return parts.length >= 3 ? parts[1] : "Written exam evidence";
}

export default async function WrittenExamScoresPage() {
  const user = await requireInternalUser();
  if (!canViewTraining(user)) {
    return <div className="p-8 text-sm text-slate-600">You do not have access to Driver Training & Assessment Services.</div>;
  }
  const canManage = canManageTraining(user);

  const [assessments, evidenceRows] = await Promise.all([
    db
      .select({
        id: trainingAssessments.id,
        participantId: trainingAssessments.participantId,
        participantName: trainingParticipants.fullName,
        referenceNumber: trainingSessions.referenceNumber,
        assessmentType: trainingAssessments.assessmentType,
        theoryScore: trainingAssessments.theoryScore,
        roadSignScore: trainingAssessments.roadSignScore,
        practicalScore: trainingAssessments.practicalScore,
        overallScore: trainingAssessments.overallScore,
        scoredPoints: trainingAssessments.scoredPoints,
        maximumPoints: trainingAssessments.maximumPoints,
        result: trainingAssessments.result,
        reviewStatus: trainingAssessments.reviewStatus,
        assessedAt: trainingAssessments.assessedAt,
      })
      .from(trainingAssessments)
      .innerJoin(trainingParticipants, eq(trainingParticipants.id, trainingAssessments.participantId))
      .innerJoin(trainingSessions, eq(trainingSessions.id, trainingAssessments.sessionId))
      .orderBy(desc(trainingAssessments.assessedAt), desc(trainingAssessments.createdAt))
      .limit(200),
    db
      .select({
        id: documents.id,
        assessmentId: trainingAssessments.id,
        name: documents.name,
        mimeType: documents.mimeType,
        sizeBytes: documents.sizeBytes,
        uploadedAt: documents.createdAt,
        uploadedBy: users.name,
        participantName: trainingParticipants.fullName,
        referenceNumber: trainingSessions.referenceNumber,
      })
      .from(documents)
      .innerJoin(trainingAssessments, eq(trainingAssessments.id, documents.ownerId))
      .innerJoin(trainingParticipants, eq(trainingParticipants.id, trainingAssessments.participantId))
      .innerJoin(trainingSessions, eq(trainingSessions.id, trainingAssessments.sessionId))
      .leftJoin(users, eq(users.id, documents.uploadedBy))
      .where(and(
        eq(documents.ownerType, WRITTEN_EXAM_OWNER_TYPE),
        like(documents.name, `${WRITTEN_EXAM_DOCUMENT_PREFIX}%`),
      ))
      .orderBy(desc(documents.createdAt))
      .limit(500),
  ]);

  const assessmentOptions = assessments.map((assessment) => ({
    id: assessment.id,
    label: `${assessment.participantName} · ${assessment.referenceNumber} · ${assessment.assessmentType.replaceAll("_", " ")}`,
  }));
  const evidenceCount = new Map<string, number>();
  for (const row of evidenceRows) evidenceCount.set(row.assessmentId, (evidenceCount.get(row.assessmentId) || 0) + 1);
  const storageConfigured = isPrivateBlobStorageConfigured();

  return (
    <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Written Examination Scores & Evidence"
        description="Record Theory and Road Signs results, attach the written examination evidence, and prepare the complete assessment record for final review."
        action={<Badge tone="blue"><Calculator className="h-4 w-4" /> Equal-weight composite</Badge>}
      />

      <Card className="mb-5 overflow-hidden">
        <div className="border-b border-[var(--vims-line)] bg-[var(--vims-panel-soft)] px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <BookOpenCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--brand-color)]" />
            <div>
              <h2 className="font-semibold text-[var(--vims-ink)]">Certificate score formula</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--vims-ink-soft)]">
                Theory /100 + Road Signs /100 + Assessment Performance /100 are combined as an equal-weight average.
                The system calculates <strong>Total Performance /100</strong> automatically before certification.
              </p>
              <p className="mt-1 text-xs font-semibold text-[var(--vims-ink-muted)]">
                Total Performance = (Theory + Road Signs + Assessment Performance) ÷ 3
              </p>
            </div>
          </div>
        </div>

        {canManage ? (
          <form action={recordWrittenExamScores} className="grid gap-4 p-5 md:grid-cols-[minmax(0,1.7fr)_minmax(0,.7fr)_minmax(0,.7fr)_auto] md:items-end sm:p-6">
            <Field label="Assessment record" required>
              <Select name="assessmentId" required defaultValue="">
                <option value="" disabled>Select driver assessment</option>
                {assessments.map((assessment) => (
                  <option key={assessment.id} value={assessment.id}>
                    {assessment.participantName} · {assessment.referenceNumber} · {assessment.assessmentType.replaceAll("_", " ")}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Theory score /100" required>
              <TextInput name="theoryScore" type="number" min="0" max="100" step="0.01" inputMode="decimal" required placeholder="0–100" />
            </Field>
            <Field label="Road Signs score /100" required>
              <TextInput name="roadSignScore" type="number" min="0" max="100" step="0.01" inputMode="decimal" required placeholder="0–100" />
            </Field>
            <Button type="submit" className="md:mb-[1px]"><ClipboardCheck className="h-4 w-4" /> Calculate & Save</Button>
          </form>
        ) : (
          <div className="p-5 text-sm text-[var(--vims-ink-muted)] sm:p-6">View only. Management permission is required to record written examination scores or upload evidence.</div>
        )}

        {canManage && (
          <WrittenExamEvidenceUpload assessments={assessmentOptions} storageConfigured={storageConfigured} />
        )}
      </Card>

      <Card className="mb-5 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--vims-line)] px-5 py-4 sm:px-6">
          <div>
            <h2 className="font-semibold text-[var(--vims-ink)]">Assessment Score Register</h2>
            <p className="mt-1 text-sm text-[var(--vims-ink-muted)]">Paper exam marks, driving performance, calculated certificate score and supporting evidence count.</p>
          </div>
          <Link href="/driver-training/assessments/review" className="text-sm font-semibold text-[var(--brand-color)] hover:opacity-75">Open Review Queue</Link>
        </div>

        {assessments.length === 0 ? (
          <div className="p-6"><EmptyState icon={<ClipboardCheck className="h-5 w-5" />} title="No assessment records" description="Complete a driver performance assessment before recording paper examination scores." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead className="bg-[var(--vims-panel-soft)] text-xs uppercase tracking-wide text-[var(--vims-ink-muted)]">
                <tr>
                  <th className="px-5 py-3">Driver</th>
                  <th className="px-5 py-3">Session</th>
                  <th className="px-5 py-3 text-center">Theory /100</th>
                  <th className="px-5 py-3 text-center">Road Signs /100</th>
                  <th className="px-5 py-3 text-center">Assessment Performance /100</th>
                  <th className="px-5 py-3 text-center">Total Performance /100</th>
                  <th className="px-5 py-3 text-center">Exam files</th>
                  <th className="px-5 py-3">Review</th>
                  <th className="px-5 py-3">Assessed</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--vims-line)]">
                {assessments.map((assessment) => {
                  const performance = calculateAssessmentPerformanceScore(assessment.scoredPoints, assessment.maximumPoints);
                  const writtenScoresComplete = assessment.theoryScore !== null && assessment.roadSignScore !== null;
                  return (
                    <tr key={assessment.id} className="hover:bg-[var(--vims-panel-soft)]/50">
                      <td className="px-5 py-3 font-semibold text-[var(--vims-ink)]">{assessment.participantName}</td>
                      <td className="px-5 py-3 text-[var(--vims-ink-soft)]">{assessment.referenceNumber}</td>
                      <td className="px-5 py-3 text-center font-semibold">{score(assessment.theoryScore)}</td>
                      <td className="px-5 py-3 text-center font-semibold">{score(assessment.roadSignScore)}</td>
                      <td className="px-5 py-3 text-center font-semibold">{score(performance)}</td>
                      <td className="px-5 py-3 text-center font-bold text-[var(--vims-ink)]">{writtenScoresComplete ? score(assessment.overallScore) : "Pending"}</td>
                      <td className="px-5 py-3 text-center">
                        <Badge tone={(evidenceCount.get(assessment.id) || 0) > 0 ? "emerald" : "slate"}>
                          <FileText className="h-3.5 w-3.5" /> {evidenceCount.get(assessment.id) || 0}
                        </Badge>
                      </td>
                      <td className="px-5 py-3"><Badge tone={reviewTone(assessment.reviewStatus)}>{assessment.reviewStatus.replaceAll("_", " ")}</Badge></td>
                      <td className="px-5 py-3 whitespace-nowrap text-[var(--vims-ink-muted)]">{formatDateTime(assessment.assessedAt)}</td>
                      <td className="px-5 py-3 text-right"><Link href={`/driver-training/assessments/${assessment.id}`} className="font-semibold text-[var(--brand-color)] hover:opacity-75">View</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--vims-line)] px-5 py-4 sm:px-6">
          <div>
            <h2 className="font-semibold text-[var(--vims-ink)]">Written Exam Evidence Register</h2>
            <p className="mt-1 text-sm text-[var(--vims-ink-muted)]">Private exam papers, answer scripts and result sheets linked to controlled assessment records.</p>
          </div>
          <Badge tone={storageConfigured ? "emerald" : "amber"}>
            <ShieldCheck className="h-3.5 w-3.5" /> {storageConfigured ? "Private storage connected" : "Storage setup required"}
          </Badge>
        </div>

        {evidenceRows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<FileText className="h-5 w-5" />}
              title="No written exam files uploaded"
              description={canManage ? "Use the upload panel above to attach the first Theory, Road Signs, answer script or marking document." : "Authorized training managers can upload written examination evidence from this workspace."}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="bg-[var(--vims-panel-soft)] text-xs uppercase tracking-wide text-[var(--vims-ink-muted)]">
                <tr>
                  <th className="px-5 py-3">Driver</th>
                  <th className="px-5 py-3">Session</th>
                  <th className="px-5 py-3">Evidence</th>
                  <th className="px-5 py-3">File</th>
                  <th className="px-5 py-3">Size</th>
                  <th className="px-5 py-3">Uploaded by</th>
                  <th className="px-5 py-3">Uploaded</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--vims-line)]">
                {evidenceRows.map((document) => (
                  <tr key={document.id} className="hover:bg-[var(--vims-panel-soft)]/50">
                    <td className="px-5 py-3 font-semibold text-[var(--vims-ink)]">{document.participantName}</td>
                    <td className="px-5 py-3 text-[var(--vims-ink-soft)]">{document.referenceNumber}</td>
                    <td className="px-5 py-3"><Badge tone="blue">{evidenceTypeFromName(document.name)}</Badge></td>
                    <td className="max-w-[280px] truncate px-5 py-3 text-[var(--vims-ink-soft)]" title={writtenExamOriginalFilename(document.name)}>{writtenExamOriginalFilename(document.name)}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-[var(--vims-ink-muted)]">{fileSize(document.sizeBytes)}</td>
                    <td className="px-5 py-3 text-[var(--vims-ink-soft)]">{document.uploadedBy || "System"}</td>
                    <td className="px-5 py-3 whitespace-nowrap text-[var(--vims-ink-muted)]">{formatDateTime(document.uploadedAt)}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <a
                          href={`/api/driver-training/written-exams/files/${document.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-[var(--vims-line)] bg-white px-2.5 py-1.5 text-xs font-semibold text-[var(--vims-ink)] hover:bg-[var(--vims-panel-soft)]"
                        >
                          <Eye className="h-3.5 w-3.5" /> View
                        </a>
                        <a
                          href={`/api/driver-training/written-exams/files/${document.id}?download=1`}
                          className="inline-flex items-center gap-1 rounded-lg border border-[var(--vims-line)] bg-white px-2.5 py-1.5 text-xs font-semibold text-[var(--vims-ink)] hover:bg-[var(--vims-panel-soft)]"
                        >
                          <Download className="h-3.5 w-3.5" /> Download
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
