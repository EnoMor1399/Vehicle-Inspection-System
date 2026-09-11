import type { ReactNode } from "react";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { AlertTriangle, Ban, CheckCircle2, HardHat, ShieldAlert, Siren } from "lucide-react";
import { db } from "@/db";
import { users } from "@/db/schema";
import { trainingParticipants, trainingSessions } from "@/db/training-schema";
import { trainingRiskAssessments, trainingSafetyHazards, trainingSafetyIncidents } from "@/db/training-safety-schema";
import { Badge, Button, Card, EmptyState, PageHeader, StatCard, TextArea, TextInput as Input } from "@/components/ui";
import { requireInternalUser } from "@/lib/require-auth";
import { canManageTraining, canViewTraining } from "@/lib/training-access";
import {
  canApproveTrainingRiskAssessment,
  canTransitionTrainingSafetyIncident,
  safetyIncidentRequiresStopWork,
  trainingSafetyIncidentClosureReady,
  trainingSafetyRiskLevel,
} from "@/lib/training-safety-policy";
import { formatDateTime } from "@/lib/utils";
import {
  addTrainingSafetyHazard,
  createTrainingRiskAssessment,
  reportTrainingSafetyIncident,
  transitionTrainingRiskAssessment,
  transitionTrainingSafetyIncident,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function TrainingSafetyPage() {
  const user = await requireInternalUser();
  if (!canViewTraining(user)) {
    return <div className="p-8 text-sm text-slate-600">You do not have access to Driver Training & Assessment Services.</div>;
  }
  const canManage = canManageTraining(user);

  const [sessions, participants, assessments, hazards, incidents, internalUsers] = await Promise.all([
    db.select().from(trainingSessions).orderBy(desc(trainingSessions.startAt)).limit(500),
    db.select().from(trainingParticipants).orderBy(asc(trainingParticipants.fullName)).limit(1500),
    db.select().from(trainingRiskAssessments).orderBy(desc(trainingRiskAssessments.assessedAt)).limit(500),
    db.select().from(trainingSafetyHazards).orderBy(desc(trainingSafetyHazards.createdAt)).limit(2000),
    db.select().from(trainingSafetyIncidents).orderBy(desc(trainingSafetyIncidents.occurredAt)).limit(1000),
    db.select({ id: users.id, name: users.name, role: users.role }).from(users).where(and(eq(users.isActive, true), ne(users.role, "transporter_user"))).orderBy(asc(users.name)).limit(300),
  ]);

  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const participantById = new Map(participants.map((participant) => [participant.id, participant]));
  const userById = new Map(internalUsers.map((member) => [member.id, member]));
  const hazardsByAssessment = new Map<string, typeof hazards>();
  for (const hazard of hazards) {
    const items = hazardsByAssessment.get(hazard.assessmentId) || [];
    items.push(hazard);
    hazardsByAssessment.set(hazard.assessmentId, items);
  }
  const participantsBySession = new Map<string, typeof participants>();
  for (const participant of participants) {
    const items = participantsBySession.get(participant.sessionId) || [];
    items.push(participant);
    participantsBySession.set(participant.sessionId, items);
  }
  const assessedSessionIds = new Set(assessments.map((item) => item.sessionId));
  const scheduledWithoutAssessment = sessions.filter((session) => session.status === "scheduled" && !assessedSessionIds.has(session.id));
  const blockedAssessments = assessments.filter((item) => item.status === "blocked").length;
  const openIncidents = incidents.filter((item) => item.status !== "closed");
  const stopWorkIncidents = openIncidents.filter((item) => item.stopWork).length;
  const criticalIncidents = openIncidents.filter((item) => item.severity === "critical" || item.severity === "high").length;

  return (
    <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Training Safety, Risk & Incidents"
        description="Control practical-training hazards before delivery, document residual risk and emergency arrangements, exercise stop-work authority, and manage incidents or near misses through investigation, corrective action, verification, and closure."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Awaiting assessment" value={scheduledWithoutAssessment.length} hint="Scheduled sessions without risk assessment" tone={scheduledWithoutAssessment.length > 0 ? "amber" : "emerald"} icon={<HardHat className="h-5 w-5" />} />
        <StatCard label="Blocked assessments" value={blockedAssessments} hint="Stop-work required before delivery" tone={blockedAssessments > 0 ? "red" : "emerald"} icon={<Ban className="h-5 w-5" />} />
        <StatCard label="Open incidents" value={openIncidents.length} hint="Not yet formally closed" tone={openIncidents.length > 0 ? "amber" : "emerald"} icon={<Siren className="h-5 w-5" />} />
        <StatCard label="Stop-work cases" value={stopWorkIncidents} hint="Open incidents with stop-work control" tone={stopWorkIncidents > 0 ? "red" : "slate"} icon={<ShieldAlert className="h-5 w-5" />} />
        <StatCard label="High / critical" value={criticalIncidents} hint="Serious open safety events" tone={criticalIncidents > 0 ? "red" : "emerald"} icon={<AlertTriangle className="h-5 w-5" />} />
      </div>

      {canManage && (
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Card className="p-5 sm:p-6">
            <h2 className="font-semibold text-[var(--vims-ink)]">Create session risk assessment</h2>
            <p className="mt-1 text-sm text-[var(--vims-ink-muted)]">Risk assessments are created only for scheduled sessions. Add hazards and controls before approval.</p>
            <form action={createTrainingRiskAssessment} className="mt-5 space-y-4">
              <Field label="Scheduled session"><select name="sessionId" required className={selectClass}><option value="">Select session</option>{scheduledWithoutAssessment.map((session) => <option key={session.id} value={session.id}>{session.referenceNumber} · {session.title}</option>)}</select></Field>
              <Field label="Activity scope"><TextArea name="activityScope" required maxLength={4000} className="min-h-[90px]" placeholder="Practical driving exercises, route, manoeuvres, vehicle/equipment use and participant exposure." /></Field>
              <Field label="Emergency plan"><TextArea name="emergencyPlan" required maxLength={4000} className="min-h-[90px]" placeholder="Emergency communication, first aid, evacuation, breakdown and escalation arrangements." /></Field>
              <div className="grid gap-4 sm:grid-cols-2"><Field label="Initial overall risk"><select name="overallRisk" defaultValue="medium" className={selectClass}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></Field><Field label="Notes"><Input name="notes" maxLength={4000} /></Field></div>
              <div className="flex justify-end"><Button type="submit"><HardHat className="h-4 w-4" /> Create assessment</Button></div>
            </form>
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="font-semibold text-[var(--vims-ink)]">Report safety incident or near miss</h2>
            <p className="mt-1 text-sm text-[var(--vims-ink-muted)]">High/critical events, injuries and equipment failures automatically enforce stop-work.</p>
            <form action={reportTrainingSafetyIncident} className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Training session" className="sm:col-span-2"><select name="sessionId" required className={selectClass}><option value="">Select session</option>{sessions.filter((session) => session.status !== "cancelled").map((session) => <option key={session.id} value={session.id}>{session.referenceNumber} · {session.title}</option>)}</select></Field>
              <Field label="Incident type"><select name="incidentType" required className={selectClass}><option value="near_miss">Near miss</option><option value="unsafe_condition">Unsafe condition</option><option value="first_aid">First aid</option><option value="injury">Injury</option><option value="property_damage">Property damage</option><option value="environmental">Environmental</option><option value="equipment_failure">Equipment failure</option><option value="other">Other</option></select></Field>
              <Field label="Severity"><select name="severity" defaultValue="low" className={selectClass}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></Field>
              <Field label="Occurred at"><Input name="occurredAt" type="datetime-local" required /></Field>
              <Field label="Location"><Input name="location" maxLength={300} /></Field>
              <Field label="Participant (optional)" className="sm:col-span-2"><select name="participantId" className={selectClass}><option value="">Not participant-specific</option>{participants.map((participant) => <option key={participant.id} value={participant.id}>{participant.fullName} · {sessionById.get(participant.sessionId)?.referenceNumber || participant.sessionId}</option>)}</select></Field>
              <Field label="Owner"><select name="ownerId" className={selectClass}><option value="">Unassigned</option>{internalUsers.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.role.replaceAll("_", " ")}</option>)}</select></Field>
              <label className="flex items-end gap-2 pb-2 text-sm text-[var(--vims-ink-soft)]"><input type="checkbox" name="stopWork" /> Apply stop-work control</label>
              <Field label="What happened" className="sm:col-span-2"><TextArea name="description" required maxLength={6000} className="min-h-[90px]" /></Field>
              <Field label="Immediate actions" className="sm:col-span-2"><TextArea name="immediateActions" required maxLength={6000} className="min-h-[90px]" /></Field>
              <div className="sm:col-span-2 flex justify-end"><Button type="submit"><Siren className="h-4 w-4" /> Report incident</Button></div>
            </form>
          </Card>
        </div>
      )}

      <section className="mt-6 space-y-6">
        <Card className="overflow-hidden">
          <div className="border-b border-[var(--vims-line)] px-5 py-4 sm:px-6"><h2 className="font-semibold text-[var(--vims-ink)]">Session risk assessments</h2><p className="mt-1 text-sm text-[var(--vims-ink-muted)]">An approved safety assessment supports readiness evidence but does not silently mark the separate readiness checklist complete.</p></div>
          {assessments.length === 0 ? <div className="p-5"><EmptyState title="No risk assessments" description="Create a structured assessment for a scheduled practical-training session." /></div> : <div className="divide-y divide-[var(--vims-line)]">{assessments.map((assessment) => {
            const session = sessionById.get(assessment.sessionId);
            const assessmentHazards = hazardsByAssessment.get(assessment.id) || [];
            const openHazards = assessmentHazards.filter((hazard) => hazard.status === "open");
            const maxResidual = assessmentHazards.reduce((value, hazard) => Math.max(value, hazard.residualRiskScore), 0);
            const approvalReady = canApproveTrainingRiskAssessment({ sessionStatus: session?.status || "missing", stopWorkRequired: false, hazardCount: assessmentHazards.length, openHazardCount: openHazards.length, maxResidualRiskScore: maxResidual });
            return <article key={assessment.id} className="p-5 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-[var(--vims-ink)]">{session?.referenceNumber || assessment.sessionId} · {session?.title || "Session"}</h3><Badge tone={assessment.status === "approved" ? "emerald" : assessment.status === "blocked" ? "red" : "amber"}>{assessment.status}</Badge><Badge tone={riskTone(assessment.overallRisk)}>{assessment.overallRisk} initial risk</Badge>{maxResidual > 0 && <Badge tone={riskTone(trainingSafetyRiskLevel(maxResidual))}>max residual {maxResidual}</Badge>}</div><p className="mt-2 max-w-4xl text-sm text-[var(--vims-ink-soft)]">{assessment.activityScope}</p><p className="mt-2 text-xs text-[var(--vims-ink-muted)]">Assessed {formatDateTime(assessment.assessedAt)} · {assessmentHazards.length} hazards · {openHazards.length} open</p></div>
                {canManage && !["approved", "superseded"].includes(assessment.status) && <div className="flex flex-wrap justify-end gap-2">{approvalReady && <form action={transitionTrainingRiskAssessment}><input type="hidden" name="assessmentId" value={assessment.id} /><input type="hidden" name="status" value="approved" /><Button type="submit" size="sm"><CheckCircle2 className="h-4 w-4" /> Approve risk assessment</Button></form>}<form action={transitionTrainingRiskAssessment}><input type="hidden" name="assessmentId" value={assessment.id} /><input type="hidden" name="status" value="blocked" /><Button type="submit" size="sm">Apply stop-work</Button></form></div>}
              </div>
              <div className="mt-4 rounded-xl border border-[var(--vims-line)] bg-[var(--vims-panel-soft)] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--vims-ink-muted)]">Emergency plan</p><p className="mt-1 text-sm text-[var(--vims-ink-soft)]">{assessment.emergencyPlan}</p></div>
              <div className="mt-4 grid gap-3">{assessmentHazards.map((hazard) => <div key={hazard.id} className="rounded-xl border border-[var(--vims-line)] p-4"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-[var(--vims-ink)]">{hazard.hazard}</p><Badge tone={hazard.status === "open" ? "red" : "emerald"}>{hazard.status}</Badge><Badge tone={riskTone(trainingSafetyRiskLevel(hazard.initialRiskScore))}>initial {hazard.initialRiskScore}</Badge><Badge tone={riskTone(trainingSafetyRiskLevel(hazard.residualRiskScore))}>residual {hazard.residualRiskScore}</Badge></div><p className="mt-2 text-sm text-[var(--vims-ink-soft)]">Consequence: {hazard.consequence}</p><p className="mt-1 text-sm text-[var(--vims-ink-soft)]">Controls: {hazard.controls}</p>{hazard.ownerId && <p className="mt-1 text-xs text-[var(--vims-ink-muted)]">Owner: {userById.get(hazard.ownerId)?.name || hazard.ownerId}</p>}</div>)}</div>
              {canManage && ["draft", "blocked"].includes(assessment.status) && <form action={addTrainingSafetyHazard} className="mt-5 rounded-xl border border-[var(--vims-line)] bg-[var(--vims-panel-soft)] p-4"><input type="hidden" name="assessmentId" value={assessment.id} /><p className="text-sm font-semibold text-[var(--vims-ink)]">Add hazard and controls</p><div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4"><Field label="Hazard" className="md:col-span-2"><Input name="hazard" required maxLength={2000} /></Field><Field label="Consequence" className="md:col-span-2"><Input name="consequence" required maxLength={2000} /></Field><Field label="Initial likelihood 1–5"><Input name="likelihood" type="number" min="1" max="5" required /></Field><Field label="Initial severity 1–5"><Input name="severity" type="number" min="1" max="5" required /></Field><Field label="Residual likelihood 1–5"><Input name="residualLikelihood" type="number" min="1" max="5" required /></Field><Field label="Residual severity 1–5"><Input name="residualSeverity" type="number" min="1" max="5" required /></Field><Field label="Controls" className="md:col-span-2"><TextArea name="controls" required maxLength={4000} className="min-h-[80px]" /></Field><Field label="Control status"><select name="status" defaultValue="controlled" className={selectClass}><option value="open">Open</option><option value="controlled">Controlled</option><option value="accepted">Accepted</option></select></Field><Field label="Owner"><select name="ownerId" className={selectClass}><option value="">Unassigned</option>{internalUsers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></Field></div><div className="mt-3 flex justify-end"><Button type="submit">Add hazard</Button></div></form>}
            </article>;
          })}</div>}
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-[var(--vims-line)] px-5 py-4 sm:px-6"><h2 className="font-semibold text-[var(--vims-ink)]">Incident & near-miss register</h2><p className="mt-1 text-sm text-[var(--vims-ink-muted)]">Safety events move through investigation → corrective action → verification → controlled closure.</p></div>
          {incidents.length === 0 ? <div className="p-5"><EmptyState title="No safety incidents" description="Near misses, unsafe conditions and incidents will appear here." /></div> : <div className="divide-y divide-[var(--vims-line)]">{incidents.map((incident) => {
            const session = sessionById.get(incident.sessionId);
            const participant = incident.participantId ? participantById.get(incident.participantId) : undefined;
            const closureReady = trainingSafetyIncidentClosureReady({ status: incident.status, rootCause: incident.rootCause, correctiveActions: incident.correctiveActions, evidenceReference: incident.evidenceReference, closureReview: incident.closureReview });
            return <article key={incident.id} className="p-5 sm:p-6"><div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-[var(--vims-ink)]">{incident.incidentNumber}</h3><Badge tone={incident.status === "closed" ? "emerald" : "amber"}>{incident.status.replaceAll("_", " ")}</Badge><Badge tone={riskTone(incident.severity)}>{incident.severity}</Badge><Badge tone="slate">{incident.incidentType.replaceAll("_", " ")}</Badge>{incident.stopWork && <Badge tone="red">STOP WORK</Badge>}</div><p className="mt-2 text-sm text-[var(--vims-ink-soft)]">{incident.description}</p><p className="mt-2 text-xs text-[var(--vims-ink-muted)]">{session?.referenceNumber || incident.sessionId} · {formatDateTime(incident.occurredAt)}{participant ? ` · ${participant.fullName}` : ""}{incident.location ? ` · ${incident.location}` : ""}</p><p className="mt-2 text-sm text-[var(--vims-ink-soft)]"><strong>Immediate actions:</strong> {incident.immediateActions}</p>{incident.rootCause && <p className="mt-2 text-sm text-[var(--vims-ink-soft)]"><strong>Root cause:</strong> {incident.rootCause}</p>}{incident.correctiveActions && <p className="mt-1 text-sm text-[var(--vims-ink-soft)]"><strong>Corrective actions:</strong> {incident.correctiveActions}</p>}{incident.evidenceReference && <p className="mt-1 text-xs text-[var(--vims-ink-muted)]">Evidence: {incident.evidenceReference}</p>}{incident.closureReview && <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-sm text-[var(--vims-ink-soft)]"><strong>Closure review:</strong> {incident.closureReview}</div>}</div>{canManage && incident.status !== "closed" && <IncidentControls incident={incident} closureReady={closureReady} />}</div></article>;
          })}</div>}
        </Card>
      </section>
    </div>
  );
}

function IncidentControls({ incident, closureReady }: { incident: typeof trainingSafetyIncidents.$inferSelect; closureReady: boolean }) {
  return <div className="w-full max-w-lg space-y-3">
    {canTransitionTrainingSafetyIncident(incident.status, "investigating") && <form action={transitionTrainingSafetyIncident} className="flex justify-end"><input type="hidden" name="incidentId" value={incident.id} /><input type="hidden" name="status" value="investigating" /><Button type="submit" size="sm">Start investigation</Button></form>}
    {canTransitionTrainingSafetyIncident(incident.status, "corrective_action") && <form action={transitionTrainingSafetyIncident} className="rounded-xl border border-[var(--vims-line)] bg-[var(--vims-panel-soft)] p-3"><input type="hidden" name="incidentId" value={incident.id} /><input type="hidden" name="status" value="corrective_action" /><div className="space-y-2"><Field label="Root cause"><TextArea name="rootCause" maxLength={6000} defaultValue={incident.rootCause || ""} className="min-h-[70px]" /></Field><Field label="Corrective actions"><TextArea name="correctiveActions" maxLength={6000} defaultValue={incident.correctiveActions || ""} className="min-h-[70px]" /></Field></div><div className="mt-2 flex justify-end"><Button type="submit" size="sm">Move to corrective action</Button></div></form>}
    {canTransitionTrainingSafetyIncident(incident.status, "verification") && <form action={transitionTrainingSafetyIncident} className="rounded-xl border border-[var(--vims-line)] bg-[var(--vims-panel-soft)] p-3"><input type="hidden" name="incidentId" value={incident.id} /><input type="hidden" name="status" value="verification" /><div className="space-y-2"><Field label="Root cause"><TextArea name="rootCause" required maxLength={6000} defaultValue={incident.rootCause || ""} className="min-h-[65px]" /></Field><Field label="Corrective actions"><TextArea name="correctiveActions" required maxLength={6000} defaultValue={incident.correctiveActions || ""} className="min-h-[65px]" /></Field><Field label="Evidence reference"><Input name="evidenceReference" maxLength={500} defaultValue={incident.evidenceReference || ""} /></Field></div><div className="mt-2 flex justify-end"><Button type="submit" size="sm">Enter verification</Button></div></form>}
    {canTransitionTrainingSafetyIncident(incident.status, "closed") && <form action={transitionTrainingSafetyIncident} className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3"><input type="hidden" name="incidentId" value={incident.id} /><input type="hidden" name="status" value="closed" /><div className="space-y-2"><Field label="Root cause"><TextArea name="rootCause" required maxLength={6000} defaultValue={incident.rootCause || ""} className="min-h-[60px]" /></Field><Field label="Corrective actions"><TextArea name="correctiveActions" required maxLength={6000} defaultValue={incident.correctiveActions || ""} className="min-h-[60px]" /></Field><Field label="Evidence reference"><Input name="evidenceReference" required maxLength={500} defaultValue={incident.evidenceReference || ""} /></Field><Field label="Closure review"><TextArea name="closureReview" required maxLength={6000} defaultValue={incident.closureReview || ""} className="min-h-[70px]" /></Field></div><div className="mt-2 flex items-center justify-between gap-3"><span className="text-xs text-[var(--vims-ink-muted)]">{closureReady ? "Existing evidence is closure-ready." : "All closure fields are required."}</span><Button type="submit" size="sm"><CheckCircle2 className="h-4 w-4" /> Close incident</Button></div></form>}
  </div>;
}

function riskTone(level: string): "red" | "amber" | "blue" | "emerald" | "slate" {
  if (level === "critical" || level === "high") return "red";
  if (level === "medium") return "amber";
  if (level === "low") return "emerald";
  return "slate";
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`block ${className}`}><span className="mb-1.5 block text-xs font-medium text-[var(--vims-ink-soft)]">{label}</span>{children}</label>;
}

const selectClass = "min-h-10 w-full rounded-lg border border-[var(--vims-line)] bg-[var(--vims-panel-solid)] px-3 py-2 text-sm text-[var(--vims-ink)] outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
