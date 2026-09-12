import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { AlertTriangle, BadgeCheck, Clock3, ShieldCheck, UserCheck } from "lucide-react";
import { db } from "@/db";
import { trainingAssessments, trainingParticipants, trainingSessions } from "@/db/training-schema";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireInternalUser } from "@/lib/require-auth";
import { canReviewTrainingAssessments, canViewTraining } from "@/lib/training-access";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

function reviewTone(status: string): "amber" | "emerald" | "red" | "slate" {
  if (status === "approved") return "emerald";
  if (status === "returned") return "red";
  if (status === "pending_review") return "amber";
  return "slate";
}

export default async function DriverAssessmentReviewQueuePage() {
  const user = await requireInternalUser();
  if (!canViewTraining(user)) {
    return <div className="p-8 text-sm text-slate-600">You do not have access to Driver Training & Assessment Services.</div>;
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
      reviewedAt: trainingAssessments.reviewedAt,
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
    <div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Assessment Review Queue"
        description="Independent supervisor assurance for completed driver assessments. Approval controls participant competency status and certificate eligibility."
        action={<Link href="/driver-training/assessments" className="text-sm font-semibold text-[var(--brand-color)] hover:opacity-75">Assessment workspace →</Link>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Pending review" value={pending.length} icon={<Clock3 className="h-5 w-5" />} tone="amber" />
        <SummaryCard label="Approved" value={approved} icon={<ShieldCheck className="h-5 w-5" />} tone="emerald" />
        <SummaryCard label="Returned" value={returned} icon={<AlertTriangle className="h-5 w-5" />} tone="red" />
        <SummaryCard label="Your own assessments" value={selfReviewBlocked} icon={<UserCheck className="h-5 w-5" />} tone="slate" />
      </div>

      {!canReview && (
        <Card className="mt-6 border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          You can view the review queue, but only Super Administrators, Administrators, Operations Managers, Supervisors, or users granted the assessment-review permission can approve or return assessments.
        </Card>
      )}

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-[var(--vims-line)] px-5 py-4 sm:px-6">
          <h2 className="font-semibold text-[var(--vims-ink)]">Pending independent reviews</h2>
          <p className="mt-1 text-sm text-[var(--vims-ink-muted)]">Open the assessment record to inspect criterion-level evidence before making a decision. Assessors cannot review their own records.</p>
        </div>
        {pending.length === 0 ? (
          <div className="p-5 sm:p-6"><EmptyState icon={<BadgeCheck className="h-5 w-5" />} title="No assessments awaiting review" description="New trainer assessments will appear here until independently approved or returned." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="bg-[var(--vims-panel-soft)] text-xs uppercase tracking-wide text-[var(--vims-ink-muted)]">
                <tr><th className="px-5 py-3">Driver</th><th className="px-5 py-3">Session</th><th className="px-5 py-3">Assessment</th><th className="px-5 py-3">Score</th><th className="px-5 py-3">Outcome</th><th className="px-5 py-3">Risk</th><th className="px-5 py-3">Submitted</th><th className="px-5 py-3">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-[var(--vims-line)]">
                {pending.map((record) => (
                  <tr key={record.id} className="align-top hover:bg-[var(--vims-panel-soft)]/60">
                    <td className="px-5 py-4"><p className="font-semibold text-[var(--vims-ink)]">{record.participantName}</p><p className="mt-1 text-xs text-[var(--vims-ink-muted)]">{record.companyName || "No company recorded"}</p></td>
                    <td className="px-5 py-4 text-[var(--vims-ink-soft)]">{record.referenceNumber}</td>
                    <td className="px-5 py-4 capitalize text-[var(--vims-ink-soft)]">{record.assessmentType.replaceAll("_", " ")}</td>
                    <td className="px-5 py-4 font-semibold text-[var(--vims-ink)]">{record.overallScore ? `${record.overallScore}%` : "—"}</td>
                    <td className="px-5 py-4"><Badge tone={record.result === "competent" || record.result === "pass" ? "emerald" : "red"}>{record.result.replaceAll("_", " ")}</Badge></td>
                    <td className="px-5 py-4 capitalize text-[var(--vims-ink-soft)]">{record.riskLevel || "—"}</td>
                    <td className="px-5 py-4 text-xs text-[var(--vims-ink-muted)]">{formatDateTime(record.assessedAt)}</td>
                    <td className="px-5 py-4"><Link href={`/driver-training/assessments/${record.id}`} className="inline-flex min-h-9 items-center rounded-lg bg-[var(--brand-color)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-color)] focus-visible:ring-offset-2">{record.assessorId === user.id ? "View record" : canReview ? "Review record" : "View record"}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-[var(--vims-line)] px-5 py-4 sm:px-6"><h2 className="font-semibold text-[var(--vims-ink)]">Recent review decisions</h2><p className="mt-1 text-sm text-[var(--vims-ink-muted)]">Most recent approved and returned assessment records.</p></div>
        <div className="divide-y divide-[var(--vims-line)]">
          {records.filter((record) => record.reviewStatus !== "pending_review").slice(0, 30).map((record) => (
            <Link key={record.id} href={`/driver-training/assessments/${record.id}`} className="flex flex-col gap-2 px-5 py-4 hover:bg-[var(--vims-panel-soft)] sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div><p className="font-semibold text-[var(--vims-ink)]">{record.participantName} · {record.referenceNumber}</p><p className="mt-1 text-xs text-[var(--vims-ink-muted)]">{record.assessmentType.replaceAll("_", " ")} · {record.overallScore ? `${record.overallScore}%` : "No score"}</p></div>
              <div className="flex items-center gap-2"><Badge tone={reviewTone(record.reviewStatus)}>{record.reviewStatus.replaceAll("_", " ")}</Badge><span className="text-xs text-[var(--vims-ink-muted)]">{record.reviewedAt ? formatDateTime(record.reviewedAt) : "—"}</span></div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: "amber" | "emerald" | "red" | "slate" }) {
  const classes = tone === "emerald" ? "bg-emerald-50 text-emerald-700" : tone === "red" ? "bg-red-50 text-red-700" : tone === "amber" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-700";
  return <Card className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--vims-ink-muted)]">{label}</p><p className="mt-2 text-2xl font-semibold text-[var(--vims-ink)]">{value}</p></div><div className={`grid h-10 w-10 place-items-center rounded-xl ${classes}`}>{icon}</div></div></Card>;
}
