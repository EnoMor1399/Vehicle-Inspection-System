import Link from "next/link";
import { asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { AlertTriangle, BellRing, CalendarClock, CheckCircle2, ClipboardList, PhoneCall, ShieldAlert, UserRoundCheck } from "lucide-react";
import { db } from "@/db";
import {
  trainingCertificates,
  trainingComplianceCases,
  trainingComplianceEvents,
  trainingParticipants,
  trainingSessions,
} from "@/db/training-schema";
import { Badge, Button, Card, EmptyState, Field, PageHeader, Select, StatCard, TextArea, TextInput } from "@/components/ui";
import { DRIVER_TRAINING_SERVICES } from "@/lib/driver-training";
import { requireInternalUser } from "@/lib/require-auth";
import { canManageTrainingCompliance, canViewTraining } from "@/lib/training-access";
import { daysUntilTrainingDate, deriveTrainingCompliancePriority, effectiveTrainingCertificateStatus } from "@/lib/training-policy";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  openTrainingComplianceCase,
  prepareTrainingComplianceReminder,
  recordTrainingComplianceContact,
  updateTrainingComplianceStatus,
} from "./actions";

export const dynamic = "force-dynamic";

const serviceNames = new Map(DRIVER_TRAINING_SERVICES.map((service) => [service.id, service.title]));
const ACTIVE_CASES = ["open", "contacted", "scheduled"] as const;
const CHANNELS = ["email", "phone", "sms", "whatsapp", "in_person"] as const;

function priorityTone(priority: string) {
  if (priority === "critical") return "red" as const;
  if (priority === "high") return "orange" as const;
  if (priority === "medium") return "amber" as const;
  return "slate" as const;
}

export default async function TrainingCompliancePage() {
  const user = await requireInternalUser();
  if (!canViewTraining(user)) {
    return <div className="p-8 text-sm text-slate-600">You do not have access to Driver Training & Assessment Services.</div>;
  }
  const canManage = canManageTrainingCompliance(user);
  const now = new Date();

  const [cases, certificateRows, licenceRows, riskRows, recentEvents] = await Promise.all([
    db
      .select({
        id: trainingComplianceCases.id,
        participantId: trainingComplianceCases.participantId,
        certificateId: trainingComplianceCases.certificateId,
        caseType: trainingComplianceCases.caseType,
        status: trainingComplianceCases.status,
        priority: trainingComplianceCases.priority,
        dueDate: trainingComplianceCases.dueDate,
        preferredChannel: trainingComplianceCases.preferredChannel,
        contactCount: trainingComplianceCases.contactCount,
        lastContactedAt: trainingComplianceCases.lastContactedAt,
        nextFollowUpDate: trainingComplianceCases.nextFollowUpDate,
        notes: trainingComplianceCases.notes,
        participantName: trainingParticipants.fullName,
        email: trainingParticipants.email,
        phone: trainingParticipants.phone,
        serviceId: trainingSessions.serviceId,
        sessionReference: trainingSessions.referenceNumber,
        certificateNumber: trainingCertificates.certificateNumber,
      })
      .from(trainingComplianceCases)
      .innerJoin(trainingParticipants, eq(trainingParticipants.id, trainingComplianceCases.participantId))
      .innerJoin(trainingSessions, eq(trainingSessions.id, trainingParticipants.sessionId))
      .leftJoin(trainingCertificates, eq(trainingCertificates.id, trainingComplianceCases.certificateId))
      .where(inArray(trainingComplianceCases.status, [...ACTIVE_CASES]))
      .orderBy(asc(trainingComplianceCases.dueDate), desc(trainingComplianceCases.updatedAt))
      .limit(300),
    db
      .select({
        certificateId: trainingCertificates.id,
        certificateNumber: trainingCertificates.certificateNumber,
        certificateStatus: trainingCertificates.status,
        expiryDate: trainingCertificates.expiryDate,
        participantId: trainingParticipants.id,
        participantName: trainingParticipants.fullName,
        riskLevel: trainingParticipants.riskLevel,
        serviceId: trainingSessions.serviceId,
        sessionReference: trainingSessions.referenceNumber,
      })
      .from(trainingCertificates)
      .innerJoin(trainingParticipants, eq(trainingParticipants.id, trainingCertificates.participantId))
      .innerJoin(trainingSessions, eq(trainingSessions.id, trainingParticipants.sessionId))
      .where(isNotNull(trainingCertificates.expiryDate))
      .orderBy(asc(trainingCertificates.expiryDate))
      .limit(300),
    db
      .select({
        participantId: trainingParticipants.id,
        participantName: trainingParticipants.fullName,
        licenceExpiry: trainingParticipants.driverLicenseExpiry,
        riskLevel: trainingParticipants.riskLevel,
        serviceId: trainingSessions.serviceId,
        sessionReference: trainingSessions.referenceNumber,
      })
      .from(trainingParticipants)
      .innerJoin(trainingSessions, eq(trainingSessions.id, trainingParticipants.sessionId))
      .where(isNotNull(trainingParticipants.driverLicenseExpiry))
      .orderBy(asc(trainingParticipants.driverLicenseExpiry))
      .limit(300),
    db
      .select({
        participantId: trainingParticipants.id,
        participantName: trainingParticipants.fullName,
        riskLevel: trainingParticipants.riskLevel,
        assessmentStatus: trainingParticipants.assessmentStatus,
        serviceId: trainingSessions.serviceId,
        sessionReference: trainingSessions.referenceNumber,
      })
      .from(trainingParticipants)
      .innerJoin(trainingSessions, eq(trainingSessions.id, trainingParticipants.sessionId))
      .where(inArray(trainingParticipants.riskLevel, ["high", "critical"]))
      .orderBy(trainingParticipants.fullName)
      .limit(300),
    db
      .select({
        id: trainingComplianceEvents.id,
        caseId: trainingComplianceEvents.caseId,
        eventType: trainingComplianceEvents.eventType,
        channel: trainingComplianceEvents.channel,
        summary: trainingComplianceEvents.summary,
        createdAt: trainingComplianceEvents.createdAt,
      })
      .from(trainingComplianceEvents)
      .orderBy(desc(trainingComplianceEvents.createdAt))
      .limit(30),
  ]);

  const renewalCandidates = certificateRows.filter((row) => {
    const days = daysUntilTrainingDate(row.expiryDate, now);
    return row.certificateStatus !== "revoked" && days !== null && days <= 60;
  });
  const licenceCandidates = licenceRows.filter((row) => {
    const days = daysUntilTrainingDate(row.licenceExpiry, now);
    return days !== null && days <= 30;
  });
  const criticalCases = cases.filter((item) => item.priority === "critical" || item.priority === "high").length;
  const contactedCases = cases.filter((item) => item.status === "contacted").length;
  const scheduledCases = cases.filter((item) => item.status === "scheduled").length;

  return (
    <div className="mx-auto max-w-[1550px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Training Compliance & Renewals"
        description="Track certificate renewals, reassessments, licence expiries, high-risk operators, and auditable follow-up actions without automatically sending external messages."
        action={<Link href="/driver-training/analytics" className="text-sm font-semibold text-[var(--brand-accent)] hover:opacity-75">Training analytics →</Link>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Open cases" value={cases.length} hint="Unresolved compliance work" tone="blue" icon={<ClipboardList className="h-5 w-5" />} />
        <StatCard label="High / critical" value={criticalCases} hint="Priority intervention" tone="red" icon={<ShieldAlert className="h-5 w-5" />} />
        <StatCard label="Renewal watch" value={renewalCandidates.length} hint="Expired or due ≤60 days" tone="amber" icon={<CalendarClock className="h-5 w-5" />} />
        <StatCard label="Contacted" value={contactedCases} hint="Follow-up recorded" tone="violet" icon={<PhoneCall className="h-5 w-5" />} />
        <StatCard label="Scheduled" value={scheduledCases} hint="Action arranged" tone="emerald" icon={<UserRoundCheck className="h-5 w-5" />} />
      </div>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-[var(--vims-line)] px-5 py-4 sm:px-6">
            <h2 className="font-semibold text-[var(--vims-ink)]">Active compliance cases</h2>
            <p className="mt-1 text-sm text-[var(--vims-ink-muted)]">Reminder preparation creates an auditable draft only; it does not send email, SMS, WhatsApp, or calls.</p>
          </div>
          {cases.length === 0 ? (
            <div className="p-5 sm:p-6"><EmptyState icon={<CheckCircle2 className="h-5 w-5" />} title="No unresolved compliance cases" description="Open cases from the renewal, licence-expiry, or high-risk queues below when follow-up is required." /></div>
          ) : (
            <div className="divide-y divide-[var(--vims-line)]">
              {cases.map((item) => (
                <div key={item.id} className="p-5 sm:p-6">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/driver-training/participants/${item.participantId}`} className="font-semibold text-[var(--vims-ink)] hover:text-[var(--brand-accent)]">{item.participantName}</Link>
                        <Badge tone={priorityTone(item.priority)}>{item.priority}</Badge>
                        <Badge tone={item.status === "scheduled" ? "emerald" : item.status === "contacted" ? "violet" : "blue"}>{item.status}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-[var(--vims-ink-muted)]">{item.caseType.replaceAll("_", " ")} · {serviceNames.get(item.serviceId) || item.serviceId} · {item.sessionReference}</p>
                      <p className="mt-2 text-xs text-[var(--vims-ink-muted)]">Due {item.dueDate ? formatDate(item.dueDate) : "not set"} · Contacts {item.contactCount} · Last contact {item.lastContactedAt ? formatDateTime(item.lastContactedAt) : "none"}</p>
                      {item.certificateNumber && <p className="mt-1 font-mono text-xs text-[var(--vims-ink-muted)]">{item.certificateNumber}</p>}
                    </div>
                    <div className="text-xs text-[var(--vims-ink-muted)] lg:text-right">
                      <p>{item.email || "No email"}</p><p>{item.phone || "No phone"}</p>
                    </div>
                  </div>

                  {canManage && (
                    <div className="mt-4 grid gap-3 lg:grid-cols-3">
                      <form action={prepareTrainingComplianceReminder} className="rounded-xl border border-[var(--vims-line)] bg-[var(--vims-panel-soft)] p-3">
                        <input type="hidden" name="caseId" value={item.id} />
                        <Field label="Prepare reminder draft">
                          <Select name="channel" defaultValue={item.preferredChannel || "email"}>{CHANNELS.map((channel) => <option key={channel} value={channel}>{channel.replaceAll("_", " ")}</option>)}</Select>
                        </Field>
                        <Button type="submit" size="sm" variant="secondary" className="mt-2 w-full"><BellRing className="h-4 w-4" /> Prepare only</Button>
                      </form>

                      <form action={recordTrainingComplianceContact} className="rounded-xl border border-[var(--vims-line)] bg-[var(--vims-panel-soft)] p-3">
                        <input type="hidden" name="caseId" value={item.id} />
                        <div className="grid gap-2">
                          <Select name="channel" defaultValue={item.preferredChannel || "phone"}>{CHANNELS.map((channel) => <option key={channel} value={channel}>{channel.replaceAll("_", " ")}</option>)}</Select>
                          <TextInput name="nextFollowUpDate" type="date" defaultValue={item.nextFollowUpDate || ""} aria-label="Next follow-up date" />
                          <TextArea name="summary" required maxLength={4000} placeholder="Record what was communicated or agreed…" className="min-h-[72px]" />
                          <Button type="submit" size="sm">Record contact</Button>
                        </div>
                      </form>

                      <form action={updateTrainingComplianceStatus} className="rounded-xl border border-[var(--vims-line)] bg-[var(--vims-panel-soft)] p-3">
                        <input type="hidden" name="caseId" value={item.id} />
                        <div className="grid gap-2">
                          <Select name="status" defaultValue={item.status}>
                            <option value="open">Open</option><option value="contacted">Contacted</option><option value="scheduled">Scheduled</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option>
                          </Select>
                          <TextInput name="notes" maxLength={2000} placeholder="Optional case note" />
                          <Button type="submit" size="sm" variant="secondary">Update status</Button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-[var(--vims-line)] px-5 py-4"><h2 className="font-semibold text-[var(--vims-ink)]">Recent compliance activity</h2></div>
          {recentEvents.length === 0 ? <div className="p-5 text-sm text-[var(--vims-ink-muted)]">No compliance events recorded yet.</div> : (
            <div className="divide-y divide-[var(--vims-line)]">{recentEvents.map((event) => <div key={event.id} className="p-4"><div className="flex items-center justify-between gap-2"><Badge tone="slate">{event.eventType.replaceAll("_", " ")}</Badge><span className="text-xs text-[var(--vims-ink-muted)]">{formatDateTime(event.createdAt)}</span></div><p className="mt-2 text-sm leading-5 text-[var(--vims-ink-soft)]">{event.summary}</p>{event.channel && <p className="mt-1 text-xs text-[var(--vims-ink-muted)]">Channel: {event.channel.replaceAll("_", " ")}</p>}</div>)}</div>
          )}
        </Card>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-3">
        <CandidateQueue title="Certificate renewal queue" description="Expired certificates and certificates expiring within 60 days." icon={<CalendarClock className="h-5 w-5" />}>
          {renewalCandidates.slice(0, 30).map((row) => {
            const days = daysUntilTrainingDate(row.expiryDate, now);
            const effective = effectiveTrainingCertificateStatus(row.certificateStatus, row.expiryDate, now);
            const priority = deriveTrainingCompliancePriority("renewal", row.expiryDate, row.riskLevel, now);
            return <Candidate key={row.certificateId} name={row.participantName} detail={`${row.certificateNumber} · ${row.expiryDate ? formatDate(row.expiryDate) : "—"} · ${days ?? "—"} days`} tone={effective === "expired" ? "red" : priorityTone(priority)} badge={effective === "expired" ? "expired" : priority} href={`/driver-training/participants/${row.participantId}`}>{canManage && <OpenCaseForm participantId={row.participantId} certificateId={row.certificateId} caseType="renewal" priority={priority} dueDate={row.expiryDate || ""} />}</Candidate>;
          })}
          {renewalCandidates.length === 0 && <QueueEmpty text="No certificate renewals are due within 60 days." />}
        </CandidateQueue>

        <CandidateQueue title="Driving-licence watch" description="Participant licences expired or expiring within 30 days." icon={<AlertTriangle className="h-5 w-5" />}>
          {licenceCandidates.slice(0, 30).map((row) => {
            const priority = deriveTrainingCompliancePriority("licence_expiry", row.licenceExpiry, row.riskLevel, now);
            return <Candidate key={row.participantId} name={row.participantName} detail={`${row.licenceExpiry ? formatDate(row.licenceExpiry) : "—"} · ${row.sessionReference}`} tone={priorityTone(priority)} badge={priority} href={`/driver-training/participants/${row.participantId}`}>{canManage && <OpenCaseForm participantId={row.participantId} caseType="licence_expiry" priority={priority} dueDate={row.licenceExpiry || ""} />}</Candidate>;
          })}
          {licenceCandidates.length === 0 && <QueueEmpty text="No driving licences are due within 30 days." />}
        </CandidateQueue>

        <CandidateQueue title="High-risk operator queue" description="Participants currently classified high or critical risk." icon={<ShieldAlert className="h-5 w-5" />}>
          {riskRows.slice(0, 30).map((row) => {
            const priority = deriveTrainingCompliancePriority("high_risk", null, row.riskLevel, now);
            return <Candidate key={row.participantId} name={row.participantName} detail={`${row.riskLevel || "risk"} · ${row.assessmentStatus} · ${row.sessionReference}`} tone={priorityTone(priority)} badge={row.riskLevel || priority} href={`/driver-training/participants/${row.participantId}`}>{canManage && <OpenCaseForm participantId={row.participantId} caseType="high_risk" priority={priority} />}</Candidate>;
          })}
          {riskRows.length === 0 && <QueueEmpty text="No high-risk operators are currently recorded." />}
        </CandidateQueue>
      </section>
    </div>
  );
}

function CandidateQueue({ title, description, icon, children }: { title: string; description: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <Card className="overflow-hidden"><div className="border-b border-[var(--vims-line)] px-5 py-4"><div className="flex items-center gap-2 text-[var(--vims-ink)]">{icon}<h2 className="font-semibold">{title}</h2></div><p className="mt-1 text-sm text-[var(--vims-ink-muted)]">{description}</p></div><div className="max-h-[620px] divide-y divide-[var(--vims-line)] overflow-y-auto">{children}</div></Card>;
}

function Candidate({ name, detail, badge, tone, href, children }: { name: string; detail: string; badge: string; tone: "slate" | "emerald" | "amber" | "red" | "blue" | "violet" | "orange"; href: string; children?: React.ReactNode }) {
  return <div className="p-4"><div className="flex items-start justify-between gap-3"><div><Link href={href} className="text-sm font-semibold text-[var(--vims-ink)] hover:text-[var(--brand-accent)]">{name}</Link><p className="mt-1 text-xs leading-5 text-[var(--vims-ink-muted)]">{detail}</p></div><Badge tone={tone}>{badge}</Badge></div>{children}</div>;
}

function OpenCaseForm({ participantId, certificateId, caseType, priority, dueDate = "" }: { participantId: string; certificateId?: string; caseType: "renewal" | "licence_expiry" | "high_risk" | "reassessment"; priority: string; dueDate?: string }) {
  return <form action={openTrainingComplianceCase} className="mt-3 flex flex-wrap items-center gap-2"><input type="hidden" name="participantId" value={participantId} /><input type="hidden" name="certificateId" value={certificateId || ""} /><input type="hidden" name="caseType" value={caseType} /><input type="hidden" name="priority" value={priority} /><input type="hidden" name="dueDate" value={dueDate} /><input type="hidden" name="preferredChannel" value="email" /><Button type="submit" size="sm" variant="secondary">Track case</Button></form>;
}

function QueueEmpty({ text }: { text: string }) {
  return <div className="p-5 text-sm text-[var(--vims-ink-muted)]">{text}</div>;
}
