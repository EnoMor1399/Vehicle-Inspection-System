import type { ReactNode } from "react";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { BookOpenCheck, CalendarClock, Layers3, Link2, ListChecks, ShieldCheck } from "lucide-react";
import { db } from "@/db";
import { users } from "@/db/schema";
import { trainingSessions } from "@/db/training-schema";
import {
  trainingCurricula,
  trainingCurriculumVersions,
  trainingMatrixRequirements,
  trainingSessionCurricula,
} from "@/db/training-curriculum-schema";
import { Badge, Button, Card, EmptyState, PageHeader, StatCard, TextArea, TextInput as Input } from "@/components/ui";
import { DRIVER_TRAINING_SERVICES } from "@/lib/driver-training";
import { requireInternalUser } from "@/lib/require-auth";
import { canManageTraining, canViewTraining } from "@/lib/training-access";
import { curriculumReviewState } from "@/lib/training-curriculum-policy";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  approveTrainingCurriculumVersion,
  assignTrainingSessionCurriculum,
  createTrainingCurriculum,
  createTrainingCurriculumVersion,
  saveTrainingMatrixRequirement,
} from "./actions";

export const dynamic = "force-dynamic";

const serviceNames = new Map(DRIVER_TRAINING_SERVICES.map((service) => [service.id, service.title]));

export default async function TrainingCurriculumPage() {
  const user = await requireInternalUser();
  if (!canViewTraining(user)) {
    return <div className="p-8 text-sm text-slate-600">You do not have access to Driver Training & Assessment Services.</div>;
  }
  const canManage = canManageTraining(user);

  const [curricula, versions, sessions, bindings, matrix, internalUsers] = await Promise.all([
    db.select().from(trainingCurricula).orderBy(asc(trainingCurricula.code)).limit(200),
    db
      .select({ version: trainingCurriculumVersions, curriculum: trainingCurricula })
      .from(trainingCurriculumVersions)
      .innerJoin(trainingCurricula, eq(trainingCurricula.id, trainingCurriculumVersions.curriculumId))
      .orderBy(desc(trainingCurriculumVersions.createdAt))
      .limit(400),
    db.select().from(trainingSessions).orderBy(desc(trainingSessions.startAt)).limit(250),
    db.select().from(trainingSessionCurricula).limit(500),
    db.select().from(trainingMatrixRequirements).orderBy(asc(trainingMatrixRequirements.scopeType), asc(trainingMatrixRequirements.serviceId)).limit(300),
    db
      .select({ id: users.id, name: users.name, role: users.role })
      .from(users)
      .where(and(eq(users.isActive, true), ne(users.role, "transporter_user")))
      .orderBy(asc(users.name))
      .limit(300),
  ]);

  const approvedVersions = versions.filter(({ version }) => version.status === "approved");
  const draftVersions = versions.filter(({ version }) => version.status === "draft");
  const overdueReviews = approvedVersions.filter(({ version }) => curriculumReviewState(version.reviewDueDate) === "overdue").length;
  const dueSoonReviews = approvedVersions.filter(({ version }) => curriculumReviewState(version.reviewDueDate) === "due_soon").length;
  const bindingBySession = new Map(bindings.map((binding) => [binding.sessionId, binding]));
  const versionById = new Map(versions.map((item) => [item.version.id, item]));
  const eligibleSessions = sessions.filter((session) => session.status === "scheduled");

  return (
    <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Curriculum & Training Matrix"
        description="Govern approved syllabus versions, learning objectives, competency standards, session curriculum assignment, and recurring client/role training requirements."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Curricula" value={curricula.length} hint="Controlled programme masters" tone="blue" icon={<BookOpenCheck className="h-5 w-5" />} />
        <StatCard label="Approved versions" value={approvedVersions.length} hint="One approved version per curriculum" tone="emerald" icon={<ShieldCheck className="h-5 w-5" />} />
        <StatCard label="Draft versions" value={draftVersions.length} hint="Awaiting controlled approval" tone="slate" icon={<Layers3 className="h-5 w-5" />} />
        <StatCard label="Review attention" value={overdueReviews + dueSoonReviews} hint={`${overdueReviews} overdue · ${dueSoonReviews} due within 30 days`} tone={overdueReviews > 0 ? "red" : "amber"} icon={<CalendarClock className="h-5 w-5" />} />
        <StatCard label="Matrix requirements" value={matrix.length} hint="Global, client, and role requirements" tone="violet" icon={<ListChecks className="h-5 w-5" />} />
      </div>

      {canManage && (
        <section className="mt-6 grid gap-6 xl:grid-cols-2">
          <Card className="p-5 sm:p-6">
            <h2 className="font-semibold text-[var(--vims-ink)]">Create curriculum master</h2>
            <p className="mt-1 text-sm text-[var(--vims-ink-muted)]">Create the controlled programme identity before adding syllabus versions.</p>
            <form action={createTrainingCurriculum} className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Curriculum code"><Input name="code" maxLength={40} required placeholder="DDT-001" /></Field>
              <Field label="Training service">
                <select name="serviceId" required className={selectClass}><option value="">Select service</option>{DRIVER_TRAINING_SERVICES.map((service) => <option key={service.id} value={service.id}>{service.title}</option>)}</select>
              </Field>
              <Field label="Curriculum title" className="sm:col-span-2"><Input name="title" maxLength={220} required placeholder="Defensive Driving Core Programme" /></Field>
              <Field label="Curriculum owner">
                <select name="ownerId" className={selectClass}><option value="">Unassigned</option>{internalUsers.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.role.replaceAll("_", " ")}</option>)}</select>
              </Field>
              <Field label="Status">
                <select name="status" defaultValue="active" className={selectClass}><option value="active">Active</option><option value="inactive">Inactive</option></select>
              </Field>
              <Field label="Governance notes" className="sm:col-span-2"><TextArea name="notes" maxLength={4000} className="min-h-[90px]" /></Field>
              <div className="sm:col-span-2 flex justify-end"><Button type="submit"><BookOpenCheck className="h-4 w-4" /> Create curriculum</Button></div>
            </form>
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="font-semibold text-[var(--vims-ink)]">Add curriculum version</h2>
            <p className="mt-1 text-sm text-[var(--vims-ink-muted)]">Drafts require modules, objectives, competencies, delivery hours, pass standards, and review dates before approval.</p>
            {curricula.filter((item) => item.status === "active").length === 0 ? (
              <div className="mt-5"><EmptyState title="No active curriculum" description="Create an active curriculum master first." /></div>
            ) : (
              <form action={createTrainingCurriculumVersion} className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Curriculum" className="sm:col-span-2">
                  <select name="curriculumId" required className={selectClass}><option value="">Select curriculum</option>{curricula.filter((item) => item.status === "active").map((item) => <option key={item.id} value={item.id}>{item.code} · {item.title}</option>)}</select>
                </Field>
                <Field label="Version"><Input name="versionNumber" required placeholder="1.0" /></Field>
                <Field label="Total hours"><Input name="totalHours" type="number" min="0.5" max="500" step="0.5" required /></Field>
                <Field label="Effective from"><Input name="effectiveFrom" type="date" required /></Field>
                <Field label="Review due"><Input name="reviewDueDate" type="date" required /></Field>
                <Field label="Theory pass mark %"><Input name="theoryPassMark" type="number" min="0" max="100" required defaultValue="70" /></Field>
                <Field label="Practical pass mark %"><Input name="practicalPassMark" type="number" min="0" max="100" required defaultValue="70" /></Field>
                <Field label="Minimum attendance minutes" className="sm:col-span-2"><Input name="minimumAttendanceMinutes" type="number" min="0" max="30000" defaultValue="0" /></Field>
                <Field label="Modules — one per line" className="sm:col-span-2"><TextArea name="modules" required maxLength={8000} className="min-h-[110px]" placeholder="Hazard perception\nSafe following distance\nEmergency braking" /></Field>
                <Field label="Learning objectives — one per line" className="sm:col-span-2"><TextArea name="learningObjectives" required maxLength={8000} className="min-h-[110px]" /></Field>
                <Field label="Competencies — one per line" className="sm:col-span-2"><TextArea name="competencies" required maxLength={8000} className="min-h-[110px]" /></Field>
                <Field label="Change summary" className="sm:col-span-2"><TextArea name="changeSummary" maxLength={4000} className="min-h-[80px]" /></Field>
                <div className="sm:col-span-2 flex justify-end"><Button type="submit"><Layers3 className="h-4 w-4" /> Save draft version</Button></div>
              </form>
            )}
          </Card>
        </section>
      )}

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-[var(--vims-line)] px-5 py-4 sm:px-6"><h2 className="font-semibold text-[var(--vims-ink)]">Controlled curriculum versions</h2><p className="mt-1 text-sm text-[var(--vims-ink-muted)]">Approving a new version automatically supersedes the prior approved version for the same curriculum.</p></div>
          {versions.length === 0 ? <div className="p-5"><EmptyState title="No curriculum versions" /></div> : (
            <div className="divide-y divide-[var(--vims-line)]">
              {versions.map(({ version, curriculum }) => {
                const reviewState = curriculumReviewState(version.reviewDueDate);
                return (
                  <div key={version.id} className="p-5 sm:p-6">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-[var(--vims-ink)]">{curriculum.code} · v{version.versionNumber}</p><Badge tone={version.status === "approved" ? "emerald" : version.status === "draft" ? "amber" : "slate"}>{version.status}</Badge><Badge tone={reviewState === "overdue" ? "red" : reviewState === "due_soon" ? "amber" : "slate"}>{reviewState.replaceAll("_", " ")}</Badge></div>
                        <p className="mt-1 text-sm text-[var(--vims-ink-soft)]">{curriculum.title}</p>
                        <p className="mt-1 text-xs text-[var(--vims-ink-muted)]">{serviceNames.get(curriculum.serviceId) || curriculum.serviceId} · Effective {formatDate(version.effectiveFrom)} · Review {formatDate(version.reviewDueDate)}</p>
                      </div>
                      {canManage && version.status === "draft" && <form action={approveTrainingCurriculumVersion}><input type="hidden" name="versionId" value={version.id} /><Button type="submit" size="sm"><ShieldCheck className="h-4 w-4" /> Approve</Button></form>}
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-4 text-xs text-[var(--vims-ink-muted)]"><span>Hours: <strong className="text-[var(--vims-ink)]">{version.totalHours}</strong></span><span>Theory pass: <strong className="text-[var(--vims-ink)]">{version.theoryPassMark}%</strong></span><span>Practical pass: <strong className="text-[var(--vims-ink)]">{version.practicalPassMark}%</strong></span><span>Min attendance: <strong className="text-[var(--vims-ink)]">{version.minimumAttendanceMinutes} min</strong></span></div>
                    <div className="mt-4 grid gap-4 lg:grid-cols-3"><ListBlock title="Modules" items={version.modules} /><ListBlock title="Learning objectives" items={version.learningObjectives} /><ListBlock title="Competencies" items={version.competencies} /></div>
                    {version.approvedAt && <p className="mt-3 text-xs text-[var(--vims-ink-muted)]">Approved {formatDateTime(version.approvedAt)}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="p-5 sm:p-6">
            <h2 className="font-semibold text-[var(--vims-ink)]">Session curriculum assignment</h2>
            <p className="mt-1 text-sm text-[var(--vims-ink-muted)]">Only scheduled sessions can be assigned or changed, and the approved curriculum must match the session service.</p>
            {canManage && eligibleSessions.length > 0 && approvedVersions.length > 0 && (
              <form action={assignTrainingSessionCurriculum} className="mt-4 space-y-4">
                <Field label="Scheduled session"><select name="sessionId" required className={selectClass}><option value="">Select session</option>{eligibleSessions.map((session) => <option key={session.id} value={session.id}>{session.referenceNumber} · {serviceNames.get(session.serviceId) || session.title}</option>)}</select></Field>
                <Field label="Approved curriculum version"><select name="versionId" required className={selectClass}><option value="">Select approved version</option>{approvedVersions.map(({ version, curriculum }) => <option key={version.id} value={version.id}>{curriculum.code} v{version.versionNumber} · {serviceNames.get(curriculum.serviceId) || curriculum.serviceId}</option>)}</select></Field>
                <div className="flex justify-end"><Button type="submit"><Link2 className="h-4 w-4" /> Assign curriculum</Button></div>
              </form>
            )}
            <div className="mt-5 space-y-2">
              {sessions.filter((session) => bindingBySession.has(session.id)).slice(0, 12).map((session) => {
                const binding = bindingBySession.get(session.id)!;
                const item = versionById.get(binding.curriculumVersionId);
                return <div key={session.id} className="rounded-xl border border-[var(--vims-line)] bg-[var(--vims-panel-soft)] p-3"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-[var(--vims-ink)]">{session.referenceNumber}</p><Badge tone={session.status === "scheduled" ? "blue" : "slate"}>{session.status.replaceAll("_", " ")}</Badge></div><p className="mt-1 text-xs text-[var(--vims-ink-muted)]">{item ? `${item.curriculum.code} v${item.version.versionNumber}` : "Curriculum version unavailable"}</p></div>;
              })}
              {bindings.length === 0 && <EmptyState title="No session curriculum assignments" />}
            </div>
          </Card>

          {canManage && <Card className="p-5 sm:p-6">
            <h2 className="font-semibold text-[var(--vims-ink)]">Training matrix requirement</h2>
            <p className="mt-1 text-sm text-[var(--vims-ink-muted)]">Define recurring training requirements globally, by client, or by job role.</p>
            <form action={saveTrainingMatrixRequirement} className="mt-4 space-y-4">
              <Field label="Scope"><select name="scopeType" defaultValue="global" className={selectClass}><option value="global">Global</option><option value="client">Client</option><option value="role">Job role</option></select></Field>
              <Field label="Client name"><Input name="clientName" maxLength={220} placeholder="Required for client scope" /></Field>
              <Field label="Job role"><Input name="jobRole" maxLength={160} placeholder="Required for role scope" /></Field>
              <Field label="Training service"><select name="serviceId" required className={selectClass}><option value="">Select service</option>{DRIVER_TRAINING_SERVICES.map((service) => <option key={service.id} value={service.id}>{service.title}</option>)}</select></Field>
              <div className="grid gap-4 sm:grid-cols-2"><Field label="Recurrence months"><Input name="recurrenceMonths" type="number" min="0" max="120" defaultValue="12" /></Field><Field label="Minimum licence class"><Input name="minimumLicenseClass" maxLength={50} /></Field></div>
              <label className="flex items-center gap-2 text-sm font-medium text-[var(--vims-ink-soft)]"><input type="checkbox" name="required" defaultChecked className="h-4 w-4 rounded border-slate-300" /> Mandatory requirement</label>
              <Field label="Notes"><TextArea name="notes" maxLength={4000} className="min-h-[80px]" /></Field>
              <div className="flex justify-end"><Button type="submit"><ListChecks className="h-4 w-4" /> Save requirement</Button></div>
            </form>
          </Card>}
        </div>
      </section>

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-[var(--vims-line)] px-5 py-4 sm:px-6"><h2 className="font-semibold text-[var(--vims-ink)]">Training matrix</h2><p className="mt-1 text-sm text-[var(--vims-ink-muted)]">Current recurring training requirements used for workforce/client planning.</p></div>
        {matrix.length === 0 ? <div className="p-5"><EmptyState title="No training matrix requirements" /></div> : <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">{matrix.map((item) => <div key={item.id} className="rounded-2xl border border-[var(--vims-line)] p-4"><div className="flex items-center justify-between gap-3"><Badge tone={item.required ? "emerald" : "slate"}>{item.required ? "mandatory" : "optional"}</Badge><span className="text-xs font-semibold uppercase text-[var(--vims-ink-muted)]">{item.scopeType}</span></div><p className="mt-3 font-semibold text-[var(--vims-ink)]">{serviceNames.get(item.serviceId) || item.serviceId}</p><p className="mt-1 text-sm text-[var(--vims-ink-soft)]">{item.scopeType === "client" ? item.clientName : item.scopeType === "role" ? item.jobRole : "All applicable personnel"}</p><p className="mt-3 text-xs text-[var(--vims-ink-muted)]">Recurrence: {item.recurrenceMonths === 0 ? "One-time" : `Every ${item.recurrenceMonths} month${item.recurrenceMonths === 1 ? "" : "s"}`} · Licence class: {item.minimumLicenseClass || "Not specified"}</p>{item.notes && <p className="mt-2 text-xs leading-5 text-[var(--vims-ink-muted)]">{item.notes}</p>}</div>)}</div>}
      </Card>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`block ${className}`}><span className="mb-1.5 block text-sm font-semibold text-[var(--vims-ink-soft)]">{label}</span>{children}</label>;
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return <div className="rounded-xl border border-[var(--vims-line)] bg-[var(--vims-panel-soft)] p-3"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--vims-ink-muted)]">{title}</p><ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-[var(--vims-ink-soft)]">{items.slice(0, 8).map((item) => <li key={item}>{item}</li>)}</ul>{items.length > 8 && <p className="mt-2 text-xs text-[var(--vims-ink-muted)]">+{items.length - 8} more</p>}</div>;
}

const selectClass = "min-h-10 w-full rounded-xl border border-[var(--vims-line)] bg-[var(--vims-panel-solid)] px-3 text-sm text-[var(--vims-ink)] outline-none focus:border-[var(--brand-accent)]";
