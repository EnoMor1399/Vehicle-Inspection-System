import { desc, eq, inArray } from "drizzle-orm";
import { AlertTriangle, BarChart3, CheckCircle2, ClipboardList, MessageSquareText, ShieldAlert } from "lucide-react";
import { db } from "@/db";
import { users } from "@/db/schema";
import { trainingParticipants, trainingSessions } from "@/db/training-schema";
import { trainingQualityFindings, trainingSessionFeedback } from "@/db/training-quality-schema";
import { Badge, Button, Card, EmptyState, Field, PageHeader, Select, TextArea, TextInput } from "@/components/ui";
import { DRIVER_TRAINING_SERVICES } from "@/lib/driver-training";
import { requireInternalUser } from "@/lib/require-auth";
import { canManageTraining, canViewTraining } from "@/lib/training-access";
import { calculateTrainingEffectivenessScore, feedbackQualitySignal, isQualityFindingOverdue } from "@/lib/training-quality-policy";
import { formatDate, formatDateTime } from "@/lib/utils";
import { closeTrainingQualityFinding, createTrainingQualityFinding, submitTrainingFeedback, updateTrainingQualityFinding } from "./actions";

export const dynamic = "force-dynamic";

const serviceNames = new Map(DRIVER_TRAINING_SERVICES.map((service) => [service.id, service.title]));

function severityTone(severity: string) {
  if (severity === "critical" || severity === "high") return "red" as const;
  if (severity === "medium") return "amber" as const;
  return "slate" as const;
}

function statusTone(status: string) {
  if (status === "closed") return "emerald" as const;
  if (status === "verification") return "blue" as const;
  if (status === "dismissed") return "slate" as const;
  return "amber" as const;
}

export default async function TrainingQualityPage() {
  const user = await requireInternalUser();
  if (!canViewTraining(user)) {
    return <div className="p-8 text-sm text-slate-600">You do not have access to Driver Training & Assessment Services.</div>;
  }
  const canManage = canManageTraining(user);

  const [sessions, participants, feedback, findings, activeUsers] = await Promise.all([
    db
      .select({ id: trainingSessions.id, referenceNumber: trainingSessions.referenceNumber, serviceId: trainingSessions.serviceId, title: trainingSessions.title, status: trainingSessions.status, startAt: trainingSessions.startAt })
      .from(trainingSessions)
      .where(inArray(trainingSessions.status, ["in_progress", "completed"]))
      .orderBy(desc(trainingSessions.startAt))
      .limit(150),
    db
      .select({ id: trainingParticipants.id, fullName: trainingParticipants.fullName, sessionId: trainingParticipants.sessionId, sessionReference: trainingSessions.referenceNumber })
      .from(trainingParticipants)
      .innerJoin(trainingSessions, eq(trainingSessions.id, trainingParticipants.sessionId))
      .orderBy(desc(trainingParticipants.createdAt))
      .limit(400),
    db
      .select({
        id: trainingSessionFeedback.id,
        sessionId: trainingSessionFeedback.sessionId,
        participantId: trainingSessionFeedback.participantId,
        respondentType: trainingSessionFeedback.respondentType,
        contentRating: trainingSessionFeedback.contentRating,
        instructorRating: trainingSessionFeedback.instructorRating,
        practicalRating: trainingSessionFeedback.practicalRating,
        safetyRating: trainingSessionFeedback.safetyRating,
        overallRating: trainingSessionFeedback.overallRating,
        wouldRecommend: trainingSessionFeedback.wouldRecommend,
        comments: trainingSessionFeedback.comments,
        improvementSuggestions: trainingSessionFeedback.improvementSuggestions,
        anonymous: trainingSessionFeedback.anonymous,
        createdAt: trainingSessionFeedback.createdAt,
        sessionReference: trainingSessions.referenceNumber,
        participantName: trainingParticipants.fullName,
      })
      .from(trainingSessionFeedback)
      .innerJoin(trainingSessions, eq(trainingSessions.id, trainingSessionFeedback.sessionId))
      .leftJoin(trainingParticipants, eq(trainingParticipants.id, trainingSessionFeedback.participantId))
      .orderBy(desc(trainingSessionFeedback.createdAt))
      .limit(300),
    db
      .select({
        id: trainingQualityFindings.id,
        sessionId: trainingQualityFindings.sessionId,
        participantId: trainingQualityFindings.participantId,
        source: trainingQualityFindings.source,
        category: trainingQualityFindings.category,
        severity: trainingQualityFindings.severity,
        status: trainingQualityFindings.status,
        title: trainingQualityFindings.title,
        description: trainingQualityFindings.description,
        rootCause: trainingQualityFindings.rootCause,
        actionPlan: trainingQualityFindings.actionPlan,
        ownerId: trainingQualityFindings.ownerId,
        dueDate: trainingQualityFindings.dueDate,
        closureEvidence: trainingQualityFindings.closureEvidence,
        effectivenessReview: trainingQualityFindings.effectivenessReview,
        closedAt: trainingQualityFindings.closedAt,
        createdAt: trainingQualityFindings.createdAt,
        updatedAt: trainingQualityFindings.updatedAt,
        sessionReference: trainingSessions.referenceNumber,
        participantName: trainingParticipants.fullName,
        ownerName: users.name,
      })
      .from(trainingQualityFindings)
      .innerJoin(trainingSessions, eq(trainingSessions.id, trainingQualityFindings.sessionId))
      .leftJoin(trainingParticipants, eq(trainingParticipants.id, trainingQualityFindings.participantId))
      .leftJoin(users, eq(users.id, trainingQualityFindings.ownerId))
      .orderBy(desc(trainingQualityFindings.updatedAt))
      .limit(300),
    db
      .select({ id: users.id, name: users.name, role: users.role, isActive: users.isActive })
      .from(users)
      .where(eq(users.isActive, true))
      .orderBy(users.name)
      .limit(300),
  ]);

  const internalOwners = activeUsers.filter((item) => item.role !== "transporter_user");
  const ratings = feedback.flatMap((item) => [item.contentRating, item.instructorRating, item.practicalRating, item.safetyRating, item.overallRating]);
  const effectivenessScore = calculateTrainingEffectivenessScore(ratings);
  const openFindings = findings.filter((item) => !["closed", "dismissed"].includes(item.status));
  const overdueFindings = openFindings.filter((item) => isQualityFindingOverdue(item.status, item.dueDate));
  const seriousFindings = openFindings.filter((item) => ["high", "critical"].includes(item.severity));
  const verifiedClosed = findings.filter((item) => item.status === "closed").length;

  return (
    <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Training Quality & Corrective Action"
        description="Measure training effectiveness, capture structured feedback, raise quality findings, assign corrective/preventive actions, and verify effectiveness before closure."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Effectiveness score" value={`${effectivenessScore}%`} hint={`${feedback.length} feedback records`} icon={<BarChart3 className="h-5 w-5" />} tone="blue" />
        <SummaryCard label="Open findings" value={openFindings.length} hint={`${seriousFindings.length} high / critical`} icon={<ClipboardList className="h-5 w-5" />} tone={seriousFindings.length ? "red" : "amber"} />
        <SummaryCard label="Overdue CAPA" value={overdueFindings.length} hint="Open findings past due" icon={<AlertTriangle className="h-5 w-5" />} tone={overdueFindings.length ? "red" : "slate"} />
        <SummaryCard label="Verified closures" value={verifiedClosed} hint="Closed after effectiveness review" icon={<CheckCircle2 className="h-5 w-5" />} tone="emerald" />
      </div>

      {canManage && (
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Card className="overflow-hidden">
            <div className="border-b border-[var(--vims-line)] px-5 py-4 sm:px-6">
              <h2 className="font-semibold text-[var(--vims-ink)]">Capture feedback</h2>
              <p className="mt-1 text-sm text-[var(--vims-ink-muted)]">Ratings of 1–2 for overall experience or safety automatically raise a quality finding for review.</p>
            </div>
            <form action={submitTrainingFeedback} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
              <div className="sm:col-span-2"><Field label="Training session" required><Select name="sessionId" required defaultValue=""><option value="" disabled>Select completed/in-progress session</option>{sessions.map((session) => <option key={session.id} value={session.id}>{session.referenceNumber} · {serviceNames.get(session.serviceId) || session.title}</option>)}</Select></Field></div>
              <Field label="Participant" hint="Optional for client/instructor/observer feedback"><Select name="participantId" defaultValue=""><option value="">No participant scope</option>{participants.map((participant) => <option key={participant.id} value={participant.id}>{participant.fullName} · {participant.sessionReference}</option>)}</Select></Field>
              <Field label="Respondent" required><Select name="respondentType" defaultValue="participant" required><option value="participant">Participant</option><option value="client">Client</option><option value="instructor">Instructor</option><option value="observer">Observer</option></Select></Field>
              {[["contentRating", "Training content"], ["instructorRating", "Instructor"], ["practicalRating", "Practical delivery"], ["safetyRating", "Safety"], ["overallRating", "Overall"]].map(([name, label]) => <Field key={name} label={`${label} rating`} required><Select name={name} defaultValue="5" required><option value="5">5 — Excellent</option><option value="4">4 — Good</option><option value="3">3 — Fair</option><option value="2">2 — Poor</option><option value="1">1 — Critical concern</option></Select></Field>)}
              <Field label="Would recommend?"><Select name="wouldRecommend" defaultValue=""><option value="">Not recorded</option><option value="yes">Yes</option><option value="no">No</option></Select></Field>
              <div className="sm:col-span-2"><Field label="Comments"><TextArea name="comments" maxLength={4000} className="min-h-[76px]" /></Field></div>
              <div className="sm:col-span-2"><Field label="Improvement suggestions"><TextArea name="improvementSuggestions" maxLength={4000} className="min-h-[76px]" /></Field></div>
              <label className="flex items-center gap-2 text-sm text-[var(--vims-ink-soft)]"><input type="checkbox" name="anonymous" className="h-4 w-4" /> Display as anonymous feedback</label>
              <div className="flex justify-end"><Button type="submit"><MessageSquareText className="h-4 w-4" /> Save feedback</Button></div>
            </form>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-[var(--vims-line)] px-5 py-4 sm:px-6">
              <h2 className="font-semibold text-[var(--vims-ink)]">Open quality finding</h2>
              <p className="mt-1 text-sm text-[var(--vims-ink-muted)]">Create a corrective/preventive action record from assessment, evidence, readiness, incident, audit, or management review.</p>
            </div>
            <form action={createTrainingQualityFinding} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
              <div className="sm:col-span-2"><Field label="Training session" required><Select name="sessionId" required defaultValue=""><option value="" disabled>Select session</option>{sessions.map((session) => <option key={session.id} value={session.id}>{session.referenceNumber} · {serviceNames.get(session.serviceId) || session.title}</option>)}</Select></Field></div>
              <Field label="Participant"><Select name="participantId" defaultValue=""><option value="">Session-level finding</option>{participants.map((participant) => <option key={participant.id} value={participant.id}>{participant.fullName} · {participant.sessionReference}</option>)}</Select></Field>
              <Field label="Source" required><Select name="source" defaultValue="management_review" required><option value="feedback">Feedback</option><option value="assessment">Assessment</option><option value="evidence">Evidence</option><option value="readiness">Readiness</option><option value="incident">Incident</option><option value="audit">Audit</option><option value="management_review">Management review</option></Select></Field>
              <Field label="Category" required><Select name="category" defaultValue="training_content" required><option value="training_content">Training content</option><option value="instructor">Instructor</option><option value="safety">Safety</option><option value="equipment">Equipment</option><option value="attendance">Attendance</option><option value="assessment">Assessment</option><option value="documentation">Documentation</option><option value="client_service">Client service</option><option value="other">Other</option></Select></Field>
              <Field label="Severity" required><Select name="severity" defaultValue="medium" required><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></Select></Field>
              <div className="sm:col-span-2"><Field label="Finding title" required><TextInput name="title" required minLength={3} maxLength={220} /></Field></div>
              <div className="sm:col-span-2"><Field label="Description" required><TextArea name="description" required minLength={5} maxLength={4000} className="min-h-[86px]" /></Field></div>
              <Field label="Action owner"><Select name="ownerId" defaultValue=""><option value="">Unassigned</option>{internalOwners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}</Select></Field>
              <Field label="Due date"><TextInput name="dueDate" type="date" /></Field>
              <div className="sm:col-span-2"><Field label="Root cause (if known)"><TextArea name="rootCause" maxLength={4000} className="min-h-[68px]" /></Field></div>
              <div className="sm:col-span-2"><Field label="Corrective / preventive action plan"><TextArea name="actionPlan" maxLength={4000} className="min-h-[68px]" /></Field></div>
              <div className="sm:col-span-2 flex justify-end"><Button type="submit"><ShieldAlert className="h-4 w-4" /> Open finding</Button></div>
            </form>
          </Card>
        </div>
      )}

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-[var(--vims-line)] px-5 py-4 sm:px-6"><h2 className="font-semibold text-[var(--vims-ink)]">Quality findings & CAPA register</h2><p className="mt-1 text-sm text-[var(--vims-ink-muted)]">Closure is allowed only from verification and requires root cause, action plan, closure evidence, and effectiveness review.</p></div>
        {findings.length === 0 ? <div className="p-5 sm:p-6"><EmptyState icon={<ClipboardList className="h-5 w-5" />} title="No quality findings" description="Quality findings raised from low feedback or management review will appear here." /></div> : <div className="divide-y divide-[var(--vims-line)]">{findings.map((finding) => {
          const overdue = isQualityFindingOverdue(finding.status, finding.dueDate);
          return <div key={finding.id} className="p-5 sm:p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-[var(--vims-ink)]">{finding.title}</p><Badge tone={severityTone(finding.severity)}>{finding.severity}</Badge><Badge tone={statusTone(finding.status)}>{finding.status.replaceAll("_", " ")}</Badge>{overdue && <Badge tone="red">overdue</Badge>}</div><p className="mt-1 text-xs text-[var(--vims-ink-muted)]">{finding.sessionReference} · {finding.source.replaceAll("_", " ")} · {finding.category.replaceAll("_", " ")}{finding.participantName ? ` · ${finding.participantName}` : ""}</p></div><div className="text-xs text-[var(--vims-ink-muted)] lg:text-right"><p>Owner: {finding.ownerName || "Unassigned"}</p><p className="mt-1">Due: {finding.dueDate ? formatDate(finding.dueDate) : "Not set"}</p><p className="mt-1">Updated {formatDateTime(finding.updatedAt)}</p></div></div>
            <p className="mt-3 text-sm leading-6 text-[var(--vims-ink-soft)]">{finding.description}</p>
            {(finding.rootCause || finding.actionPlan) && <div className="mt-3 grid gap-3 lg:grid-cols-2">{finding.rootCause && <div className="rounded-xl bg-[var(--vims-panel-soft)] p-3"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--vims-ink-muted)]">Root cause</p><p className="mt-1 text-sm text-[var(--vims-ink-soft)]">{finding.rootCause}</p></div>}{finding.actionPlan && <div className="rounded-xl bg-[var(--vims-panel-soft)] p-3"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--vims-ink-muted)]">Action plan</p><p className="mt-1 text-sm text-[var(--vims-ink-soft)]">{finding.actionPlan}</p></div>}</div>}
            {finding.status === "closed" && <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Verified closure</p><p className="mt-1 text-sm text-emerald-900">{finding.effectivenessReview}</p><p className="mt-2 text-xs text-emerald-700">Closure evidence: {finding.closureEvidence} · Closed {finding.closedAt ? formatDateTime(finding.closedAt) : "—"}</p></div>}
            {canManage && !["closed", "dismissed"].includes(finding.status) && <div className="mt-4 grid gap-3 xl:grid-cols-2">
              <details className="rounded-xl border border-[var(--vims-line)] bg-[var(--vims-panel-soft)] p-3" open={finding.status !== "verification"}><summary className="cursor-pointer text-sm font-semibold text-[var(--vims-ink)]">Update CAPA progress</summary><form action={updateTrainingQualityFinding} className="mt-3 grid gap-3 sm:grid-cols-2"><input type="hidden" name="findingId" value={finding.id} /><Field label="Status"><Select name="status" defaultValue={finding.status}><option value="open">Open</option><option value="in_progress">In progress</option><option value="verification">Verification</option><option value="dismissed">Dismissed</option></Select></Field><Field label="Owner"><Select name="ownerId" defaultValue={finding.ownerId || ""}><option value="">Unassigned</option>{internalOwners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}</Select></Field><Field label="Due date"><TextInput name="dueDate" type="date" defaultValue={finding.dueDate || ""} /></Field><Field label="Progress note"><TextInput name="note" maxLength={2000} /></Field><div className="sm:col-span-2"><Field label="Root cause"><TextArea name="rootCause" maxLength={4000} defaultValue={finding.rootCause || ""} className="min-h-[64px]" /></Field></div><div className="sm:col-span-2"><Field label="Action plan"><TextArea name="actionPlan" maxLength={4000} defaultValue={finding.actionPlan || ""} className="min-h-[64px]" /></Field></div><div className="sm:col-span-2 flex justify-end"><Button type="submit" size="sm" variant="secondary">Save progress</Button></div></form></details>
              {finding.status === "verification" && <details className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><summary className="cursor-pointer text-sm font-semibold text-emerald-900">Controlled closure</summary><form action={closeTrainingQualityFinding} className="mt-3 space-y-3"><input type="hidden" name="findingId" value={finding.id} /><Field label="Root cause" required><TextArea name="rootCause" required minLength={5} maxLength={4000} defaultValue={finding.rootCause || ""} className="min-h-[62px]" /></Field><Field label="Action plan" required><TextArea name="actionPlan" required minLength={5} maxLength={4000} defaultValue={finding.actionPlan || ""} className="min-h-[62px]" /></Field><Field label="Closure evidence" required><TextArea name="closureEvidence" required minLength={5} maxLength={4000} className="min-h-[62px]" placeholder="Reference the completed corrective/preventive action evidence" /></Field><Field label="Effectiveness review" required><TextArea name="effectivenessReview" required minLength={5} maxLength={4000} className="min-h-[62px]" placeholder="Explain how effectiveness was verified" /></Field><div className="flex justify-end"><Button type="submit" size="sm"><CheckCircle2 className="h-4 w-4" /> Close after verification</Button></div></form></details>}
            </div>}
          </div>;
        })}</div>}
      </Card>

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-[var(--vims-line)] px-5 py-4 sm:px-6"><h2 className="font-semibold text-[var(--vims-ink)]">Recent feedback</h2><p className="mt-1 text-sm text-[var(--vims-ink-muted)]">Feedback identity is hidden in this register when the response is marked anonymous, while the authenticated capture remains available to the audit system.</p></div>
        {feedback.length === 0 ? <div className="p-5"><EmptyState icon={<MessageSquareText className="h-5 w-5" />} title="No feedback captured" /></div> : <div className="grid gap-px bg-[var(--vims-line)] md:grid-cols-2 xl:grid-cols-3">{feedback.slice(0, 30).map((item) => { const signal = feedbackQualitySignal(item.overallRating, item.safetyRating); return <div key={item.id} className="bg-[var(--vims-panel-solid)] p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-[var(--vims-ink)]">{item.sessionReference}</p><p className="mt-1 text-xs text-[var(--vims-ink-muted)]">{item.respondentType} · {item.anonymous ? "Anonymous" : item.participantName || "Session-level"}</p></div><Badge tone={severityTone(signal)}>{item.overallRating}/5</Badge></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--vims-ink-muted)]"><span>Content {item.contentRating}/5</span><span>Instructor {item.instructorRating}/5</span><span>Practical {item.practicalRating}/5</span><span>Safety {item.safetyRating}/5</span></div>{item.comments && <p className="mt-3 text-sm leading-6 text-[var(--vims-ink-soft)]">{item.comments}</p>}{item.improvementSuggestions && <p className="mt-2 text-xs text-[var(--vims-ink-muted)]">Improve: {item.improvementSuggestions}</p>}</div>; })}</div>}
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, hint, icon, tone }: { label: string; value: string | number; hint: string; icon: React.ReactNode; tone: "blue" | "red" | "amber" | "slate" | "emerald" }) {
  const cls = tone === "red" ? "bg-red-50 text-red-700" : tone === "amber" ? "bg-amber-50 text-amber-700" : tone === "emerald" ? "bg-emerald-50 text-emerald-700" : tone === "blue" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-700";
  return <Card className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--vims-ink-muted)]">{label}</p><p className="mt-2 text-2xl font-semibold text-[var(--vims-ink)]">{value}</p><p className="mt-1 text-xs text-[var(--vims-ink-muted)]">{hint}</p></div><div className={`grid h-10 w-10 place-items-center rounded-xl ${cls}`}>{icon}</div></div></Card>;
}
