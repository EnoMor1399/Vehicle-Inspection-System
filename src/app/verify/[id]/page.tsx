import type { ReactNode } from "react";
import { addMonths } from "date-fns";
import { db } from "@/db";
import { inspections, vehicles, signatures, transporters } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Card, Badge } from "@/components/ui";
import { ShieldCheck, CheckCircle2, XCircle, AlertTriangle, Car, Calendar, UserCheck, Fingerprint, LockKeyhole } from "lucide-react";
import { formatDateTime, formatDate } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import { certificateVerificationCode, verifyCertificateSignature } from "@/lib/certificate-security";

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

  let row = await db.select({ inspection: inspections, vehicle: vehicles })
    .from(inspections).innerJoin(vehicles, eq(vehicles.id, inspections.vehicleId))
    .where(eq(inspections.id, id));

  if (!row.length) {
    row = await db.select({ inspection: inspections, vehicle: vehicles })
      .from(inspections).innerJoin(vehicles, eq(vehicles.id, inspections.vehicleId))
      .where(eq(inspections.inspectionNumber, id));
  }

  if (!row.length) {
    return (
      <VerificationShell companyName={settings.companyName}>
        <Card className="max-w-lg w-full p-10 text-center">
          <StatusIcon tone="red"><XCircle className="h-8 w-8" /></StatusIcon>
          <h1 className="text-2xl font-semibold text-slate-950">Certificate Record Not Found</h1>
          <p className="text-slate-600 mt-2">No inspection certificate matches the supplied reference.</p>
          <p className="text-xs text-slate-500 mt-4 font-mono break-all">{id}</p>
        </Card>
      </VerificationShell>
    );
  }

  const { inspection: i, vehicle: v } = row[0];
  const [transporter] = v.transporterId
    ? await db.select().from(transporters).where(eq(transporters.id, v.transporterId))
    : [null];
  const sigs = await db.select().from(signatures).where(eq(signatures.inspectionId, i.id));
  const inspectorSig = sigs.find((s) => s.type === "inspector");
  const supervisorSig = sigs.find((s) => s.type === "supervisor");

  const fingerprint = {
    inspectionId: i.id,
    inspectionNumber: i.inspectionNumber,
    vehicleRegistration: v.registrationNumber,
    inspectionDate: i.inspectionDate,
    overallResult: i.overallResult,
    nextInspectionDate: i.nextInspectionDate,
  };
  const signed = Boolean(suppliedSignature);
  const signatureValid = verifyCertificateSignature(fingerprint, suppliedSignature);
  const verificationCode = certificateVerificationCode(fingerprint);

  const approvalRequirementsMet = settings.requireSupervisorApproval
    ? i.workflowStatus === "approved"
    : ["completed", "approved"].includes(i.workflowStatus);
  const signatureRequirementsMet = !settings.requireDigitalSignature
    || Boolean(inspectorSig && (!settings.requireSupervisorApproval || supervisorSig));
  const issued = approvalRequirementsMet && signatureRequirementsMet;
  const validUntil = i.nextInspectionDate
    ? new Date(`${i.nextInspectionDate}T23:59:59`)
    : addMonths(new Date(i.inspectionDate), settings.certificateValidityMonths);
  const currentTime = new Date();
  const expired = validUntil.getTime() < currentTime.getTime();
  const archived = i.workflowStatus === "archived";

  const authenticity = !signed
    ? { title: "Legacy / Unsigned Link", tone: "amber" as const, detail: "The database record exists, but this URL does not contain the cryptographic signature used by version 2 certificates." }
    : !signatureValid
      ? { title: "Signature Invalid", tone: "red" as const, detail: "The verification signature does not match the current certificate data. Do not rely on this copy." }
      : archived
        ? { title: "Record Archived", tone: "red" as const, detail: "The signed record is genuine but has been archived and should not be treated as active." }
        : { title: "Cryptographic Signature Valid", tone: "emerald" as const, detail: "The signed verification link matches the current inspection record." };

  const roadworthy = signatureValid && issued && !expired && !archived && i.overallResult === "pass";
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
              {roadworthy ? "Verified — Roadworthy" : i.overallResult === "fail" ? "Verified Record — Not Roadworthy" : "Certificate Requires Attention"}
            </h1>
            <p className="text-sm text-slate-600 mt-1 font-mono">{i.inspectionNumber}</p>
          </div>

          <div className={`rounded-xl p-4 border ${
            authenticity.tone === "emerald" ? "bg-emerald-50 border-emerald-200" :
            authenticity.tone === "red" ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
          }`}>
            <div className="flex gap-3">
              <LockKeyhole className={`h-5 w-5 mt-0.5 ${authenticity.tone === "emerald" ? "text-emerald-700" : authenticity.tone === "red" ? "text-red-700" : "text-amber-700"}`} />
              <div>
                <p className="font-semibold text-slate-900">{authenticity.title}</p>
                <p className="text-sm text-slate-600 mt-1">{authenticity.detail}</p>
                <p className="text-xs font-mono text-slate-500 mt-2">Verification code: {verificationCode}</p>
              </div>
            </div>
          </div>

          <Section title="Vehicle Identity" icon={<Car className="h-4 w-4" />}>
            <InfoRow label="Registration" value={v.registrationNumber} />
            <InfoRow label="Make / Model" value={`${v.make} ${v.model || ""}`.trim()} />
            <InfoRow label="VIN" value={v.vin} />
            <InfoRow label="Chassis Number" value={v.chassisNumber} />
            {transporter && <InfoRow label="Transporter" value={transporter.companyName} />}
          </Section>

          <Section title="Inspection & Validity" icon={<Calendar className="h-4 w-4" />}>
            <InfoRow label="Inspection Date" value={formatDateTime(i.inspectionDate)} />
            <InfoRow label="Station" value={i.station || "—"} />
            <InfoRow label="Workflow" value={i.workflowStatus.replaceAll("_", " ").toUpperCase()} />
            <InfoRow label="Valid Until" value={issued && i.overallResult === "pass" ? formatDate(validUntil) : "Not roadworthiness-valid"} />
            <InfoRow label="Approval Controls" value={issued ? "Satisfied" : "Outstanding"} />
            <div className="pt-3 flex items-center justify-between border-t border-slate-200">
              <span className="text-sm font-medium text-slate-700">Recorded Outcome</span>
              <Badge tone={resultTone} className="text-sm px-3 py-1">{i.overallResult.replaceAll("_", " ").toUpperCase()}</Badge>
            </div>
          </Section>

          {(inspectorSig || supervisorSig) && (
            <Section title="Digital Signatures" icon={<UserCheck className="h-4 w-4" />}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {inspectorSig && <SignatureBlock sig={inspectorSig} />}
                {supervisorSig && <SignatureBlock sig={supervisorSig} />}
              </div>
            </Section>
          )}

          <div className="mt-6 pt-4 border-t border-slate-200 text-center text-xs text-slate-500">
            <p className="flex items-center justify-center gap-1.5"><Fingerprint className="h-3.5 w-3.5" /> Checked {formatDateTime(new Date())}</p>
            <p className="mt-1">Verification confirms the organization&apos;s database record; it does not create or imply external accreditation.</p>
          </div>
        </Card>
      </div>
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

function SignatureBlock({ sig }: { sig: typeof signatures.$inferSelect }) {
  return (
    <div className="text-center">
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">{sig.type}</p>
      <div className="border border-slate-200 rounded-lg bg-white p-2 mb-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={sig.dataUrl} alt={`${sig.type} signature`} className="h-16 mx-auto object-contain" />
      </div>
      <p className="text-sm font-medium text-slate-900">{sig.signerName}</p>
      <p className="text-xs text-slate-500">{formatDateTime(sig.signedAt)}</p>
    </div>
  );
}
