import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { AlertTriangle, BadgeCheck, Clock3, ShieldCheck, UserCheck } from "lucide-react";
import { db } from "@/db";
import { trainingAssessments, trainingParticipants, trainingSessions } from "@/db/training-schema";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireInternalUser } from "@/lib/require-auth";
import {
  canAdministrativelySelfReviewTrainingAssessment,
  canReviewTrainingAssessments,
  canViewTraining,
} from "@/lib/training-access";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DriverAssessmentReviewQueuePage() {
  const user = await requireInternalUser();
  if (!canViewTraining(user)) {
    return <div className="p-8 text-sm text-slate-600">You do not have access to this module.</div>;
  }
  const canReview = canReviewTrainingAssessments(user);
  const canSelfReviewAdministratively = canAdministrativelySelfReviewTrainingAssessment(user);

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
  const selfReviewBlocked = pending.filter(
    (record) => record.assessorId === user.id && !canSelfReviewAdministratively,
  ).length;
  const actionablePending = canReview
    ? pending.filter((record) => record.assessorId !== user.id || canSelfReviewAdministratively)
    : [];
  const currentReview = actionablePending[actionablePending.length - 1] || null;
  const currentUsesAdminOverride = Boolean(
    currentReview && currentReview.assessorId === user.id && canSelfReviewAdministratively,
  );

  return (
    <div className="mx-auto max-w-[1450px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Assessment Review"
        description="Review the current pending assessment, verify the evidence and record an authorized decision."
      />

      {currentUsesAdminOverride && (
        <Card className="mb-5 border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Administrative self-review override available</p>
              <p className="mt-1">This assessment was submitted by your account. Administrator and Super Administrator accounts may complete the review, but review comments are required and the override is recorded in the audit log.</p>
            </div>
          </div>
        </Card>
      )}

      {canReview && currentReview && (
        <Card className="mb-5 overflow-hidden border-[var(--brand-color)]/30">
          <div className="flex flex-col gap-4 border-b border-[var(--vims-line)] bg-[var(--vims-panel-soft)] px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="amber">Current review</Badge>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-color)]">Current assessment to review</p>
              </div>
              <h2 className="mt-2 text-xl font-semibold text-[var(--vims-ink)]">{currentReview.participantName}</h2>
              <p className="mt-1 text-sm text-[var(--vims-ink-muted)]">{currentReview.referenceNumber} · {currentReview.assessmentType.replaceAll("_", " ")}</p>
            </div>
            <Link
              href={`/driver-training/assessments/${currentReview.id}`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--brand-color)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-color)] focus-visible:ring-offset-2"
            >
              <ShieldCheck className="h-4 w-4" /> Review current assessment
            </Link>
          </div>
          <div className="grid gap-px bg-[var(--vims-line)] sm:grid-cols-2 lg:grid-cols-4">
            <ReviewSummary label="Score" value={currentReview.overallScore ? `${currentReview.overallScore}%` : "—"} />
            <ReviewSummary label="Outcome" value={currentReview.result.replaceAll("_", " ")} />
            <ReviewSummary label="Risk" value={`${currentReview.riskLevel || "unclassified"} risk`} />
            <ReviewSummary label="Submitted" value={formatDateTime(currentReview.assessedAt)} />
          </div>
          <div className="px-5 py-4 text-sm text-[var(--vims-ink-soft)] sm:px-6">
            Review the complete section scores, observations, critical violations, trainer feedback and development plan before approving or returning this assessment.
          </div>
        </Card>
      )}

      {canReview && !currentReview && selfReviewBlocked > 0 && (
        <Card className="mb-5 border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex items-start gap-2">
            <UserCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Independent reviewer required</p>
              <p className="mt-1">The remaining pending assessment(s) were submitted by your account. Another authorized reviewer must complete the decision.</p>
            </div>
          </div>
        </Card>
      )}

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
          Read-only access. Approval requires a Driver Training account with assessment-review authority.
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-[var(--vims-line)] px-5 py-4 sm:px-6">
          <h2 className="font-semibold text-[var(--vims-ink)]">Pending reviews</h2>
          <p className="mt-1 text-xs text-[var(--vims-ink-muted)]">The current review is the oldest actionable submission so pending assessments are handled in a consistent order.</p>
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
                {pending.map((record) => {
                  const isCurrent = currentReview?.id === record.id;
                  const canAct = canReview && (record.assessorId !== user.id || canSelfReviewAdministratively);
                  return (
                    <tr key={record.id} className={`align-top ${isCurrent ? "bg-amber-50/60" : "hover:bg-[var(--vims-panel-soft)]/60"}`}>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-[var(--vims-ink)]">{record.participantName}</p>
                          {isCurrent && <Badge tone="amber">Current</Badge>}
                        </div>
                        <p className="mt-1 text-xs text-[var(--vims-ink-muted)]">{record.companyName || "No company"} · {record.assessmentType.replaceAll("_", " ")}</p>
                      </td>
                      <td className="px-5 py-4 text-[var(--vims-ink-soft)]">{record.referenceNumber}</td>
                      <td className="px-5 py-4 font-semibold text-[var(--vims-ink)]">{record.overallScore ? `${record.overallScore}%` : "—"}</td>
                      <td className="px-5 py-4"><Badge tone={record.result === "competent" || record.result === "pass" ? "emerald" : "red"}>{record.result.replaceAll("_", " ")}</Badge><p className="mt-1 text-xs capitalize text-[var(--vims-ink-muted)]">{record.riskLevel || "—"} risk</p></td>
                      <td className="px-5 py-4 text-xs text-[var(--vims-ink-muted)]">{formatDateTime(record.assessedAt)}</td>
                      <td className="px-5 py-4">
                        <Link href={`/driver-training/assessments/${record.id}`} className={`inline-flex min-h-9 items-center rounded-lg px-3 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${canAct ? "bg-[var(--brand-color)] text-white hover:opacity-90 focus-visible:ring-[var(--brand-color)]" : "border border-[var(--vims-line)] bg-white text-[var(--vims-ink-soft)] hover:bg-[var(--vims-panel-soft)] focus-visible:ring-slate-400"}`}>
                          {canAct ? (isCurrent ? "Review now" : "Review") : "View"}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function ReviewSummary({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--vims-panel-solid)] px-5 py-3.5 sm:px-6">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--vims-ink-muted)]">{label}</p>
      <p className="mt-1 text-sm font-semibold capitalize text-[var(--vims-ink)]">{value}</p>
    </div>
  );
}
