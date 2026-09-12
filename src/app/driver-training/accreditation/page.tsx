import type { ReactNode } from "react";
import { asc, desc } from "drizzle-orm";
import { AlertTriangle, BadgeCheck, CalendarClock, FileCheck2, Landmark, ShieldCheck } from "lucide-react";
import { db } from "@/db";
import {
  trainingAccreditationRecords,
  trainingRegulatoryRequirements,
  trainingSessionComplianceReviews,
} from "@/db/training-accreditation-schema";
import { trainingSessions } from "@/db/training-schema";
import { Badge, Button, Card, EmptyState, PageHeader, StatCard, TextArea, TextInput as Input } from "@/components/ui";
import { DRIVER_TRAINING_SERVICES } from "@/lib/driver-training";
import { requireInternalUser } from "@/lib/require-auth";
import { canManageTrainingGovernance, canViewTraining } from "@/lib/training-access";
import { accreditationValidityState, evaluateTrainingRegulatoryCompliance } from "@/lib/training-accreditation-policy";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  createTrainingAccreditationRecord,
  createTrainingRegulatoryRequirement,
  decideTrainingAccreditationRecord,
  reviewTrainingSessionRegulatoryCompliance,
  setTrainingRegulatoryRequirementStatus,
} from "./actions";

export const dynamic = "force-dynamic";

const serviceNames = new Map(DRIVER_TRAINING_SERVICES.map((service) => [service.id, service.title]));

export default async function TrainingAccreditationPage() {
  const user = await requireInternalUser();
  if (!canViewTraining(user)) return <div className="p-8 text-sm text-slate-600">You do not have access to Driver Training & Assessment Services.</div>;
  const canManage = canManageTrainingGovernance(user);

  const [requirements, accreditations, sessions, reviews] = await Promise.all([
    db.select().from(trainingRegulatoryRequirements).orderBy(asc(trainingRegulatoryRequirements.requirementCode)).limit(500),
    db.select().from(trainingAccreditationRecords).orderBy(desc(trainingAccreditationRecords.createdAt)).limit(1500),
    db.select().from(trainingSessions).orderBy(desc(trainingSessions.startAt)).limit(500),
    db.select().from(trainingSessionComplianceReviews).orderBy(desc(trainingSessionComplianceReviews.reviewedAt)).limit(500),
  ]);

  const now = new Date();
  const activeRequirements = requirements.filter((item) => item.status === "active");
  const mandatoryRequirements = activeRequirements.filter((item) => item.mandatory);
  const verifiedByRequirement = new Map(
    accreditations.filter((item) => item.status === "verified").map((item) => [item.requirementId, item]),
  );
  const missingEvidence = mandatoryRequirements.filter((item) => {
    const record = verifiedByRequirement.get(item.id);
    return !record || accreditationValidityState(record, now) !== "valid";
  }).length;
  const expiringSoon = accreditations.filter((item) => accreditationValidityState(item, now) === "expiring").length;
  const pendingVerification = accreditations.filter((item) => item.status === "pending").length;
  const blockedReviews = reviews.filter((item) => item.status === "blocked").length;
  const eligibleSessions = sessions.filter((session) => ["scheduled", "in_progress"].includes(session.status));
  const reviewBySession = new Map(reviews.map((review) => [review.sessionId, review]));
  const accreditationByRequirement = new Map<string, typeof accreditations>();
  for (const record of accreditations) {
    const list = accreditationByRequirement.get(record.requirementId) || [];
    list.push(record);
    accreditationByRequirement.set(record.requirementId, list);
  }

  return (
    <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Training Accreditation & Regulatory Compliance"
        description="Govern provider and service-specific regulatory obligations, verify supporting credentials, monitor expiry, and prevent training delivery when mandatory authorization is missing or invalid."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Mandatory requirements" value={mandatoryRequirements.length} hint="Active global and service-specific controls" tone="blue" icon={<Landmark className="h-5 w-5" />} />
        <StatCard label="Missing / invalid" value={missingEvidence} hint="Mandatory requirements without current evidence" tone={missingEvidence ? "red" : "emerald"} icon={<AlertTriangle className="h-5 w-5" />} />
        <StatCard label="Expiring ≤30 days" value={expiringSoon} hint="Verified credentials needing renewal attention" tone={expiringSoon ? "amber" : "slate"} icon={<CalendarClock className="h-5 w-5" />} />
        <StatCard label="Pending verification" value={pendingVerification} hint="Evidence awaiting internal verification" tone={pendingVerification ? "violet" : "slate"} icon={<FileCheck2 className="h-5 w-5" />} />
        <StatCard label="Blocked session reviews" value={blockedReviews} hint="Latest compliance review found blockers" tone={blockedReviews ? "red" : "emerald"} icon={<ShieldCheck className="h-5 w-5" />} />
      </div>

      {canManage && (
        <section className="mt-6 grid gap-6 xl:grid-cols-2">
          <Card className="p-5 sm:p-6">
            <h2 className="font-semibold text-[var(--vims-ink)]">Create regulatory requirement</h2>
            <p className="mt-1 text-sm text-[var(--vims-ink-muted)]">Leave service blank for provider-wide requirements; select a service for programme-specific authorization.</p>
            <form action={createTrainingRegulatoryRequirement} className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Requirement code"><Input name="requirementCode" required maxLength={50} placeholder="REG-HAZMAT-001" /></Field>
              <Field label="Scope"><select name="serviceId" className={selectClass}><option value="">All Driver Training services</option>{DRIVER_TRAINING_SERVICES.map((service) => <option key={service.id} value={service.id}>{service.title}</option>)}</select></Field>
              <Field label="Requirement title" className="sm:col-span-2"><Input name="title" required maxLength={240} /></Field>
              <Field label="Authority / regulator"><Input name="authority" required maxLength={240} /></Field>
              <Field label="Standard / reference"><Input name="standardReference" maxLength={240} /></Field>
              <Field label="Requirement type"><select name="requirementType" required className={selectClass}><option value="provider_accreditation">Provider accreditation</option><option value="trainer_certification">Trainer certification</option><option value="operating_licence">Operating licence</option><option value="insurance">Insurance</option><option value="permit">Permit</option><option value="approved_procedure">Approved procedure</option><option value="equipment_certification">Equipment certification</option><option value="other">Other</option></select></Field>
              <Field label="Review due"><Input name="reviewDueDate" type="date" /></Field>
              <label className="flex items-center gap-2 text-sm text-[var(--vims-ink-soft)]"><input name="mandatory" type="checkbox" defaultChecked /> Mandatory delivery gate</label>
              <input type="hidden" name="status" value="active" />
              <Field label="Governance notes" className="sm:col-span-2"><TextArea name="notes" maxLength={4000} /></Field>
              <div className="sm:col-span-2 flex justify-end"><Button type="submit"><Landmark className="h-4 w-4" /> Create requirement</Button></div>
            </form>
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="font-semibold text-[var(--vims-ink)]">Add accreditation / compliance evidence</h2>
            <p className="mt-1 text-sm text-[var(--vims-ink-muted)]">New evidence remains pending until internally verified.</p>
            {activeRequirements.length === 0 ? <div className="mt-4"><EmptyState title="No active regulatory requirements" /></div> : (
              <form action={createTrainingAccreditationRecord} className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Requirement" className="sm:col-span-2"><select name="requirementId" required className={selectClass}><option value="">Select requirement</option>{activeRequirements.map((item) => <option key={item.id} value={item.id}>{item.requirementCode} · {item.title}</option>)}</select></Field>
                <Field label="Credential / licence number"><Input name="credentialNumber" maxLength={120} /></Field>
                <Field label="Issuing authority"><Input name="issuingAuthority" required maxLength={240} /></Field>
                <Field label="Issued date"><Input name="issuedDate" type="date" /></Field>
                <Field label="Valid from"><Input name="validFrom" type="date" required /></Field>
                <Field label="Valid until"><Input name="validUntil" type="date" /></Field>
                <Field label="Evidence reference" className="sm:col-span-2"><Input name="evidenceReference" required maxLength={500} placeholder="Document ID, controlled file reference, URL, or archive reference" /></Field>
                <div className="sm:col-span-2 flex justify-end"><Button type="submit"><FileCheck2 className="h-4 w-4" /> Add evidence</Button></div>
              </form>
            )}
          </Card>
        </section>
      )}

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-[var(--vims-line)] px-5 py-4 sm:px-6"><h2 className="font-semibold text-[var(--vims-ink)]">Requirements & accreditation evidence</h2><p className="mt-1 text-sm text-[var(--vims-ink-muted)]">A verified credential only satisfies the delivery gate while its effective dates remain current.</p></div>
          {requirements.length === 0 ? <div className="p-5"><EmptyState title="No regulatory requirements configured" /></div> : (
            <div className="divide-y divide-[var(--vims-line)]">
              {requirements.map((requirement) => {
                const records = accreditationByRequirement.get(requirement.id) || [];
                const verified = records.find((item) => item.status === "verified");
                const validity = verified ? accreditationValidityState(verified, now) : "missing";
                return (
                  <div key={requirement.id} className="p-5 sm:p-6">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-[var(--vims-ink)]">{requirement.requirementCode} · {requirement.title}</p><Badge tone={requirement.status === "active" ? "blue" : "slate"}>{requirement.status}</Badge>{requirement.mandatory && <Badge tone="amber">mandatory</Badge>}<Badge tone={validityTone(validity)}>{validity.replaceAll("_", " ")}</Badge></div>
                        <p className="mt-1 text-sm text-[var(--vims-ink-soft)]">{requirement.authority}{requirement.standardReference ? ` · ${requirement.standardReference}` : ""}</p>
                        <p className="mt-1 text-xs text-[var(--vims-ink-muted)]">Scope: {requirement.serviceId ? serviceNames.get(requirement.serviceId) || requirement.serviceId : "All Driver Training services"}{requirement.reviewDueDate ? ` · Review ${formatDate(requirement.reviewDueDate)}` : ""}</p>
                      </div>
                      {canManage && <form action={setTrainingRegulatoryRequirementStatus}><input type="hidden" name="requirementId" value={requirement.id} /><input type="hidden" name="status" value={requirement.status === "active" ? "inactive" : "active"} /><Button type="submit" size="sm" variant="secondary">{requirement.status === "active" ? "Deactivate" : "Activate"}</Button></form>}
                    </div>
                    <div className="mt-4 space-y-2">
                      {records.length === 0 ? <p className="text-xs text-[var(--vims-ink-muted)]">No evidence records.</p> : records.slice(0, 8).map((record) => {
                        const recordValidity = accreditationValidityState(record, now);
                        return <div key={record.id} className="rounded-xl border border-[var(--vims-line)] bg-[var(--vims-panel-soft)] p-3"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-[var(--vims-ink)]">{record.credentialNumber || "Evidence record"}</strong><Badge tone={validityTone(recordValidity)}>{recordValidity.replaceAll("_", " ")}</Badge></div><p className="mt-1 text-xs text-[var(--vims-ink-muted)]">{record.issuingAuthority} · Valid {formatDate(record.validFrom)}{record.validUntil ? ` to ${formatDate(record.validUntil)}` : " with no recorded expiry"}</p><p className="mt-1 break-all text-xs text-[var(--vims-ink-muted)]">Evidence: {record.evidenceReference}</p></div>{canManage && <AccreditationActions record={record} />}</div></div>;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="p-5 sm:p-6">
            <h2 className="font-semibold text-[var(--vims-ink)]">Session compliance review</h2>
            <p className="mt-1 text-sm text-[var(--vims-ink-muted)]">Review current evidence before delivery. PostgreSQL repeats the mandatory check when a session is actually started.</p>
            {canManage && eligibleSessions.length > 0 && <form action={reviewTrainingSessionRegulatoryCompliance} className="mt-4 space-y-4"><Field label="Training session"><select name="sessionId" required className={selectClass}><option value="">Select session</option>{eligibleSessions.map((session) => <option key={session.id} value={session.id}>{session.referenceNumber} · {serviceNames.get(session.serviceId) || session.title}</option>)}</select></Field><Field label="Review notes"><TextArea name="notes" maxLength={4000} /></Field><div className="flex justify-end"><Button type="submit"><ShieldCheck className="h-4 w-4" /> Review compliance</Button></div></form>}
            <div className="mt-5 space-y-2">
              {eligibleSessions.slice(0, 20).map((session) => {
                const review = reviewBySession.get(session.id);
                const live = evaluateTrainingRegulatoryCompliance(session.serviceId, requirements, accreditations, now);
                return <div key={session.id} className="rounded-xl border border-[var(--vims-line)] p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-[var(--vims-ink)]">{session.referenceNumber}</p><Badge tone={live.ready ? "emerald" : "red"}>{live.ready ? "currently compliant" : `${live.blockers.length} blocker${live.blockers.length === 1 ? "" : "s"}`}</Badge></div><p className="mt-1 text-xs text-[var(--vims-ink-muted)]">{serviceNames.get(session.serviceId) || session.serviceId}{review ? ` · Last review ${formatDateTime(review.reviewedAt)} (${review.status})` : " · Not formally reviewed"}</p>{!live.ready && <p className="mt-2 text-xs text-red-700">Missing/invalid: {live.blockers.join("; ")}</p>}</div>;
              })}
              {eligibleSessions.length === 0 && <EmptyState title="No session currently needs compliance review" />}
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}

function AccreditationActions({ record }: { record: typeof trainingAccreditationRecords.$inferSelect }) {
  if (record.status === "pending") return <div className="space-y-2"><form action={decideTrainingAccreditationRecord} className="flex gap-2"><input type="hidden" name="accreditationId" value={record.id} /><input type="hidden" name="status" value="verified" /><Button type="submit" size="sm"><BadgeCheck className="h-4 w-4" /> Verify</Button></form><form action={decideTrainingAccreditationRecord} className="space-y-2"><input type="hidden" name="accreditationId" value={record.id} /><input type="hidden" name="status" value="rejected" /><Input name="verificationNotes" required maxLength={4000} placeholder="Rejection reason" /><Button type="submit" size="sm" variant="secondary">Reject</Button></form></div>;
  if (record.status === "verified") return <form action={decideTrainingAccreditationRecord} className="space-y-2"><input type="hidden" name="accreditationId" value={record.id} /><input type="hidden" name="status" value="revoked" /><Input name="verificationNotes" required maxLength={4000} placeholder="Revocation reason" /><Button type="submit" size="sm" variant="secondary">Revoke</Button></form>;
  return null;
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`block ${className}`}><span className="mb-1.5 block text-xs font-semibold text-[var(--vims-ink-soft)]">{label}</span>{children}</label>;
}

function validityTone(state: string): "slate" | "blue" | "amber" | "emerald" | "red" | "violet" {
  if (state === "valid") return "emerald";
  if (state === "expiring" || state === "not_yet_valid" || state === "pending") return "amber";
  if (state === "missing" || state === "expired" || state === "revoked" || state === "rejected") return "red";
  return "slate";
}

const selectClass = "min-h-10 w-full rounded-lg border border-[var(--vims-line)] bg-[var(--vims-panel-solid)] px-3 text-sm text-[var(--vims-ink)] outline-none focus:border-[var(--vims-primary)]";
