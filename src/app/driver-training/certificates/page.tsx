import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Award, BadgeCheck, ShieldCheck } from "lucide-react";
import { db } from "@/db";
import { trainingCertificates, trainingParticipants, trainingSessions } from "@/db/training-schema";
import { Badge, Button, Card, EmptyState, Field, PageHeader, Select, TextInput } from "@/components/ui";
import { DRIVER_TRAINING_SERVICES } from "@/lib/driver-training";
import { requireInternalUser } from "@/lib/require-auth";
import { canManageTraining, canViewTraining } from "@/lib/training-access";
import { formatDate, formatDateTime } from "@/lib/utils";
import { issueTrainingCertificate } from "../actions";

export const dynamic = "force-dynamic";

const serviceNames = new Map(DRIVER_TRAINING_SERVICES.map((service) => [service.id, service.title]));

export default async function TrainingCertificatesPage() {
  const user = await requireInternalUser();
  if (!canViewTraining(user)) return <div className="p-8 text-sm text-slate-600">You do not have access to Driver Training & Assessment Services.</div>;
  const canManage = canManageTraining(user);

  const [eligibleParticipants, certificates] = await Promise.all([
    db
      .select({
        id: trainingParticipants.id,
        fullName: trainingParticipants.fullName,
        referenceNumber: trainingSessions.referenceNumber,
        serviceId: trainingSessions.serviceId,
      })
      .from(trainingParticipants)
      .innerJoin(trainingSessions, eq(trainingSessions.id, trainingParticipants.sessionId))
      .where(eq(trainingParticipants.certificateEligible, true))
      .orderBy(trainingParticipants.fullName)
      .limit(300),
    db
      .select({
        id: trainingCertificates.id,
        certificateNumber: trainingCertificates.certificateNumber,
        verificationCode: trainingCertificates.verificationCode,
        serviceId: trainingCertificates.serviceId,
        issueDate: trainingCertificates.issueDate,
        expiryDate: trainingCertificates.expiryDate,
        status: trainingCertificates.status,
        issuedAt: trainingCertificates.issuedAt,
        fullName: trainingParticipants.fullName,
        referenceNumber: trainingSessions.referenceNumber,
      })
      .from(trainingCertificates)
      .innerJoin(trainingParticipants, eq(trainingParticipants.id, trainingCertificates.participantId))
      .innerJoin(trainingSessions, eq(trainingSessions.id, trainingCertificates.sessionId))
      .orderBy(desc(trainingCertificates.issuedAt))
      .limit(300),
  ]);

  return (
    <div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Training Certificates"
        description="Issue controlled competence certificates only after a passing assessment and maintain an auditable certificate register."
        action={<Link href="/driver-training/participants" className="text-sm font-semibold text-[var(--brand-accent)] hover:opacity-75">Participants & assessments →</Link>}
      />

      {canManage && (
        <Card className="mb-6 overflow-hidden">
          <div className="border-b border-[var(--vims-line)] px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"><Award className="h-5 w-5" /></div>
              <div><h2 className="font-semibold text-[var(--vims-ink)]">Issue certificate</h2><p className="text-sm text-[var(--vims-ink-muted)]">The server rechecks assessment eligibility and blocks duplicate active certificates.</p></div>
            </div>
          </div>
          <form action={issueTrainingCertificate} className="grid gap-4 p-5 sm:grid-cols-[1fr_220px_auto] sm:items-end sm:p-6">
            <Field label="Eligible participant" required>
              <Select name="participantId" required defaultValue="">
                <option value="" disabled>Select participant</option>
                {eligibleParticipants.map((item) => <option key={item.id} value={item.id}>{item.fullName} · {item.referenceNumber} · {serviceNames.get(item.serviceId) || item.serviceId}</option>)}
              </Select>
            </Field>
            <Field label="Validity (months)" required hint="Use 0 for no expiry.">
              <TextInput name="validityMonths" type="number" min={0} max={60} defaultValue={12} required />
            </Field>
            <Button type="submit" className="sm:mb-0"><BadgeCheck className="h-4 w-4" /> Issue certificate</Button>
          </form>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-[var(--vims-line)] px-5 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div><h2 className="font-semibold text-[var(--vims-ink)]">Certificate register</h2><p className="mt-1 text-sm text-[var(--vims-ink-muted)]">Latest 300 Driver Training & Assessment certificates.</p></div>
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
          </div>
        </div>
        {certificates.length === 0 ? (
          <div className="p-5 sm:p-6"><EmptyState icon={<Award className="h-5 w-5" />} title="No training certificates issued" description="Complete an assessment with a passing or competent result before issuing a certificate." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left text-sm">
              <thead className="bg-[var(--vims-panel-soft)] text-xs uppercase tracking-wide text-[var(--vims-ink-muted)]">
                <tr><th className="px-5 py-3 font-semibold">Certificate</th><th className="px-5 py-3 font-semibold">Participant</th><th className="px-5 py-3 font-semibold">Service / session</th><th className="px-5 py-3 font-semibold">Issued</th><th className="px-5 py-3 font-semibold">Expiry</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3 font-semibold">Verification code</th></tr>
              </thead>
              <tbody className="divide-y divide-[var(--vims-line)]">
                {certificates.map((item) => (
                  <tr key={item.id} className="hover:bg-[var(--vims-panel-soft)]/70">
                    <td className="px-5 py-4 font-semibold text-[var(--vims-ink)]">{item.certificateNumber}</td>
                    <td className="px-5 py-4 text-[var(--vims-ink-soft)]">{item.fullName}</td>
                    <td className="px-5 py-4"><p className="font-medium text-[var(--vims-ink)]">{serviceNames.get(item.serviceId) || item.serviceId}</p><p className="mt-1 text-xs text-[var(--vims-ink-muted)]">{item.referenceNumber}</p></td>
                    <td className="px-5 py-4 text-[var(--vims-ink-soft)]">{formatDate(item.issueDate)}<span className="mt-1 block text-xs text-[var(--vims-ink-muted)]">{formatDateTime(item.issuedAt)}</span></td>
                    <td className="px-5 py-4 text-[var(--vims-ink-soft)]">{item.expiryDate ? formatDate(item.expiryDate) : "No expiry"}</td>
                    <td className="px-5 py-4"><Badge tone={item.status === "active" ? "emerald" : item.status === "revoked" ? "red" : "slate"}>{item.status}</Badge></td>
                    <td className="px-5 py-4 font-mono text-xs text-[var(--vims-ink-muted)]">{item.verificationCode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
