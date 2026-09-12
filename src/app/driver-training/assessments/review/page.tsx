import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { AlertTriangle, BadgeCheck, Clock3, ShieldCheck } from "lucide-react";
import { db } from "@/db";
import { trainingAssessments, trainingParticipants, trainingSessions } from "@/db/training-schema";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireInternalUser } from "@/lib/require-auth";
import { canReviewTrainingAssessments, canViewTraining } from "@/lib/training-access";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DriverAssessmentReviewQueuePage() {
  const user = await requireInternalUser();
  if (!canViewTraining(user)) {
    return <div className="p-8 text-sm text-slate-600">You do not have access to this module.</div>;
  }
  const canReview = canReviewTrainingAssessments(user);

  const records = await db
    .select({
      id: trainingAssessments.id,
      participantName: trainingParticipants.fullName,
      companyName: trainingParticipants.companyName,
      referenceNumber: trainingSessions.referenceNumber,
      assessmentType: trainingAssessments.assessmentType,
      overallScore: trainingAssessments.overallScore,
      result: trainingAssessments.result,
      riskLevel: trainingAssessments.riskLevel,
      reviewStatus: trainingAssessments.reviewStatus,
      assessorId: trainingAssessments.assessorId,
      assessedAt: trainingAssessments.assessedAt,
    })
    .from(trainingAssessments)
    .innerJoin(trainingParticipants, eq(trainingParticipants.id, trainingAssessments.participantId))
    .innerJoin(trainingSessions, eq(trainingSessions.id, trainingAssessments.sessionId))
    .orderBy(desc(trainingAssessments.assessedAt))
    .limit(200);

  const pending = records.filter((record) => record.reviewStatus === "pending_review");
  const approved = records.filter((record) => record.reviewStatus === "approved").length;
  const returned = records.filter((record) => record.reviewStatus === "returned").length;
  const selfReviewBlocked = pending.filter((record) => record.assessorId === user.id).length;

  return (
    <div className="mx-auto max-w-[1450px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Assessment Review"
        description="Review submitted assessments and record the final decision."
      />

      <Card className="mb-5 p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-amber-50 text-amber-700"><Clock3 className="h-4 w-4" /></span>
            <div><p className="text-xs text-[var(--vims-ink-muted)]">Pending</p><p className="text-xl font-semibold text-[var(--vims-ink)]">{pending.length}</p></div>
          </div>
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><ShieldCheck className="h-4 w-4" /></span>
            <div><p className="text-xs text-[var(--vims-ink-muted)]">Approved</p><p className="text-xl font-semibold text-[var(--vims-ink)]">{approved}</p></div>
          </div>
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-red-50 text-red-700"><AlertTriangle className="h-4 w-4" /></span>
            <div><p className="text-xs text-[var(--vims-ink-muted)]">Returned</p><p className="text-xl font-semibold text-[var(--vims-ink)]">{returned}</p></div>
          </div>
        </div>
        {selfReviewBlocked > 0 && <p className="mt-4 border-t border-[var(--vims-line)] pt-3 text-xs text-[var(--vims-ink-muted)]">{selfReviewBlocked} submission(s) require another reviewer.</p>}
      </Card>

      {!canReview && (
        <Card className="mb-5 border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Read-only access. Approval requires an authorized reviewer.
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-[var(--vims-line)] px-5 py-4 sm:px-6">
          <h2 className="font-semibold text-[var(--vims-ink)]">Pending reviews</h2>
        </div>
        {pending.length === 0 ? (
          <div className="p-5 sm:p-6"><EmptyState icon={<BadgeCheck className="h-5 w-5" />} title="No pending reviews" description="Submitted assessments will appear here." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-[var(--vims-panel-soft)] text-xs uppercase tracking-wide text-[var(--vims-ink-muted)]">
                <tr><th className="px-5 py-3">Driver</th><th className="px-5 py-3">Session</th><th className="px-5 py-3">Score</th><th className="px-5 py-3">Outcome</th><th className="px-5 py-3">Submitted</th><th className="px-5 py-3">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-[var(--vims-line)]">
                {pending.map((record) => (
                  <tr key={record.id} className="align-top hover:bg-[var(--vims-panel-soft)]/60">
                    <td className="px-5 py-4"><p className="font-semibold text-[var(--vims-ink)]">{record.participantName}</p><p className="mt-1 text-xs text-[var(--vims-ink-muted)]">{record.companyName || "No company"} · {record.assessmentType.replaceAll("_", " ")}</p></td>
                    <td className="px-5 py-4 text-[var(--vims-ink-soft)]">{record.referenceNumber}</td>
                    <td className="px-5 py-4 font-semibold text-[var(--vims-ink)]">{record.overallScore ? `${record.overallScore}%` : "—"}</td>
                    <td className="px-5 py-4"><Badge tone={record.result === "competent" || record.result === "pass" ? "emerald" : "red"}>{record.result.replaceAll("_", " ")}</Badge><p className="mt-1 text-xs capitalize text-[var(--vims-ink-muted)]">{record.riskLevel || "—"} risk</p></td>
                    <td className="px-5 py-4 text-xs text-[var(--vims-ink-muted)]">{formatDateTime(record.assessedAt)}</td>
                    <td className="px-5 py-4"><Link href={`/driver-training/assessments/${record.id}`} className="inline-flex min-h-9 items-center rounded-lg bg-[var(--brand-color)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-color)] focus-visible:ring-offset-2">{record.assessorId === user.id || !canReview ? "View" : "Review"}</Link></td>
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
