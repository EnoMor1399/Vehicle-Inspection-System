import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { Award, ClipboardCheck, FileWarning, GraduationCap, ShieldAlert, UserRound } from "lucide-react";
import { db } from "@/db";
import {
  trainingAssessments,
  trainingCertificates,
  trainingComplianceCases,
  trainingComplianceEvents,
  trainingParticipants,
  trainingSessions,
} from "@/db/training-schema";
import { Badge, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { DRIVER_TRAINING_SERVICES } from "@/lib/driver-training";
import { requireInternalUser } from "@/lib/require-auth";
import { canViewTraining } from "@/lib/training-access";
import { effectiveTrainingCertificateStatus } from "@/lib/training-policy";
import { formatDate, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const serviceNames = new Map(DRIVER_TRAINING_SERVICES.map((service) => [service.id, service.title]));

export default async function TrainingParticipantDossierPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireInternalUser();
  if (!canViewTraining(user)) return <div className="p-8 text-sm text-slate-600">You do not have access to Driver Training & Assessment Services.</div>;
  const { id } = await params;

  const [participant] = await db
    .select({ participant: trainingParticipants, session: trainingSessions })
    .from(trainingParticipants)
    .innerJoin(trainingSessions, eq(trainingSessions.id, trainingParticipants.sessionId))
    .where(eq(trainingParticipants.id, id))
    .limit(1);
  if (!participant) notFound();

  const [assessments, certificates, cases] = await Promise.all([
    db.select().from(trainingAssessments).where(eq(trainingAssessments.participantId, id)).orderBy(desc(trainingAssessments.assessedAt)),
    db.select().from(trainingCertificates).where(eq(trainingCertificates.participantId, id)).orderBy(desc(trainingCertificates.issuedAt)),
    db.select().from(trainingComplianceCases).where(eq(trainingComplianceCases.participantId, id)).orderBy(desc(trainingComplianceCases.updatedAt)),
  ]);
  const caseIds = cases.map((item) => item.id);
  const events = caseIds.length > 0
    ? await db
        .select()
        .from(trainingComplianceEvents)
        .where(eq(trainingComplianceEvents.caseId, caseIds[0]))
        .orderBy(desc(trainingComplianceEvents.createdAt))
        .limit(20)
    : [];

  const p = participant.participant;
  const session = participant.session;
  const activeCertificates = certificates.filter((certificate) => effectiveTrainingCertificateStatus(certificate.status, certificate.expiryDate) === "active").length;
  const openCases = cases.filter((item) => ["open", "contacted", "scheduled"].includes(item.status)).length;
  const passingAssessments = assessments.filter((item) => item.result === "pass" || item.result === "competent").length;

  return (
    <div className="mx-auto max-w-[1450px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={p.fullName}
        description={`Driver Training competency and compliance dossier · ${session.referenceNumber}`}
        action={<div className="flex flex-wrap gap-2"><Link href="/driver-training/participants" className="text-sm font-semibold text-[var(--brand-accent)] hover:opacity-75">← Participants</Link><Link href="/driver-training/compliance" className="text-sm font-semibold text-[var(--brand-accent)] hover:opacity-75">Compliance queue →</Link></div>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Assessments" value={assessments.length} hint={`${passingAssessments} passing / competent`} tone="blue" icon={<ClipboardCheck className="h-5 w-5" />} />
        <StatCard label="Certificates" value={certificates.length} hint={`${activeCertificates} currently active`} tone="emerald" icon={<Award className="h-5 w-5" />} />
        <StatCard label="Risk level" value={p.riskLevel || "Not set"} hint="Latest participant classification" tone={p.riskLevel === "critical" || p.riskLevel === "high" ? "red" : "slate"} icon={<ShieldAlert className="h-5 w-5" />} />
        <StatCard label="Compliance cases" value={cases.length} hint={`${openCases} unresolved`} tone={openCases > 0 ? "amber" : "slate"} icon={<FileWarning className="h-5 w-5" />} />
      </div>

      <section className="mt-6 grid gap-6 lg:grid-cols-[.7fr_1.3fr]">
        <div className="space-y-6">
          <Card className="p-5 sm:p-6">
            <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><UserRound className="h-5 w-5" /></div><div><h2 className="font-semibold text-[var(--vims-ink)]">Participant profile</h2><p className="text-sm text-[var(--vims-ink-muted)]">Internal operational identity and contact details.</p></div></div>
            <dl className="mt-5 space-y-3 text-sm">
              <Row label="Company" value={p.companyName} /><Row label="Employee no." value={p.employeeNumber} /><Row label="Email" value={p.email} /><Row label="Phone" value={p.phone} /><Row label="Driver licence" value={p.driverLicenseNumber} /><Row label="Licence class" value={p.driverLicenseClass} /><Row label="Licence expiry" value={p.driverLicenseExpiry ? formatDate(p.driverLicenseExpiry) : null} /><Row label="Attendance" value={p.attendanceStatus.replaceAll("_", " ")} /><Row label="Assessment" value={p.assessmentStatus.replaceAll("_", " ")} />
            </dl>
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-700"><GraduationCap className="h-5 w-5" /></div><div><h2 className="font-semibold text-[var(--vims-ink)]">Training session</h2><p className="text-sm text-[var(--vims-ink-muted)]">Qualification context for this participant record.</p></div></div>
            <dl className="mt-5 space-y-3 text-sm"><Row label="Reference" value={session.referenceNumber} /><Row label="Service" value={serviceNames.get(session.serviceId) || session.serviceId} /><Row label="Programme" value={session.title} /><Row label="Client" value={session.clientName} /><Row label="Status" value={session.status.replaceAll("_", " ")} /><Row label="Start" value={formatDateTime(session.startAt)} /><Row label="End" value={formatDateTime(session.endAt)} /></dl>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="border-b border-[var(--vims-line)] px-5 py-4"><h2 className="font-semibold text-[var(--vims-ink)]">Assessment history</h2></div>
            {assessments.length === 0 ? <div className="p-5"><EmptyState title="No assessments recorded" /></div> : <div className="divide-y divide-[var(--vims-line)]">{assessments.map((item) => <div key={item.id} className="p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold text-[var(--vims-ink)]">{item.assessmentType.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-[var(--vims-ink-muted)]">{formatDateTime(item.assessedAt)}</p></div><div className="flex gap-2"><Badge tone={item.result === "pass" || item.result === "competent" ? "emerald" : "red"}>{item.result.replaceAll("_", " ")}</Badge>{item.riskLevel && <Badge tone={item.riskLevel === "critical" || item.riskLevel === "high" ? "red" : "slate"}>{item.riskLevel}</Badge>}</div></div><div className="mt-3 grid grid-cols-3 gap-3 text-xs text-[var(--vims-ink-muted)]"><span>Theory: {item.theoryScore ?? "—"}</span><span>Practical: {item.practicalScore ?? "—"}</span><span>Overall: {item.overallScore ?? "—"}</span></div>{item.remarks && <p className="mt-3 text-sm leading-6 text-[var(--vims-ink-soft)]">{item.remarks}</p>}</div>)}</div>}
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-[var(--vims-line)] px-5 py-4"><h2 className="font-semibold text-[var(--vims-ink)]">Certificate history</h2></div>
            {certificates.length === 0 ? <div className="p-5"><EmptyState title="No certificates issued" /></div> : <div className="divide-y divide-[var(--vims-line)]">{certificates.map((item) => { const status = effectiveTrainingCertificateStatus(item.status, item.expiryDate); return <div key={item.id} className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-mono text-sm font-semibold text-[var(--vims-ink)]">{item.certificateNumber}</p><p className="mt-1 text-xs text-[var(--vims-ink-muted)]">Issued {formatDate(item.issueDate)} · Expires {item.expiryDate ? formatDate(item.expiryDate) : "never"}</p></div><div className="flex items-center gap-2"><Badge tone={status === "active" ? "emerald" : status === "revoked" ? "red" : "amber"}>{status}</Badge><Link href={`/verify/training/${item.verificationCode}`} className="text-xs font-semibold text-[var(--brand-accent)] hover:opacity-75">Verify</Link></div></div>; })}</div>}
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-[var(--vims-line)] px-5 py-4"><h2 className="font-semibold text-[var(--vims-ink)]">Compliance case history</h2></div>
            {cases.length === 0 ? <div className="p-5"><EmptyState title="No compliance cases" description="No renewal, reassessment, licence-expiry, or high-risk follow-up cases have been recorded for this participant." /></div> : <div className="divide-y divide-[var(--vims-line)]">{cases.map((item) => <div key={item.id} className="p-5"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-[var(--vims-ink)]">{item.caseType.replaceAll("_", " ")}</p><div className="flex gap-2"><Badge tone={item.priority === "critical" || item.priority === "high" ? "red" : "slate"}>{item.priority}</Badge><Badge tone={item.status === "resolved" ? "emerald" : item.status === "dismissed" ? "slate" : "amber"}>{item.status}</Badge></div></div><p className="mt-2 text-xs text-[var(--vims-ink-muted)]">Due {item.dueDate ? formatDate(item.dueDate) : "not set"} · Contacts {item.contactCount} · Updated {formatDateTime(item.updatedAt)}</p>{item.notes && <p className="mt-2 text-sm text-[var(--vims-ink-soft)]">{item.notes}</p>}</div>)}</div>}
          </Card>

          {events.length > 0 && <Card className="overflow-hidden"><div className="border-b border-[var(--vims-line)] px-5 py-4"><h2 className="font-semibold text-[var(--vims-ink)]">Latest compliance activity</h2><p className="mt-1 text-xs text-[var(--vims-ink-muted)]">Latest case activity for the most recent compliance case.</p></div><div className="divide-y divide-[var(--vims-line)]">{events.map((event) => <div key={event.id} className="p-4"><div className="flex justify-between gap-3"><Badge tone="slate">{event.eventType.replaceAll("_", " ")}</Badge><span className="text-xs text-[var(--vims-ink-muted)]">{formatDateTime(event.createdAt)}</span></div><p className="mt-2 text-sm text-[var(--vims-ink-soft)]">{event.summary}</p></div>)}</div></Card>}
        </div>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return <div className="flex items-start justify-between gap-4 border-b border-[var(--vims-line)] pb-2 last:border-0 last:pb-0"><dt className="text-[var(--vims-ink-muted)]">{label}</dt><dd className="max-w-[60%] text-right font-medium capitalize text-[var(--vims-ink)]">{value || "—"}</dd></div>;
}
