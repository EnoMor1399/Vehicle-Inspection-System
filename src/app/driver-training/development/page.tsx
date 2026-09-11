import type { ReactNode } from "react";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { CheckCircle2, ClipboardCheck, ListTodo, Target, TriangleAlert } from "lucide-react";
import { db } from "@/db";
import { users } from "@/db/schema";
import { trainingAssessments, trainingParticipants } from "@/db/training-schema";
import { trainingDevelopmentActions, trainingDevelopmentPlans } from "@/db/training-development-schema";
import { Badge, Button, Card, EmptyState, PageHeader, StatCard, TextArea, TextInput as Input } from "@/components/ui";
import { requireInternalUser } from "@/lib/require-auth";
import { canManageTraining, canViewTraining } from "@/lib/training-access";
import {
  canTransitionTrainingDevelopmentAction,
  canTransitionTrainingDevelopmentPlan,
  isTrainingDevelopmentActionOverdue,
} from "@/lib/training-development-policy";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  addTrainingDevelopmentAction,
  createTrainingDevelopmentPlan,
  transitionTrainingDevelopmentAction,
  transitionTrainingDevelopmentPlan,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function TrainingDevelopmentPage() {
  const user = await requireInternalUser();
  if (!canViewTraining(user)) {
    return <div className="p-8 text-sm text-slate-600">You do not have access to Driver Training & Assessment Services.</div>;
  }
  const canManage = canManageTraining(user);

  const [plans, actions, participants, assessments, internalUsers] = await Promise.all([
    db.select().from(trainingDevelopmentPlans).orderBy(desc(trainingDevelopmentPlans.createdAt)).limit(300),
    db.select().from(trainingDevelopmentActions).orderBy(desc(trainingDevelopmentActions.createdAt)).limit(1500),
    db.select().from(trainingParticipants).orderBy(asc(trainingParticipants.fullName)).limit(1000),
    db.select().from(trainingAssessments).orderBy(desc(trainingAssessments.assessedAt)).limit(1000),
    db
      .select({ id: users.id, name: users.name, role: users.role })
      .from(users)
      .where(and(eq(users.isActive, true), ne(users.role, "transporter_user")))
      .orderBy(asc(users.name))
      .limit(300),
  ]);

  const participantById = new Map(participants.map((participant) => [participant.id, participant]));
  const assessmentById = new Map(assessments.map((assessment) => [assessment.id, assessment]));
  const userById = new Map(internalUsers.map((member) => [member.id, member]));
  const actionsByPlan = new Map<string, typeof actions>();
  for (const action of actions) {
    const items = actionsByPlan.get(action.planId) || [];
    items.push(action);
    actionsByPlan.set(action.planId, items);
  }

  const activePlans = plans.filter((plan) => !["completed", "cancelled"].includes(plan.status));
  const highPriority = activePlans.filter((plan) => plan.priority === "high" || plan.priority === "critical").length;
  const verification = plans.filter((plan) => plan.status === "verification").length;
  const overdueActions = actions.filter((action) => isTrainingDevelopmentActionOverdue(action.status, action.dueDate)).length;
  const completed = plans.filter((plan) => plan.status === "completed").length;

  return (
    <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Competency Development & Remediation"
        description="Turn assessment gaps into controlled coaching, retraining, reassessment, observation, mentoring, and verification plans with owners, due dates, evidence, and effectiveness closure."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Active plans" value={activePlans.length} hint="Open, in progress, or verification" tone="blue" icon={<Target className="h-5 w-5" />} />
        <StatCard label="High priority" value={highPriority} hint="High or critical development need" tone={highPriority > 0 ? "red" : "slate"} icon={<TriangleAlert className="h-5 w-5" />} />
        <StatCard label="Overdue actions" value={overdueActions} hint="Pending remediation past due" tone={overdueActions > 0 ? "red" : "emerald"} icon={<ListTodo className="h-5 w-5" />} />
        <StatCard label="Verification" value={verification} hint="Awaiting effectiveness closure" tone="amber" icon={<ClipboardCheck className="h-5 w-5" />} />
        <StatCard label="Completed" value={completed} hint="Verified development plans" tone="emerald" icon={<CheckCircle2 className="h-5 w-5" />} />
      </div>

      {canManage && (
        <Card className="mt-6 p-5 sm:p-6">
          <h2 className="font-semibold text-[var(--vims-ink)]">Create competency development plan</h2>
          <p className="mt-1 text-sm text-[var(--vims-ink-muted)]">A plan may reference an assessment, but the selected assessment must belong to the same participant.</p>
          <form action={createTrainingDevelopmentPlan} className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Participant" className="xl:col-span-2"><select name="participantId" required className={selectClass}><option value="">Select participant</option>{participants.map((participant) => <option key={participant.id} value={participant.id}>{participant.fullName}{participant.companyName ? ` · ${participant.companyName}` : ""}</option>)}</select></Field>
            <Field label="Source assessment" className="xl:col-span-2"><select name="sourceAssessmentId" className={selectClass}><option value="">Not linked</option>{assessments.map((assessment) => { const participant = participantById.get(assessment.participantId); return <option key={assessment.id} value={assessment.id}>{participant?.fullName || assessment.participantId} · {assessment.assessmentType.replaceAll("_", " ")} · {assessment.result}</option>; })}</select></Field>
            <Field label="Plan title" className="md:col-span-2"><Input name="title" required maxLength={220} placeholder="Post-assessment defensive driving improvement plan" /></Field>
            <Field label="Priority"><select name="priority" defaultValue="medium" className={selectClass}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></Field>
            <Field label="Target date"><Input name="targetDate" type="date" /></Field>
            <Field label="Plan owner" className="md:col-span-2"><select name="ownerId" className={selectClass}><option value="">Unassigned</option>{internalUsers.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.role.replaceAll("_", " ")}</option>)}</select></Field>
            <Field label="Competency gaps — one per line" className="md:col-span-2 xl:col-span-4"><TextArea name="competencyGaps" required maxLength={8000} className="min-h-[120px]" placeholder="Hazard anticipation\nSafe following distance\nEmergency braking technique" /></Field>
            <div className="md:col-span-2 xl:col-span-4 flex justify-end"><Button type="submit"><Target className="h-4 w-4" /> Create development plan</Button></div>
          </form>
        </Card>
      )}

      <section className="mt-6 space-y-6">
        {plans.length === 0 ? <Card className="p-5"><EmptyState title="No development plans" description="Create a controlled plan when assessment or operational evidence identifies a competency gap." /></Card> : plans.map((plan) => {
          const participant = participantById.get(plan.participantId);
          const sourceAssessment = plan.sourceAssessmentId ? assessmentById.get(plan.sourceAssessmentId) : undefined;
          const planActions = actionsByPlan.get(plan.id) || [];
          const openActions = planActions.filter((action) => action.status === "pending" || action.status === "in_progress");
          const overdue = planActions.filter((action) => isTrainingDevelopmentActionOverdue(action.status, action.dueDate));
          const owner = plan.ownerId ? userById.get(plan.ownerId) : undefined;
          const canEnterVerification = planActions.length > 0 && openActions.length === 0;

          return (
            <Card key={plan.id} className="overflow-hidden">
              <div className="border-b border-[var(--vims-line)] p-5 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-[var(--vims-ink)]">{plan.title}</h2><Badge tone={statusTone(plan.status)}>{plan.status.replaceAll("_", " ")}</Badge><Badge tone={priorityTone(plan.priority)}>{plan.priority}</Badge>{overdue.length > 0 && <Badge tone="red">{overdue.length} overdue</Badge>}</div>
                    <p className="mt-1 text-sm text-[var(--vims-ink-soft)]">{participant?.fullName || plan.participantId}{participant?.companyName ? ` · ${participant.companyName}` : ""}</p>
                    <p className="mt-1 text-xs text-[var(--vims-ink-muted)]">Owner: {owner?.name || "Unassigned"} · Target: {plan.targetDate ? formatDate(plan.targetDate) : "Not set"} · Created {formatDateTime(plan.createdAt)}</p>
                    {sourceAssessment && <p className="mt-1 text-xs text-[var(--vims-ink-muted)]">Source assessment: {sourceAssessment.assessmentType.replaceAll("_", " ")} · {sourceAssessment.result} · {formatDateTime(sourceAssessment.assessedAt)}</p>}
                  </div>
                  {canManage && <PlanTransitionControls plan={plan} canEnterVerification={canEnterVerification} />}
                </div>
                <div className="mt-4"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--vims-ink-muted)]">Competency gaps</p><div className="mt-2 flex flex-wrap gap-2">{plan.competencyGaps.map((gap) => <span key={gap} className="rounded-full border border-[var(--vims-line)] bg-[var(--vims-panel-soft)] px-2.5 py-1 text-xs text-[var(--vims-ink-soft)]">{gap}</span>)}</div></div>
                {plan.verificationSummary && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-sm text-[var(--vims-ink-soft)]"><strong className="text-[var(--vims-ink)]">Effectiveness verification:</strong> {plan.verificationSummary}</div>}
              </div>

              <div className="grid gap-0 xl:grid-cols-[1.2fr_.8fr]">
                <div className="p-5 sm:p-6 xl:border-r xl:border-[var(--vims-line)]">
                  <div className="flex items-center justify-between"><h3 className="font-semibold text-[var(--vims-ink)]">Remediation actions</h3><span className="text-xs text-[var(--vims-ink-muted)]">{openActions.length} open · {planActions.length} total</span></div>
                  {planActions.length === 0 ? <div className="mt-4"><EmptyState title="No remediation actions" description="Add at least one action before the plan can enter verification." /></div> : <div className="mt-4 space-y-3">{planActions.map((action) => (
                    <div key={action.id} className="rounded-xl border border-[var(--vims-line)] bg-[var(--vims-panel-soft)] p-4">
                      <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-[var(--vims-ink)]">{action.actionType.replaceAll("_", " ")}</p><Badge tone={action.status === "completed" ? "emerald" : action.status === "waived" ? "slate" : isTrainingDevelopmentActionOverdue(action.status, action.dueDate) ? "red" : "amber"}>{action.status.replaceAll("_", " ")}</Badge></div>
                      <p className="mt-2 text-sm text-[var(--vims-ink-soft)]">{action.description}</p>
                      <p className="mt-2 text-xs text-[var(--vims-ink-muted)]">Due: {action.dueDate ? formatDate(action.dueDate) : "Not set"}{action.evidenceReference ? ` · Evidence: ${action.evidenceReference}` : ""}</p>
                      {action.notes && <p className="mt-1 text-xs text-[var(--vims-ink-muted)]">{action.notes}</p>}
                      {canManage && <div className="mt-3"><ActionTransitionControls actionId={action.id} status={action.status} /></div>}
                    </div>
                  ))}</div>}
                </div>

                {canManage && ["open", "in_progress"].includes(plan.status) && <div className="border-t border-[var(--vims-line)] p-5 sm:p-6 xl:border-t-0">
                  <h3 className="font-semibold text-[var(--vims-ink)]">Add remediation action</h3>
                  <form action={addTrainingDevelopmentAction} className="mt-4 space-y-4">
                    <input type="hidden" name="planId" value={plan.id} />
                    <Field label="Action type"><select name="actionType" required className={selectClass}><option value="coaching">Coaching</option><option value="retraining">Retraining</option><option value="reassessment">Reassessment</option><option value="practical_observation">Practical observation</option><option value="mentoring">Mentoring</option><option value="medical_review">Medical review</option><option value="administrative">Administrative</option><option value="other">Other</option></select></Field>
                    <Field label="Description"><TextArea name="description" required maxLength={4000} className="min-h-[90px]" /></Field>
                    <Field label="Due date"><Input name="dueDate" type="date" /></Field>
                    <Field label="Notes"><TextArea name="notes" maxLength={4000} className="min-h-[70px]" /></Field>
                    <div className="flex justify-end"><Button type="submit"><ListTodo className="h-4 w-4" /> Add action</Button></div>
                  </form>
                </div>}
              </div>
            </Card>
          );
        })}
      </section>
    </div>
  );
}

function PlanTransitionControls({ plan, canEnterVerification }: { plan: typeof trainingDevelopmentPlans.$inferSelect; canEnterVerification: boolean }) {
  return <div className="flex w-full max-w-md flex-col gap-2">
    <div className="flex flex-wrap justify-end gap-2">
      {canTransitionTrainingDevelopmentPlan(plan.status, "in_progress") && <form action={transitionTrainingDevelopmentPlan}><input type="hidden" name="planId" value={plan.id} /><input type="hidden" name="status" value="in_progress" /><Button type="submit" size="sm">Move to in progress</Button></form>}
      {canEnterVerification && canTransitionTrainingDevelopmentPlan(plan.status, "verification") && <form action={transitionTrainingDevelopmentPlan}><input type="hidden" name="planId" value={plan.id} /><input type="hidden" name="status" value="verification" /><Button type="submit" size="sm">Enter verification</Button></form>}
      {canTransitionTrainingDevelopmentPlan(plan.status, "cancelled") && <form action={transitionTrainingDevelopmentPlan}><input type="hidden" name="planId" value={plan.id} /><input type="hidden" name="status" value="cancelled" /><Button type="submit" size="sm">Cancel plan</Button></form>}
    </div>
    {canTransitionTrainingDevelopmentPlan(plan.status, "completed") && <form action={transitionTrainingDevelopmentPlan} className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3"><input type="hidden" name="planId" value={plan.id} /><input type="hidden" name="status" value="completed" /><Field label="Effectiveness verification summary"><TextArea name="verificationSummary" required maxLength={4000} className="min-h-[70px]" /></Field><div className="mt-2 flex justify-end"><Button type="submit" size="sm"><CheckCircle2 className="h-4 w-4" /> Complete verified plan</Button></div></form>}
  </div>;
}

function ActionTransitionControls({ actionId, status }: { actionId: string; status: string }) {
  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2">
      {canTransitionTrainingDevelopmentAction(status, "in_progress") && <form action={transitionTrainingDevelopmentAction}><input type="hidden" name="actionId" value={actionId} /><input type="hidden" name="status" value="in_progress" /><Button type="submit" size="sm">Start</Button></form>}
    </div>
    {canTransitionTrainingDevelopmentAction(status, "completed") && <form action={transitionTrainingDevelopmentAction} className="grid gap-2 sm:grid-cols-[1fr_auto]"><input type="hidden" name="actionId" value={actionId} /><input type="hidden" name="status" value="completed" /><Input name="evidenceReference" required maxLength={500} placeholder="Evidence / assessment / document reference" /><Button type="submit" size="sm">Complete</Button></form>}
    {canTransitionTrainingDevelopmentAction(status, "waived") && <form action={transitionTrainingDevelopmentAction} className="grid gap-2 sm:grid-cols-[1fr_auto]"><input type="hidden" name="actionId" value={actionId} /><input type="hidden" name="status" value="waived" /><Input name="notes" required maxLength={4000} placeholder="Waiver reason" /><Button type="submit" size="sm">Waive</Button></form>}
  </div>;
}

function statusTone(status: string): "blue" | "emerald" | "amber" | "red" | "slate" | "violet" {
  if (status === "completed") return "emerald";
  if (status === "verification") return "violet";
  if (status === "in_progress") return "blue";
  if (status === "cancelled") return "slate";
  return "amber";
}

function priorityTone(priority: string): "red" | "amber" | "blue" | "slate" {
  if (priority === "critical") return "red";
  if (priority === "high") return "amber";
  if (priority === "medium") return "blue";
  return "slate";
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`block ${className}`}><span className="mb-1.5 block text-xs font-medium text-[var(--vims-ink-soft)]">{label}</span>{children}</label>;
}

const selectClass = "min-h-10 w-full rounded-lg border border-[var(--vims-line)] bg-[var(--vims-panel-solid)] px-3 py-2 text-sm text-[var(--vims-ink)] outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
