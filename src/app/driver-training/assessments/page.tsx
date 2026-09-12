import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { AlertTriangle, ClipboardCheck, UsersRound } from "lucide-react";
import { db } from "@/db";
import { trainingAssessments, trainingParticipants, trainingSessions } from "@/db/training-schema";
import { Badge, Button, Card, EmptyState, Field, PageHeader, Select, TextArea, TextInput } from "@/components/ui";
import {
  DRIVER_ASSESSMENT_CRITICAL_VIOLATIONS,
  DRIVER_ASSESSMENT_MAX_SCORE,
  DRIVER_ASSESSMENT_RATING_LABELS,
  DRIVER_ASSESSMENT_RATINGS,
  DRIVER_ASSESSMENT_SECTIONS,
  DRIVER_ASSESSMENT_TOTAL_CRITERIA,
} from "@/lib/driver-assessment-template";
import { requireInternalUser } from "@/lib/require-auth";
import { canManageTraining, canViewTraining } from "@/lib/training-access";
import { formatDateTime } from "@/lib/utils";
import { recordComprehensiveDriverAssessment } from "./actions";

export const dynamic = "force-dynamic";

function resultTone(result: string): "emerald" | "red" | "amber" | "slate" {
  if (result === "competent" || result === "pass") return "emerald";
  if (result === "not_yet_competent" || result === "fail") return "red";
  return "slate";
}

function reviewTone(status: string): "emerald" | "red" | "amber" | "slate" {
  if (status === "approved") return "emerald";
  if (status === "returned") return "red";
  if (status === "pending_review") return "amber";
  return "slate";
}

export default async function DriverAssessmentsPage() {
  const user = await requireInternalUser();
  if (!canViewTraining(user)) {
    return <div className="p-8 text-sm text-slate-600">You do not have access to Driver Training & Assessment Services.</div>;
  }
  const canManage = canManageTraining(user);

  const [participants, recentAssessments] = await Promise.all([
    db
      .select({
        id: trainingParticipants.id,
        fullName: trainingParticipants.fullName,
        companyName: trainingParticipants.companyName,
        attendanceStatus: trainingParticipants.attendanceStatus,
        referenceNumber: trainingSessions.referenceNumber,
      })
      .from(trainingParticipants)
      .innerJoin(trainingSessions, eq(trainingSessions.id, trainingParticipants.sessionId))
      .orderBy(desc(trainingParticipants.createdAt))
      .limit(300),
    db
      .select({
        id: trainingAssessments.id,
        participantName: trainingParticipants.fullName,
        referenceNumber: trainingSessions.referenceNumber,
        assessmentType: trainingAssessments.assessmentType,
        overallScore: trainingAssessments.overallScore,
        classification: trainingAssessments.classification,
        result: trainingAssessments.result,
        riskLevel: trainingAssessments.riskLevel,
        reviewStatus: trainingAssessments.reviewStatus,
        criticalViolations: trainingAssessments.criticalViolations,
        assessedAt: trainingAssessments.assessedAt,
      })
      .from(trainingAssessments)
      .innerJoin(trainingParticipants, eq(trainingParticipants.id, trainingAssessments.participantId))
      .innerJoin(trainingSessions, eq(trainingSessions.id, trainingParticipants.sessionId))
      .orderBy(desc(trainingAssessments.assessedAt))
      .limit(30),
  ]);

  const assessableParticipants = participants.filter(
    (participant) => participant.attendanceStatus !== "absent" && participant.attendanceStatus !== "withdrawn",
  );

  return (
    <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Driver Performance Assessment"
        description="Record competency and submit for independent review."
        action={<Badge tone="blue"><ClipboardCheck className="h-4 w-4" /> {DRIVER_ASSESSMENT_TOTAL_CRITERIA} criteria</Badge>}
      />

      <Card className="mb-5 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--vims-ink-soft)]">
          <span><strong className="text-[var(--vims-ink)]">Pass:</strong> 70%+</span>
          <span><strong className="text-[var(--vims-ink)]">Coverage:</strong> 75% + every section</span>
          <span><strong className="text-[var(--vims-ink)]">Safety:</strong> critical violation blocks competence</span>
          <span className="text-[var(--vims-ink-muted)]">Maximum {DRIVER_ASSESSMENT_MAX_SCORE} points</span>
        </div>
      </Card>

      {canManage ? (
        <form action={recordComprehensiveDriverAssessment} className="space-y-5">
          <Card className="overflow-hidden">
            <div className="border-b border-[var(--vims-line)] px-5 py-4 sm:px-6">
              <h2 className="font-semibold text-[var(--vims-ink)]">Assessment Details</h2>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-2 sm:p-6">
              <Field label="Driver / participant" required>
                <Select name="participantId" required defaultValue="">
                  <option value="" disabled>Select driver</option>
                  {assessableParticipants.map((participant) => (
                    <option key={participant.id} value={participant.id}>
                      {participant.fullName} · {participant.referenceNumber}{participant.companyName ? ` · ${participant.companyName}` : ""}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Assessment type" required>
                <Select name="assessmentType" defaultValue="proficiency" required>
                  <option value="pre_training">Pre-training baseline</option>
                  <option value="post_training">Post-training assessment</option>
                  <option value="proficiency">Driving proficiency</option>
                  <option value="practical">Practical driving assessment</option>
                  <option value="refresher">Refresher assessment</option>
                </Select>
              </Field>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-[var(--vims-line)] px-5 py-4 sm:px-6">
              <h2 className="font-semibold text-[var(--vims-ink)]">Performance Ratings</h2>
              <p className="mt-1 text-sm text-[var(--vims-ink-muted)]">1 Unsatisfactory · 2 Needs improvement · 3 Satisfactory · 4 Good · 5 Excellent</p>
            </div>
            <div className="divide-y divide-[var(--vims-line)]">
              {DRIVER_ASSESSMENT_SECTIONS.map((section, sectionIndex) => (
                <details key={section.id} className="group" open={sectionIndex === 0}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 hover:bg-[var(--vims-panel-soft)] sm:px-6 [&::-webkit-details-marker]:hidden">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="font-mono text-xs font-semibold text-[var(--brand-color)]">{String(sectionIndex + 1).padStart(2, "0")}</span>
                      <h3 className="font-semibold text-[var(--vims-ink)]">{section.title}</h3>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-[var(--vims-ink-muted)]">{section.criteria.length} criteria</span>
                  </summary>
                  <div className="border-t border-[var(--vims-line)] bg-[var(--vims-panel-soft)]/35 p-4 sm:p-5">
                    <div className="overflow-hidden rounded-xl border border-[var(--vims-line)] bg-[var(--vims-panel-solid)]">
                      <div className="hidden grid-cols-[minmax(0,1fr)_12rem] gap-4 border-b border-[var(--vims-line)] bg-[var(--vims-panel-soft)] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--vims-ink-muted)] md:grid">
                        <span>Criterion</span><span>Rating</span>
                      </div>
                      <div className="divide-y divide-[var(--vims-line)]">
                        {section.criteria.map((criterion, criterionIndex) => (
                          <div key={criterion.id} className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_12rem] md:items-center md:gap-4">
                            <div className="flex items-start gap-3">
                              <span className="mt-0.5 w-7 shrink-0 font-mono text-xs text-[var(--vims-ink-muted)]">{criterionIndex + 1}.</span>
                              <span className="text-sm leading-5 text-[var(--vims-ink)]">{criterion.label}</span>
                            </div>
                            <Select name={`rating__${criterion.id}`} defaultValue="" aria-label={`Rating for ${criterion.label}`}>
                              <option value="">N/A / not assessed</option>
                              {DRIVER_ASSESSMENT_RATINGS.map((rating) => (
                                <option key={rating} value={rating}>{rating} — {DRIVER_ASSESSMENT_RATING_LABELS[rating]}</option>
                              ))}
                            </Select>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="mt-4">
                      <Field label="Observation">
                        <TextArea name={`sectionNote__${section.id}`} maxLength={2000} className="min-h-[76px]" />
                      </Field>
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-[var(--vims-line)] px-5 py-4 sm:px-6">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <h2 className="font-semibold text-[var(--vims-ink)]">Critical Violations</h2>
              </div>
            </div>
            <div className="grid gap-2 p-5 sm:grid-cols-2 lg:grid-cols-3 sm:p-6">
              {DRIVER_ASSESSMENT_CRITICAL_VIOLATIONS.map((violation) => (
                <label key={violation.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--vims-line)] p-3 hover:bg-[var(--vims-panel-soft)]">
                  <input type="checkbox" name="criticalViolations" value={violation.id} className="mt-1 h-4 w-4" />
                  <span className="text-sm font-medium leading-5 text-[var(--vims-ink)]">{violation.label}</span>
                </label>
              ))}
              <div className="mt-2 sm:col-span-2 lg:col-span-3">
                <Field label="Immediate action">
                  <TextArea name="immediateCorrectiveAction" maxLength={4000} className="min-h-[80px]" />
                </Field>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <details open className="group border-b border-[var(--vims-line)]">
              <summary className="cursor-pointer list-none px-5 py-4 font-semibold text-[var(--vims-ink)] hover:bg-[var(--vims-panel-soft)] sm:px-6 [&::-webkit-details-marker]:hidden">
                Trainer Feedback
              </summary>
              <div className="grid gap-4 border-t border-[var(--vims-line)] p-5 md:grid-cols-2 sm:p-6">
                <Field label="Strengths"><TextArea name="strengths" maxLength={4000} className="min-h-[90px]" /></Field>
                <Field label="Improvement areas"><TextArea name="improvementAreas" maxLength={4000} className="min-h-[90px]" /></Field>
                <div className="md:col-span-2"><Field label="Final comments"><TextArea name="trainerComments" maxLength={4000} className="min-h-[90px]" /></Field></div>
              </div>
            </details>

            <details className="group border-b border-[var(--vims-line)]">
              <summary className="cursor-pointer list-none px-5 py-4 font-semibold text-[var(--vims-ink)] hover:bg-[var(--vims-panel-soft)] sm:px-6 [&::-webkit-details-marker]:hidden">
                Development Plan
              </summary>
              <div className="space-y-3 border-t border-[var(--vims-line)] p-5 sm:p-6">
                {[1, 2, 3, 4].map((index) => (
                  <div key={index} className="grid gap-3 md:grid-cols-[1fr_1.5fr_11rem]">
                    <Field label={`Development area ${index}`}><TextInput name={`developmentArea${index}`} maxLength={500} /></Field>
                    <Field label="Required action"><TextInput name={`developmentAction${index}`} maxLength={1200} /></Field>
                    <Field label="Target date"><TextInput name={`developmentTarget${index}`} type="date" /></Field>
                  </div>
                ))}
              </div>
            </details>

            <details className="group">
              <summary className="cursor-pointer list-none px-5 py-4 font-semibold text-[var(--vims-ink)] hover:bg-[var(--vims-panel-soft)] sm:px-6 [&::-webkit-details-marker]:hidden">
                Driver Acknowledgement
              </summary>
              <div className="grid gap-4 border-t border-[var(--vims-line)] p-5 md:grid-cols-[auto_1fr] md:items-start sm:p-6">
                <label className="flex items-center gap-3 rounded-xl border border-[var(--vims-line)] px-4 py-3 text-sm font-semibold text-[var(--vims-ink)]">
                  <input type="checkbox" name="driverAcknowledged" className="h-4 w-4" /> Feedback acknowledged
                </label>
                <Field label="Driver comments"><TextArea name="driverComments" maxLength={4000} className="min-h-[80px]" /></Field>
              </div>
            </details>
          </Card>

          <div className="sticky bottom-3 z-20 flex flex-col gap-3 rounded-xl border border-[var(--vims-line-strong)] bg-[var(--vims-panel-solid)]/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--vims-ink-muted)]">Submission calculates the result and sends it for review.</p>
            <Button type="submit" className="shrink-0"><ClipboardCheck className="h-4 w-4" /> Submit Assessment</Button>
          </div>
        </form>
      ) : (
        <Card className="mb-6 p-4"><p className="text-sm text-[var(--vims-ink-muted)]">View only. Management permission is required to record assessments.</p></Card>
      )}

      <Card className="mt-7 overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-[var(--vims-line)] px-5 py-4 sm:px-6">
          <h2 className="font-semibold text-[var(--vims-ink)]">Recent Assessments</h2>
          <Link href="/driver-training/assessments/review" className="shrink-0 text-sm font-semibold text-[var(--brand-color)] hover:opacity-75">Review Queue</Link>
        </div>
        {recentAssessments.length === 0 ? (
          <div className="p-5 sm:p-6"><EmptyState icon={<UsersRound className="h-5 w-5" />} title="No assessments recorded" description="Assessment records will appear here." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-[var(--vims-panel-soft)] text-xs uppercase tracking-wide text-[var(--vims-ink-muted)]">
                <tr><th className="px-5 py-3">Driver</th><th className="px-5 py-3">Session</th><th className="px-5 py-3">Score</th><th className="px-5 py-3">Outcome</th><th className="px-5 py-3">Review</th><th className="px-5 py-3">Assessed</th><th className="px-5 py-3">Record</th></tr>
              </thead>
              <tbody className="divide-y divide-[var(--vims-line)]">
                {recentAssessments.map((assessment) => {
                  const criticalCount = Array.isArray(assessment.criticalViolations) ? assessment.criticalViolations.length : 0;
                  return (
                    <tr key={assessment.id} className="align-top hover:bg-[var(--vims-panel-soft)]/60">
                      <td className="px-5 py-4 font-semibold text-[var(--vims-ink)]">{assessment.participantName}</td>
                      <td className="px-5 py-4"><p className="text-[var(--vims-ink-soft)]">{assessment.referenceNumber}</p><p className="mt-1 text-xs capitalize text-[var(--vims-ink-muted)]">{assessment.assessmentType.replaceAll("_", " ")}</p></td>
                      <td className="px-5 py-4"><span className="font-semibold text-[var(--vims-ink)]">{assessment.overallScore ? `${assessment.overallScore}%` : "—"}</span>{assessment.classification ? <span className="mt-1 block text-xs capitalize text-[var(--vims-ink-muted)]">{assessment.classification.replaceAll("_", " ")}</span> : null}</td>
                      <td className="px-5 py-4"><Badge tone={resultTone(assessment.result)}>{assessment.result.replaceAll("_", " ")}</Badge><p className="mt-1 text-xs capitalize text-[var(--vims-ink-muted)]">{assessment.riskLevel || "—"} risk{criticalCount ? ` · ${criticalCount} critical` : ""}</p></td>
                      <td className="px-5 py-4"><Badge tone={reviewTone(assessment.reviewStatus)}>{assessment.reviewStatus.replaceAll("_", " ")}</Badge></td>
                      <td className="px-5 py-4 text-xs text-[var(--vims-ink-muted)]">{formatDateTime(assessment.assessedAt)}</td>
                      <td className="px-5 py-4"><Link href={`/driver-training/assessments/${assessment.id}`} className="text-xs font-semibold text-[var(--brand-color)] hover:opacity-75">View</Link></td>
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
