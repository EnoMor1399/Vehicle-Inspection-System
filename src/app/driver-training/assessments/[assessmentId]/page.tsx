import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { AlertTriangle, BadgeCheck, ClipboardCheck, ShieldCheck, UserCheck } from "lucide-react";
import { db } from "@/db";
import { users } from "@/db/schema";
import { trainingAssessments, trainingParticipants, trainingSessions } from "@/db/training-schema";
import { Badge, Card, PageHeader, TextArea } from "@/components/ui";
import {
  DRIVER_ASSESSMENT_CRITICAL_VIOLATIONS,
  DRIVER_ASSESSMENT_RATING_LABELS,
  DRIVER_ASSESSMENT_SECTIONS,
  formatAssessmentRecommendation,
} from "@/lib/driver-assessment-template";
import { requireInternalUser } from "@/lib/require-auth";
import {
  canAdministrativelySelfReviewTrainingAssessment,
  canReviewTrainingAssessments,
  canViewTraining,
} from "@/lib/training-access";
import { formatDateTime } from "@/lib/utils";
import { reviewDriverAssessment } from "../actions";
import PrintAssessmentButton from "./PrintAssessmentButton";

export const dynamic = "force-dynamic";

const criticalViolationLabels = new Map<string, string>(
  DRIVER_ASSESSMENT_CRITICAL_VIOLATIONS.map((item) => [item.id, item.label]),
);

function reviewTone(status: string): "amber" | "emerald" | "red" | "slate" {
  if (status === "approved") return "emerald";
  if (status === "returned") return "red";
  if (status === "pending_review") return "amber";
  return "slate";
}

function resultTone(result: string): "emerald" | "red" | "slate" {
  if (result === "competent" || result === "pass") return "emerald";
  if (result === "not_yet_competent" || result === "fail") return "red";
  return "slate";
}

async function getUserSummary(id?: string | null) {
  if (!id) return null;
  const [record] = await db.select({ id: users.id, name: users.name, role: users.role }).from(users).where(eq(users.id, id)).limit(1);
  return record || null;
}

export default async function DriverAssessmentRecordPage({ params }: { params: Promise<{ assessmentId: string }> }) {
  const user = await requireInternalUser();
  if (!canViewTraining(user)) {
    return <div className="p-8 text-sm text-slate-600">You do not have access to Driver Training & Assessment Services.</div>;
  }

  const { assessmentId } = await params;
  const [assessment] = await db.select().from(trainingAssessments).where(eq(trainingAssessments.id, assessmentId)).limit(1);
  if (!assessment) notFound();

  const [[participant], [session], assessor, reviewer] = await Promise.all([
    db.select().from(trainingParticipants).where(eq(trainingParticipants.id, assessment.participantId)).limit(1),
    db.select().from(trainingSessions).where(eq(trainingSessions.id, assessment.sessionId)).limit(1),
    getUserSummary(assessment.assessorId),
    getUserSummary(assessment.reviewerId),
  ]);
  if (!participant || !session) notFound();

  const canReview = canReviewTrainingAssessments(user);
  const isSelfReview = assessment.assessorId === user.id;
  const canSelfReviewAdministratively = canAdministrativelySelfReviewTrainingAssessment(user);
  const usesAdministrativeOverride = isSelfReview && canSelfReviewAdministratively;
  const canActOnReview = canReview
    && assessment.reviewStatus === "pending_review"
    && (!isSelfReview || canSelfReviewAdministratively);
  const ratings = assessment.criteriaRatings || {};
  const comments = assessment.criteriaComments || {};
  const sectionScores = assessment.sectionScores || {};
  const feedback = assessment.qualitativeFeedback || {};
  const developmentPlan = assessment.developmentPlan || [];
  const criticalViolations = Array.isArray(assessment.criticalViolations) ? assessment.criticalViolations : [];
  const improvementAreas = Array.isArray(assessment.improvementAreas) ? assessment.improvementAreas : [];

  return (
    <div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8 print:max-w-none print:p-0">
      <div className="print:hidden">
        <PageHeader
          title="Driver Assessment Record"
          description="Assessment result, evidence and review status."
          action={
            <div className="flex flex-wrap gap-2">
              <PrintAssessmentButton />
              <Link href="/driver-training/assessments" className="inline-flex min-h-10 items-center rounded-xl px-3.5 py-2 text-sm font-semibold text-[var(--brand-color)] hover:bg-[var(--vims-panel-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-color)]">
                Assessments
              </Link>
            </div>
          }
        />
      </div>

      <Card className="overflow-hidden print:border-0 print:shadow-none">
        <div className="border-b border-[var(--vims-line)] bg-[var(--vims-panel-soft)] px-5 py-5 sm:px-6 print:bg-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-color)]">Driver Training Assessment</p>
              <h1 className="mt-1 text-2xl font-semibold text-[var(--vims-ink)]">{participant.fullName}</h1>
              <p className="mt-1 text-sm text-[var(--vims-ink-muted)]">{session.referenceNumber} · {session.title}</p>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <Badge tone={reviewTone(assessment.reviewStatus)}>{assessment.reviewStatus.replaceAll("_", " ")}</Badge>
              <Badge tone={resultTone(assessment.result)}>{assessment.result.replaceAll("_", " ")}</Badge>
              <Badge tone={assessment.riskLevel === "critical" || assessment.riskLevel === "high" ? "red" : assessment.riskLevel === "medium" ? "amber" : "slate"}>{assessment.riskLevel || "unclassified"} risk</Badge>
            </div>
          </div>
        </div>

        <div className="grid gap-px bg-[var(--vims-line)] sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCell label="Overall score" value={assessment.overallScore ? `${assessment.overallScore}%` : "—"} />
          <SummaryCell label="Classification" value={assessment.classification?.replaceAll("_", " ") || "—"} />
          <SummaryCell label="Points" value={assessment.scoredPoints !== null && assessment.maximumPoints !== null ? `${assessment.scoredPoints} / ${assessment.maximumPoints}` : "—"} />
          <SummaryCell label="Recommendation" value={assessment.finalRecommendation ? formatAssessmentRecommendation(assessment.finalRecommendation) : "—"} />
        </div>

        <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
          <InfoBlock title="Driver Details">
            <InfoRow label="Company" value={participant.companyName || "—"} />
            <InfoRow label="Employee number" value={participant.employeeNumber || "—"} />
            <InfoRow label="Licence" value={participant.driverLicenseNumber || "—"} />
            <InfoRow label="Licence class" value={participant.driverLicenseClass || "—"} />
            <InfoRow label="Licence expiry" value={participant.driverLicenseExpiry || "—"} />
          </InfoBlock>
          <InfoBlock title="Assessment">
            <InfoRow label="Type" value={assessment.assessmentType.replaceAll("_", " ")} />
            <InfoRow label="Version" value={assessment.assessmentVersion} />
            <InfoRow label="Assessed" value={formatDateTime(assessment.assessedAt)} />
            <InfoRow label="Trainer" value={assessor?.name || "Assessor unavailable"} />
            <InfoRow label="Acknowledged" value={assessment.driverAcknowledged ? "Yes" : "No"} />
          </InfoBlock>
          <InfoBlock title="Review">
            <InfoRow label="Status" value={assessment.reviewStatus.replaceAll("_", " ")} />
            <InfoRow label="Reviewer" value={reviewer?.name || (assessment.reviewStatus === "pending_review" ? "Awaiting review" : "Reviewer unavailable")} />
            <InfoRow label="Reviewed" value={assessment.reviewedAt ? formatDateTime(assessment.reviewedAt) : "—"} />
            <InfoRow label="Certificate eligible" value={participant.certificateEligible ? "Yes" : "No"} />
            <InfoRow label="Participant status" value={participant.assessmentStatus.replaceAll("_", " ")} />
          </InfoBlock>
        </div>
      </Card>

      {criticalViolations.length > 0 && (
        <Card className="mt-5 border-red-200 bg-red-50/60 p-5 sm:p-6 print:bg-white">
          <div className="flex items-center gap-2 text-red-800"><AlertTriangle className="h-5 w-5" /><h2 className="font-semibold">Critical Violations</h2></div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {criticalViolations.map((id) => <li key={id} className="rounded-xl border border-red-200 bg-white px-3 py-2 text-sm text-red-900">{criticalViolationLabels.get(id) || id.replaceAll("_", " ")}</li>)}
          </ul>
          {feedback.immediateCorrectiveAction && <p className="mt-4 text-sm text-red-900"><strong>Immediate action:</strong> {feedback.immediateCorrectiveAction}</p>}
        </Card>
      )}

      <div className="mt-5 space-y-4">
        {DRIVER_ASSESSMENT_SECTIONS.map((section, sectionIndex) => {
          const sectionScore = sectionScores[section.id];
          const note = comments[`section:${section.id}`];
          return (
            <Card key={section.id} className="overflow-hidden break-inside-avoid-page">
              <div className="flex flex-col gap-2 border-b border-[var(--vims-line)] px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
                <div><p className="text-xs font-bold uppercase tracking-wide text-[var(--brand-color)]">Section {sectionIndex + 1}</p><h2 className="mt-1 font-semibold text-[var(--vims-ink)]">{section.title}</h2></div>
                <div className="text-sm font-semibold text-[var(--vims-ink)]">{sectionScore?.percentage !== null && sectionScore?.percentage !== undefined ? `${sectionScore.percentage}%` : "Not scored"}{sectionScore ? <span className="ml-2 text-xs font-normal text-[var(--vims-ink-muted)]">{sectionScore.score}/{sectionScore.maximum}</span> : null}</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-[var(--vims-panel-soft)] text-xs uppercase tracking-wide text-[var(--vims-ink-muted)]"><tr><th className="px-5 py-3">Criterion</th><th className="px-5 py-3">Rating</th><th className="px-5 py-3">Performance</th></tr></thead>
                  <tbody className="divide-y divide-[var(--vims-line)]">
                    {section.criteria.map((criterion) => {
                      const rating = ratings[criterion.id];
                      return <tr key={criterion.id}><td className="px-5 py-3 text-[var(--vims-ink)]">{criterion.label}</td><td className="px-5 py-3 font-semibold text-[var(--vims-ink)]">{rating ?? "N/A"}</td><td className="px-5 py-3 text-[var(--vims-ink-soft)]">{rating ? DRIVER_ASSESSMENT_RATING_LABELS[rating as keyof typeof DRIVER_ASSESSMENT_RATING_LABELS] : "Not assessed"}</td></tr>;
                    })}
                  </tbody>
                </table>
              </div>
              {note && <div className="border-t border-[var(--vims-line)] bg-[var(--vims-panel-soft)] px-5 py-3 text-sm text-[var(--vims-ink-soft)] sm:px-6"><strong>Observation:</strong> {note}</div>}
            </Card>
          );
        })}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <h2 className="font-semibold text-[var(--vims-ink)]">Trainer Feedback</h2>
          <FeedbackBlock label="Strengths" value={assessment.strengths} />
          <FeedbackBlock label="Improvement Areas" value={improvementAreas.length ? improvementAreas.join("; ") : null} />
          <FeedbackBlock label="Safety" value={feedback.safetyObservations} />
          <FeedbackBlock label="Vehicle Handling" value={feedback.vehicleHandlingObservations} />
          <FeedbackBlock label="Professional Conduct" value={feedback.communicationObservations} />
          <FeedbackBlock label="Trainer Comments" value={feedback.trainerComments} />
          <FeedbackBlock label="Remarks" value={assessment.remarks} />
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="font-semibold text-[var(--vims-ink)]">Development & Acknowledgement</h2>
          {developmentPlan.length ? (
            <div className="mt-4 space-y-3">{developmentPlan.map((item, index) => <div key={`${item.area}-${index}`} className="rounded-xl border border-[var(--vims-line)] p-3"><p className="text-sm font-semibold text-[var(--vims-ink)]">{item.area}</p><p className="mt-1 text-sm text-[var(--vims-ink-soft)]">{item.action}</p>{item.targetDate && <p className="mt-1 text-xs text-[var(--vims-ink-muted)]">Target: {item.targetDate}</p>}</div>)}</div>
          ) : <p className="mt-3 text-sm text-[var(--vims-ink-muted)]">No development actions recorded.</p>}
          <div className="mt-5 rounded-xl bg-[var(--vims-panel-soft)] p-4"><p className="text-sm font-semibold text-[var(--vims-ink)]">Acknowledgement: {assessment.driverAcknowledged ? "Received" : "Not recorded"}</p><p className="mt-2 text-sm text-[var(--vims-ink-soft)]">{assessment.driverComments || "No driver comments."}</p></div>
        </Card>
      </div>

      <Card className="mt-5 p-5 sm:p-6">
        <div className="flex items-center gap-2"><BadgeCheck className="h-5 w-5 text-[var(--brand-color)]" /><h2 className="font-semibold text-[var(--vims-ink)]">Review Decision</h2></div>
        {assessment.reviewStatus !== "pending_review" ? (
          <div className="mt-4 rounded-xl border border-[var(--vims-line)] bg-[var(--vims-panel-soft)] p-4"><div className="flex flex-wrap items-center gap-2"><Badge tone={reviewTone(assessment.reviewStatus)}>{assessment.reviewStatus.replaceAll("_", " ")}</Badge>{reviewer && <span className="text-sm text-[var(--vims-ink-soft)]">by {reviewer.name}</span>}</div><p className="mt-2 text-sm text-[var(--vims-ink-soft)]">{assessment.reviewComments || "No review comments."}</p></div>
        ) : canActOnReview ? (
          <form action={reviewDriverAssessment} className="mt-4 print:hidden">
            <input type="hidden" name="assessmentId" value={assessment.id} />
            {usesAdministrativeOverride && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <ShieldCheck className="mr-2 inline h-4 w-4" />
                Administrative self-review override. Enter review comments explaining the decision; this override will be recorded in the audit log.
              </div>
            )}
            <label className="block"><span className="mb-1.5 block text-sm font-semibold text-[var(--vims-ink-soft)]">Review comments{usesAdministrativeOverride ? " (required)" : ""}</span><TextArea name="reviewComments" required={usesAdministrativeOverride} minLength={usesAdministrativeOverride ? 5 : undefined} maxLength={4000} className="min-h-[110px]" placeholder={usesAdministrativeOverride ? "Document the reason for this administrative review decision." : "Enter approval notes or required corrections."} /></label>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="submit" name="decision" value="returned" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"><AlertTriangle className="h-4 w-4" /> Return for Correction</button>
              <button type="submit" name="decision" value="approved" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--brand-color)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-color)] focus-visible:ring-offset-2"><ShieldCheck className="h-4 w-4" /> Approve Assessment</button>
            </div>
          </form>
        ) : isSelfReview ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><UserCheck className="mr-2 inline h-4 w-4" />Independent review required. Assessors cannot review their own assessment.</div>
        ) : (
          <div className="mt-4 rounded-xl border border-[var(--vims-line)] bg-[var(--vims-panel-soft)] p-4 text-sm text-[var(--vims-ink-muted)]"><ClipboardCheck className="mr-2 inline h-4 w-4" />Awaiting authorized review.</div>
        )}
      </Card>
    </div>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return <div className="bg-[var(--vims-panel-solid)] px-5 py-4 sm:px-6"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--vims-ink-muted)]">{label}</p><p className="mt-1 font-semibold capitalize text-[var(--vims-ink)]">{value}</p></div>;
}

function InfoBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><h2 className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--vims-ink-muted)]">{title}</h2><dl className="mt-3 space-y-2">{children}</dl></div>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4 text-sm"><dt className="text-[var(--vims-ink-muted)]">{label}</dt><dd className="text-right font-medium capitalize text-[var(--vims-ink)]">{value}</dd></div>;
}

function FeedbackBlock({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return <div className="mt-4"><p className="text-xs font-bold uppercase tracking-wide text-[var(--vims-ink-muted)]">{label}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--vims-ink-soft)]">{value}</p></div>;
}
