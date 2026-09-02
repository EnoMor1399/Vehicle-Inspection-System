import type { ReactNode } from "react";
import { addMonths } from "date-fns";
import { db } from "@/db";
import { inspections, vehicles, signatures } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Card, Badge } from "@/components/ui";
import { ShieldCheck, CheckCircle2, XCircle, AlertTriangle, Car, Calendar, Fingerprint, LockKeyhole } from "lucide-react";
import { formatDateTime, formatDate } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import {
  certificateVerificationCode,
  isCertificateSignatureFormat,
  verifyCertificateSignature,
} from "@/lib/certificate-security";

export const dynamic = "force-dynamic";

export default async function VerifyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sig?: string | string[] }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const suppliedSignature = Array.isArray(query.sig) ? query.sig[0] : query.sig;
  const settings = await getSettings();

  // A public verification request is useful only when it carries the signed
  // token generated into a VIMS certificate QR code. Reject malformed or
  // unsigned requests before disclosing whether a record reference exists.
  if (!isCertificateSignatureFormat(suppliedSignature)) {
    return <VerificationFailure companyName={settings.companyName} />;
  }

  let row = await db.select({ inspection: inspections, vehicle: vehicles })
    .from(inspections).innerJoin(vehicles, eq(vehicles.id, inspections.vehicleId))
    .where(eq(inspections.id, id))
    .limit(1);

  if (!row.length) {
    row = await db.select({ inspection: inspections, vehicle: vehicles })
      .from(inspections).innerJoin(vehicles, eq(vehicles.id, inspections.vehicleId))
      .where(eq(inspections.inspectionNumber, id))
      .limit(1);
  }

  if (!row.length) {
    return <VerificationFailure companyName={settings.companyName} />;
  }

  const { inspection: i, vehicle: v } = row[0];
  const fingerprint = {
    inspectionId: i.id,
    inspectionNumber: i.inspectionNumber,
    vehicleRegistration: v.registrationNumber,
    inspectionDate: i.inspectionDate,
    overallResult: i.overallResult,
    nextInspectionDate: i.nextInspectionDate,
  };

  if (!verifyCertificateSignature(fingerprint, suppliedSignature)) {
    return <VerificationFailure companyName={settings.companyName} />;
  }

  const signatureTypes = settings.requireDigitalSignature
    ? await db
        .select({ type: signatures.type })
        .from(signatures)
        .where(eq(signatures.inspectionId, i.id))
    : [];
  const hasInspectorSignature = !settings.requireDigitalSignature
    || signatureTypes.some((signature) => signature.type === "inspector")
    || Boolean(i.inspectorSignature);
  const hasSupervisorSignature = !settings.requireSupervisorApproval
    || !settings.requireDigitalSignature
    || signatureTypes.some((signature) => signature.type === "supervisor")
    || Boolean(i.supervisorSignature);

  const verificationCode = certificateVerificationCode(fingerprint);
  const approvalRequirementsMet = settings.requireSupervisorApproval
    ? i.workflowStatus === "approved"
    : ["completed", "approved"].includes(i.workflowStatus);
  const signatureRequirementsMet = hasInspectorSignature && hasSupervisorSignature;
  const issued = approvalRequirementsMet && signatureRequirementsMet;
  const validUntil = i.nextInspectionDate
    ? new Date(`${i.nextInspectionDate}T23:59:59`)
    : addMonths(new Date(i.inspectionDate), settings.certificateValidityMonths);
  const currentTime = new Date();
  const expired = validUntil.getTime() < currentTime.getTime();
  const archived = i.workflowStatus === "archived";
  const roadworthy = issued && !expired && !archived && i.overallResult === "pass";
  const resultTone = roadworthy ? "emerald" : i.overallResult === "fail" || archived ? "red" : "amber";
  const ResultIcon = roadworthy ? CheckCircle2 : i.overallResult === "fail" || archived ? XCircle : AlertTriangle;

  return (
    <VerificationShell companyName={settings.companyName}>
      <div className="max-w-2xl w-full space-y-4">
        <Card className="p-8">
          <div className="text-center mb-6">
            <StatusIcon tone={resultTone}><ResultIcon className="h-10 w-10" /></StatusIcon>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Certificate Status</p>
            <h1 className="text-2xl font-semibold text-slate-950 mt-1">
              {roadworthy ? "Verified — Roadworthy" : i.overallResult === "fail" ? "Verified Record — Not Roadworthy" : "Verified Record — Requires Attention"}
            </h1>
            <p className="text-sm text-slate-600 mt-1 font-mono">{i.inspectionNumber}</p>
          </div>

          <div className="rounded-xl p-4 border bg-emerald-50 border-emerald-200">
            <div className="flex gap-3">
              <LockKeyhole className="h-5 w-5 mt-0.5 text-emerald-700" />
              <div>
                <p className="font-semibold text-slate-900">Cryptographic Signature Valid</p>
                <p className="text-sm text-slate-600 mt-1">This signed verification link matches the current VIMS inspection record.</p>
                <p className="text-xs font-mono text-slate-500 mt-2">Verification code: {verificationCode}</p>
              </div>
            </div>
          </div>

          <Section title="Vehicle Identity" icon={<Car className="h-4 w-4" />}>
            <InfoRow label="Registration" value={v.registrationNumber} />
            <InfoRow label="Make / Model" value={`${v.make} ${v.model || ""}`.trim()} />
          </Section>

          <Section title="Inspection & Validity" icon={<Calendar className="h-4 w-4" />}>
            <InfoRow label="Inspection Date" value={formatDateTime(i.inspectionDate)} />
            <InfoRow label="Station" value={i.station || "—"} />
            <InfoRow label="Workflow" value={i.workflowStatus.replaceAll("_", " ").toUpperCase()} />
            <InfoRow label="Valid Until" value={issued && i.overallResult === "pass" ? formatDate(validUntil) : "Not roadworthiness-valid"} />
            <InfoRow label="Approval Controls" value={issued ? "Satisfied" : "Outstanding"} />
            <InfoRow label="Digital Signature Controls" value={signatureRequirementsMet ? "Satisfied" : "Outstanding"} />
            <div className="pt-3 flex items-center justify-between border-t border-slate-200">
              <span className="text-sm font-medium text-slate-700">Recorded Outcome</span>
              <Badge tone={resultTone} className="text-sm px-3 py-1">{i.overallResult.replaceAll("_", " ").toUpperCase()}</Badge>
            </div>
          </Section>

          <div className="mt-6 pt-4 border-t border-slate-200 text-center text-xs text-slate-500">
            <p className="flex items-center justify-center gap-1.5"><Fingerprint className="h-3.5 w-3.5" /> Checked {formatDateTime(currentTime)}</p>
            <p className="mt-1">Public verification intentionally displays only the minimum certificate facts required to confirm authenticity and validity.</p>
          </div>
        </Card>
      </div>
    </VerificationShell>
  );
}

function VerificationFailure({ companyName }: { companyName: string }) {
  return (
    <VerificationShell companyName={companyName}>
      <Card className="max-w-lg w-full p-10 text-center">
        <StatusIcon tone="red"><XCircle className="h-8 w-8" /></StatusIcon>
        <h1 className="text-2xl font-semibold text-slate-950">Verification Could Not Be Confirmed</h1>
        <p className="text-slate-600 mt-2">
          Use the QR code or signed verification link from the current VIMS certificate. Unsigned, malformed, unknown, and tampered references do not disclose certificate details.
        </p>
      </Card>
    </VerificationShell>
  );
}

function VerificationShell({ companyName, children }: { companyName: string; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 py-8 px-4 flex flex-col items-center">
      <div className="flex items-center gap-3 mb-6 text-white">
        <div className="h-12 w-12 rounded-xl bg-amber-500/90 grid place-items-center"><ShieldCheck className="h-7 w-7" /></div>
        <div><p className="text-sm font-semibold">{companyName}</p><p className="text-xs text-slate-300">Secure Certificate Verification</p></div>
      </div>
      {children}
    </main>
  );
}

function StatusIcon({ tone, children }: { tone: "emerald" | "red" | "amber"; children: ReactNode }) {
  return <div className={`inline-flex items-center justify-center h-20 w-20 rounded-full mb-4 ${tone === "emerald" ? "bg-emerald-100 text-emerald-700" : tone === "red" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{children}</div>;
}

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return <section className="rounded-xl bg-slate-50 p-5 mt-4 space-y-3"><h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">{icon}{title}</h2>{children}</section>;
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return <div className="flex justify-between gap-3 text-sm"><span className="text-slate-500">{label}</span><span className="font-medium text-slate-900 text-right">{value || "—"}</span></div>;
}
