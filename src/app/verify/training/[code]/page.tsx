import type { ReactNode } from "react";
import { eq } from "drizzle-orm";
import { Award, Calendar, CheckCircle2, Fingerprint, GraduationCap, ShieldCheck, XCircle } from "lucide-react";
import { db } from "@/db";
import { trainingCertificates, trainingParticipants, trainingSessions } from "@/db/training-schema";
import { Badge, Card } from "@/components/ui";
import { DRIVER_TRAINING_SERVICES } from "@/lib/driver-training";
import { getSettings } from "@/lib/settings";
import { effectiveTrainingCertificateStatus, trainingVerificationCodeSchema } from "@/lib/training-policy";
import { formatDate, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SERVICE_NAMES = new Map(DRIVER_TRAINING_SERVICES.map((service) => [service.id, service.title]));

export default async function VerifyTrainingCertificatePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const settings = await getSettings();
  const parsed = trainingVerificationCodeSchema.safeParse(code);
  if (!parsed.success) return <VerificationFailure companyName={settings.companyName} />;

  const [record] = await db
    .select({
      certificateNumber: trainingCertificates.certificateNumber,
      serviceId: trainingCertificates.serviceId,
      issueDate: trainingCertificates.issueDate,
      expiryDate: trainingCertificates.expiryDate,
      status: trainingCertificates.status,
      issuedAt: trainingCertificates.issuedAt,
      revokedAt: trainingCertificates.revokedAt,
      participantName: trainingParticipants.fullName,
      sessionReference: trainingSessions.referenceNumber,
      sessionTitle: trainingSessions.title,
    })
    .from(trainingCertificates)
    .innerJoin(trainingParticipants, eq(trainingParticipants.id, trainingCertificates.participantId))
    .innerJoin(trainingSessions, eq(trainingSessions.id, trainingCertificates.sessionId))
    .where(eq(trainingCertificates.verificationCode, parsed.data))
    .limit(1);

  if (!record) return <VerificationFailure companyName={settings.companyName} />;

  const currentTime = new Date();
  const effectiveStatus = effectiveTrainingCertificateStatus(record.status, record.expiryDate, currentTime);
  const valid = effectiveStatus === "active";
  const statusTone = valid ? "emerald" : "red";
  const StatusIcon = valid ? CheckCircle2 : XCircle;

  return (
    <VerificationShell companyName={settings.companyName}>
      <div className="w-full max-w-2xl space-y-4">
        <Card className="p-6 sm:p-8">
          <div className="text-center">
            <div className={`mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full ${valid ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
              <StatusIcon className="h-10 w-10" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Driver Training Certificate</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950">
              {valid ? "Verified — Certificate Active" : effectiveStatus === "revoked" ? "Verified Record — Certificate Revoked" : "Verified Record — Certificate Expired"}
            </h1>
            <p className="mt-2 font-mono text-sm text-slate-600">{record.certificateNumber}</p>
          </div>

          <div className={`mt-6 rounded-xl border p-4 ${valid ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
            <div className="flex gap-3">
              <ShieldCheck className={`mt-0.5 h-5 w-5 ${valid ? "text-emerald-700" : "text-red-700"}`} />
              <div>
                <p className="font-semibold text-slate-900">Verification code recognized</p>
                <p className="mt-1 text-sm text-slate-600">This verification link matches a Driver Training & Assessment certificate record held by VIMS.</p>
              </div>
            </div>
          </div>

          <Section title="Certificate holder" icon={<Award className="h-4 w-4" />}>
            <InfoRow label="Name" value={record.participantName} />
            <InfoRow label="Certificate" value={record.certificateNumber} />
          </Section>

          <Section title="Training record" icon={<GraduationCap className="h-4 w-4" />}>
            <InfoRow label="Service" value={SERVICE_NAMES.get(record.serviceId) || record.sessionTitle} />
            <InfoRow label="Session reference" value={record.sessionReference} />
          </Section>

          <Section title="Validity" icon={<Calendar className="h-4 w-4" />}>
            <InfoRow label="Issue date" value={formatDate(record.issueDate)} />
            <InfoRow label="Expiry date" value={record.expiryDate ? formatDate(record.expiryDate) : "No expiry"} />
            {record.revokedAt && <InfoRow label="Revoked" value={formatDateTime(record.revokedAt)} />}
            <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
              <span className="text-sm font-medium text-slate-700">Current status</span>
              <Badge tone={statusTone}>{effectiveStatus.toUpperCase()}</Badge>
            </div>
          </Section>

          <div className="mt-6 border-t border-slate-200 pt-4 text-center text-xs text-slate-500">
            <p className="flex items-center justify-center gap-1.5"><Fingerprint className="h-3.5 w-3.5" /> Checked {formatDateTime(currentTime)}</p>
            <p className="mt-1">Public verification displays only the minimum facts required to confirm certificate authenticity and validity.</p>
          </div>
        </Card>
      </div>
    </VerificationShell>
  );
}

function VerificationFailure({ companyName }: { companyName: string }) {
  return (
    <VerificationShell companyName={companyName}>
      <Card className="w-full max-w-lg p-8 text-center sm:p-10">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-red-100 text-red-700"><XCircle className="h-8 w-8" /></div>
        <h1 className="text-2xl font-semibold text-slate-950">Verification Could Not Be Confirmed</h1>
        <p className="mt-2 text-slate-600">Use the verification link supplied with the current Driver Training & Assessment certificate. Malformed and unknown codes do not disclose certificate details.</p>
      </Card>
    </VerificationShell>
  );
}

function VerificationShell({ companyName, children }: { companyName: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-4 py-8">
      <div className="mb-6 flex items-center gap-3 text-white">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-600"><ShieldCheck className="h-7 w-7" /></div>
        <div><p className="text-sm font-semibold">{companyName}</p><p className="text-xs text-slate-300">Driver Training Certificate Verification</p></div>
      </div>
      {children}
    </main>
  );
}

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return <section className="mt-4 space-y-3 rounded-xl bg-slate-50 p-5"><h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-slate-500">{icon}{title}</h2>{children}</section>;
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return <div className="flex justify-between gap-3 text-sm"><span className="text-slate-500">{label}</span><span className="text-right font-medium text-slate-900">{value || "—"}</span></div>;
}
