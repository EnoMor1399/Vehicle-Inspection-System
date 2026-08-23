import "../certificate.css";
import { addMonths } from "date-fns";
import { db } from "@/db";
import { inspections, vehicles, signatures, transporters, locations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { requireAuth } from "@/lib/require-auth";
import { getSettings } from "@/lib/settings";
import { summarizeSection, INSPECTION_SECTIONS } from "@/lib/sections";
import { QRCode } from "@/app/inspections/QRCode";
import { formatDateTime, formatDate } from "@/lib/utils";
import { ShieldCheck, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { CertificateToolbar } from "./CertificateToolbar";
import { certificateVerificationCode, createCertificateSignature } from "@/lib/certificate-security";

export const dynamic = "force-dynamic";

type ResultTone = "pass" | "conditional" | "fail" | "pending" | "expired";

export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;

  const [inspection] = await db.select().from(inspections).where(eq(inspections.id, id));
  if (!inspection) notFound();

  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, inspection.vehicleId));
  if (!vehicle) notFound();

  const [transporter] = vehicle.transporterId
    ? await db.select().from(transporters).where(eq(transporters.id, vehicle.transporterId))
    : [];
  const [location] = inspection.locationId
    ? await db.select().from(locations).where(eq(locations.id, inspection.locationId))
    : [];
  const sigs = await db.select().from(signatures).where(eq(signatures.inspectionId, id));
  const inspectorSig = sigs.find((sig) => sig.type === "inspector");
  const supervisorSig = sigs.find((sig) => sig.type === "supervisor");
  const settings = await getSettings();

  const sections = inspection.sectionData || [];
  let totalPass = 0;
  let totalFail = 0;
  let totalNa = 0;
  for (const section of sections) {
    const totals = summarizeSection(section);
    totalPass += totals.pass;
    totalFail += totals.fail;
    totalNa += totals.na;
  }

  const signatureRequirementsMet = !settings.requireDigitalSignature
    || Boolean(inspectorSig && (!settings.requireSupervisorApproval || supervisorSig));
  const approvalRequirementsMet = settings.requireSupervisorApproval
    ? inspection.workflowStatus === "approved"
    : ["completed", "approved"].includes(inspection.workflowStatus);
  const issuanceRequirementsMet = approvalRequirementsMet && signatureRequirementsMet;

  const validUntil = inspection.nextInspectionDate
    ? new Date(`${inspection.nextInspectionDate}T23:59:59`)
    : addMonths(new Date(inspection.inspectionDate), settings.certificateValidityMonths);
  const currentTime = new Date();
  const expired = validUntil.getTime() < currentTime.getTime();

  const fingerprint = {
    inspectionId: inspection.id,
    inspectionNumber: inspection.inspectionNumber,
    vehicleRegistration: vehicle.registrationNumber,
    inspectionDate: inspection.inspectionDate,
    overallResult: inspection.overallResult,
    nextInspectionDate: inspection.nextInspectionDate,
  };
  const signature = createCertificateSignature(fingerprint);
  const verificationCode = certificateVerificationCode(fingerprint);
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "";
  const forwardedProto = requestHeaders.get("x-forwarded-proto") || (process.env.NODE_ENV === "production" ? "https" : "http");
  const configuredBaseUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const baseUrl = configuredBaseUrl || (forwardedHost ? `${forwardedProto}://${forwardedHost}` : "");
  const verifyPath = `/verify/${inspection.id}?sig=${encodeURIComponent(signature)}`;
  const verifyUrl = baseUrl ? `${baseUrl}${verifyPath}` : verifyPath;

  const roadworthy = inspection.overallResult === "pass" && issuanceRequirementsMet && !expired;
  const { label: resultLabel, tone, description } = certificateState(
    inspection.overallResult,
    issuanceRequirementsMet,
    expired
  );

  return (
    <main className="certificate-screen">
      <CertificateToolbar vehicleRegistration={vehicle.registrationNumber} verifyUrl={verifyUrl || verifyPath} />

      <article className={`certificate-document certificate-state-${tone}`}>
        <div className="certificate-security-pattern" aria-hidden="true" />
        <div className="certificate-frame certificate-frame-outer" aria-hidden="true" />
        <div className="certificate-frame certificate-frame-inner" aria-hidden="true" />

        {!issuanceRequirementsMet && (
          <div className="certificate-control-watermark" aria-hidden="true">PENDING APPROVAL</div>
        )}
        {expired && issuanceRequirementsMet && (
          <div className="certificate-control-watermark" aria-hidden="true">EXPIRED</div>
        )}

        <header className="certificate-header">
          <div className="certificate-brand">
            <div className="certificate-logo-box">
              {settings.logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={settings.logoDataUrl} alt={`${settings.companyName} logo`} />
              ) : (
                <ShieldCheck aria-hidden="true" />
              )}
            </div>
            <div>
              <p className="certificate-kicker">Official Inspection Document</p>
              <h2>{settings.companyName}</h2>
              <p className="certificate-tagline">{settings.tagline || "Vehicle Inspection Management System"}</p>
              <p className="certificate-legal-line">
                {[settings.registrationNumber && `Reg. No. ${settings.registrationNumber}`, settings.taxId && `TIN ${settings.taxId}`]
                  .filter(Boolean).join(" • ") || "Registered inspection organization"}
              </p>
            </div>
          </div>
          <div className="certificate-reference">
            <span>Certificate Reference</span>
            <strong>{inspection.inspectionNumber}</strong>
            <small>Document version 2.0</small>
          </div>
        </header>

        <section className="certificate-title-block">
          <div className="certificate-rule"><span /></div>
          <p>{settings.certificateHeader || "Vehicle Safety & Roadworthiness Assessment"}</p>
          <h1>Vehicle Inspection Certificate</h1>
          <div className="certificate-rule"><span /></div>
        </section>

        <section className="certificate-intro">
          <p>
            This document certifies that the vehicle identified below was inspected on <strong>{formatDate(inspection.inspectionDate)}</strong>
            {location?.name ? <> at <strong>{location.name}</strong></> : null} in accordance with the organization&apos;s approved vehicle inspection procedures.
            The recorded outcome and validity status are stated on this certificate and can be independently checked using the signed QR verification code.
          </p>
        </section>

        <section className="certificate-status-row">
          <div className={`certificate-result-seal result-${tone}`}>
            <div className="certificate-result-icon">
              {tone === "pass" ? <CheckCircle2 /> : tone === "fail" ? <XCircle /> : <AlertTriangle />}
            </div>
            <div>
              <span>Inspection Status</span>
              <strong>{resultLabel}</strong>
              <small>{description}</small>
            </div>
          </div>
          <div className="certificate-validity-panel">
            <div>
              <span>Issued / Inspected</span>
              <strong>{formatDate(inspection.inspectionDate)}</strong>
            </div>
            <div>
              <span>Valid Until</span>
              <strong>{roadworthy ? formatDate(validUntil) : "Not valid for roadworthiness"}</strong>
            </div>
          </div>
        </section>

        <section className="certificate-section">
          <div className="certificate-section-heading">
            <span>01</span><h3>Vehicle Identification</h3>
          </div>
          <div className="certificate-detail-grid">
            <Detail label="Registration Number" value={vehicle.registrationNumber} emphasize />
            <Detail label="Make / Model" value={`${vehicle.make} ${vehicle.model || ""}`.trim()} />
            <Detail label="VIN" value={vehicle.vin || "Not recorded"} mono />
            <Detail label="Chassis Number" value={vehicle.chassisNumber || "Not recorded"} mono />
            <Detail label="Vehicle Class" value={vehicle.vehicleClass || vehicle.category || "Not recorded"} />
            <Detail label="Transporter / Owner" value={transporter?.companyName || vehicle.ownerName || "Not recorded"} />
          </div>
        </section>

        <section className="certificate-section">
          <div className="certificate-section-heading">
            <span>02</span><h3>Inspection Record</h3>
          </div>
          <div className="certificate-detail-grid four-col">
            <Detail label="Inspection Date" value={formatDateTime(inspection.inspectionDate)} />
            <Detail label="Station" value={location?.name || inspection.station || "Not recorded"} />
            <Detail label="Inspector" value={inspection.inspectorName || inspectorSig?.signerName || "Not recorded"} />
            <Detail label="Supervisor" value={inspection.supervisorName || supervisorSig?.signerName || (settings.requireSupervisorApproval ? "Pending" : "Not required")} />
          </div>
        </section>

        <section className="certificate-section certificate-summary-section">
          <div className="certificate-section-heading">
            <span>03</span><h3>Technical Assessment Summary</h3>
          </div>
          <div className="certificate-score-grid">
            <Score label="Items Passed" value={totalPass} className="score-pass" />
            <Score label="Items Failed" value={totalFail} className="score-fail" />
            <Score label="Not Applicable" value={totalNa} className="score-neutral" />
            <Score label="Total Assessed" value={totalPass + totalFail + totalNa} className="score-total" />
          </div>
          <div className="certificate-section-chips">
            {INSPECTION_SECTIONS.map((definition) => {
              const section = sections.find((entry) => entry.section === definition.code);
              if (!section) return null;
              const totals = summarizeSection(section);
              const state = totals.fail > 0 ? "fail" : totals.pass > 0 ? "pass" : "neutral";
              return (
                <div className={`certificate-section-chip chip-${state}`} key={definition.code}>
                  <span>{definition.title}</span>
                  <strong>{totals.pass}P / {totals.fail}F</strong>
                </div>
              );
            })}
          </div>
          {(inspection.serviceBrakeEfficiency || inspection.parkingBrakeEfficiency || inspection.noiseLevel || inspection.opacityTest) && (
            <div className="certificate-readings">
              <Reading label="Service Brake" value={inspection.serviceBrakeEfficiency ? `${inspection.serviceBrakeEfficiency}%` : "—"} />
              <Reading label="Parking Brake" value={inspection.parkingBrakeEfficiency ? `${inspection.parkingBrakeEfficiency}%` : "—"} />
              <Reading label="Noise Level" value={inspection.noiseLevel ? `${inspection.noiseLevel} dB` : "—"} />
              <Reading label="Opacity" value={inspection.opacityTest ? `${inspection.opacityTest}%` : "—"} />
            </div>
          )}
        </section>

        <section className="certificate-section certificate-authorization">
          <div className="certificate-section-heading">
            <span>04</span><h3>Authorization & Authentication</h3>
          </div>
          <div className="certificate-auth-grid">
            <SignatureBlock
              title="Inspecting Officer"
              name={inspection.inspectorName || inspectorSig?.signerName || "Not recorded"}
              dataUrl={inspectorSig?.dataUrl}
              signedAt={inspectorSig?.signedAt}
              required={settings.requireDigitalSignature}
            />
            <SignatureBlock
              title="Supervising Officer"
              name={inspection.supervisorName || supervisorSig?.signerName || "Not recorded"}
              dataUrl={supervisorSig?.dataUrl}
              signedAt={supervisorSig?.signedAt}
              required={settings.requireSupervisorApproval}
            />
            <div className="certificate-verification-box">
              <div className="certificate-qr">
                <QRCode value={verifyUrl || verifyPath} size={104} />
              </div>
              <div>
                <span>Secure Online Verification</span>
                <strong>{verificationCode}</strong>
                <p>Scan the QR code to validate the signed certificate record and current status.</p>
              </div>
            </div>
          </div>
        </section>

        <footer className="certificate-footer">
          <div>
            <strong>{settings.companyName}</strong>
            <p>{[settings.address, settings.city, settings.region, settings.country].filter(Boolean).join(", ")}</p>
            <p>{[settings.phone, settings.email, settings.website].filter(Boolean).join(" • ")}</p>
          </div>
          <div className="certificate-footer-notice">
            <p>{settings.certificateFooter || "Electronically generated controlled document. Verify authenticity using the QR code and verification code printed above."}</p>
            <p className="certificate-accreditation-note">No external accreditation or government endorsement is implied unless separately stated and supported by the issuing organization&apos;s current accreditation records.</p>
          </div>
        </footer>
      </article>
    </main>
  );
}

function certificateState(result: string, issued: boolean, expired: boolean): { label: string; tone: ResultTone; description: string } {
  if (!issued) return { label: "PENDING AUTHORIZATION", tone: "pending", description: "Approval or required signature is outstanding" };
  if (expired) return { label: "EXPIRED", tone: "expired", description: "The inspection validity period has ended" };
  if (result === "pass") return { label: "PASS — ROADWORTHY", tone: "pass", description: "Meets the recorded inspection requirements" };
  if (result === "conditional_pass") return { label: "CONDITIONAL", tone: "conditional", description: "Conditions or corrective actions apply" };
  if (result === "reinspection_required") return { label: "RE-INSPECTION REQUIRED", tone: "conditional", description: "Corrective work and re-inspection are required" };
  return { label: "FAIL — NOT ROADWORTHY", tone: "fail", description: "Does not meet the recorded inspection requirements" };
}

function Detail({ label, value, mono, emphasize }: { label: string; value: string; mono?: boolean; emphasize?: boolean }) {
  return <div className="certificate-detail"><span>{label}</span><strong className={`${mono ? "mono" : ""} ${emphasize ? "emphasize" : ""}`}>{value}</strong></div>;
}

function Score({ label, value, className }: { label: string; value: number; className: string }) {
  return <div className={`certificate-score ${className}`}><strong>{value}</strong><span>{label}</span></div>;
}

function Reading({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function SignatureBlock({ title, name, dataUrl, signedAt, required }: { title: string; name: string; dataUrl?: string | null; signedAt?: Date | null; required: boolean }) {
  return (
    <div className="certificate-signature">
      <span>{title}</span>
      <div className="certificate-signature-space">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt={`${title} signature`} />
        ) : <em>{required ? "Digital signature required" : "Signature not required"}</em>}
      </div>
      <strong>{name}</strong>
      <small>{signedAt ? `Digitally signed ${formatDateTime(signedAt)}` : required ? "Not yet signed" : "Authorization per workflow"}</small>
    </div>
  );
}
