import "../certificate.css";
import { addMonths } from "date-fns";
import { db } from "@/db";
import { inspections, vehicles, signatures, transporters, locations, users, type InspectionSectionData } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { requireAuth } from "@/lib/require-auth";
import { canAccessTransporterScope, hasPermission } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { QRCode } from "@/app/inspections/QRCode";
import { formatDate } from "@/lib/utils";
import { AlertTriangle, Globe2, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import { CertificateToolbar } from "../CertificateToolbar";
import { certificateVerificationCode, createCertificateSignature } from "@/lib/certificate-security";

export const dynamic = "force-dynamic";

type ResultTone = "pass" | "conditional" | "fail" | "pending" | "expired";

type SectionSummary = {
  code: string;
  title: string;
  pass: number;
  fail: number;
  na: number;
  status: "pass" | "fail" | "na";
};

export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const currentUser = await requireAuth();
  const { id } = await params;

  const [inspection] = await db.select().from(inspections).where(eq(inspections.id, id));
  if (!inspection) notFound();

  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, inspection.vehicleId));
  if (!vehicle || !canAccessTransporterScope(currentUser, vehicle.transporterId)) notFound();
  if (currentUser.role !== "transporter_user" && !hasPermission(currentUser, "inspections")) notFound();

  const [transporter] = vehicle.transporterId
    ? await db.select().from(transporters).where(eq(transporters.id, vehicle.transporterId))
    : [];
  const [location] = inspection.locationId
    ? await db.select().from(locations).where(eq(locations.id, inspection.locationId))
    : [];
  const [inspectorUser] = inspection.inspectorId
    ? await db.select().from(users).where(eq(users.id, inspection.inspectorId))
    : [];

  const sigs = await db.select().from(signatures).where(eq(signatures.inspectionId, id));
  const inspectorSig = sigs.find((sig) => sig.type === "inspector");
  const supervisorSig = sigs.find((sig) => sig.type === "supervisor");
  const settings = await getSettings();

  const sections = (inspection.sectionData || []) as InspectionSectionData[];
  const checklistItems = sections.flatMap((section) => section.items || []);
  const totalPass = checklistItems.filter((item) => item.result === "pass").length;
  const totalFail = checklistItems.filter((item) => item.result === "fail").length;
  const totalNa = checklistItems.filter((item) => item.result === "na").length;
  const sectionSummaries: SectionSummary[] = sections.map((section) => {
    const pass = section.items.filter((item) => item.result === "pass").length;
    const fail = section.items.filter((item) => item.result === "fail").length;
    const na = section.items.filter((item) => item.result === "na").length;
    return {
      code: section.section,
      title: section.title,
      pass,
      fail,
      na,
      status: fail > 0 ? "fail" : pass > 0 ? "pass" : "na",
    };
  });

  const failedItems = sections.flatMap((section) =>
    section.items
      .filter((item) => item.result === "fail")
      .map((item) => ({ section: section.section, title: section.title, name: item.name, severity: item.severity, remarks: item.remarks }))
  );

  const signatureRequirementsMet = !settings.requireDigitalSignature
    || Boolean((inspectorSig || inspection.inspectorSignature) && (!settings.requireSupervisorApproval || supervisorSig || inspection.supervisorSignature));
  const approvalRequirementsMet = settings.requireSupervisorApproval
    ? inspection.workflowStatus === "approved"
    : ["completed", "approved"].includes(inspection.workflowStatus);
  const issuanceRequirementsMet = approvalRequirementsMet && signatureRequirementsMet;

  const validUntil = inspection.nextInspectionDate
    ? new Date(`${inspection.nextInspectionDate}T23:59:59`)
    : addMonths(new Date(inspection.inspectionDate), settings.certificateValidityMonths);
  const expired = validUntil.getTime() < Date.now();

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

  const state = certificateState(inspection.overallResult, issuanceRequirementsMet, expired);
  const passSelected = inspection.overallResult === "pass" && issuanceRequirementsMet && !expired;
  const failSelected = ["fail", "reinspection_required"].includes(inspection.overallResult);
  const operatorName = transporter?.contactPerson || vehicle.ownerName || transporter?.companyName || "Not recorded";
  const operatorEmail = transporter?.email || "Not recorded";
  const operatorPhone = transporter?.mobile || vehicle.ownerContact || "Not recorded";
  const stationAddress = location?.address || inspection.station || "Not recorded";
  const inspectorName = inspection.inspectorName || inspectorSig?.signerName || inspectorUser?.name || "Not recorded";
  const inspectorSignature = inspectorSig?.dataUrl || inspection.inspectorSignature || null;
  const supervisorSignature = supervisorSig?.dataUrl || inspection.supervisorSignature || null;
  const supervisorName = inspection.supervisorName || supervisorSig?.signerName || (settings.requireSupervisorApproval ? "Pending" : "Not required");
  const remarks = compactText(inspection.inspectorRemarks || inspection.supervisorRemarks || "No additional remarks recorded.", 180);

  return (
    <main className="certificate-screen">
      <CertificateToolbar inspectionId={inspection.id} vehicleRegistration={vehicle.registrationNumber} verifyUrl={verifyUrl} />

      <article className={`certificate-document certificate-state-${state.tone}`}>
        {!issuanceRequirementsMet && <div className="cert-watermark">PENDING AUTHORIZATION</div>}
        {expired && issuanceRequirementsMet && <div className="cert-watermark">EXPIRED</div>}

        <header className="cert-letterhead">
          <div className="cert-brand">
            <div className="cert-logo">
              {settings.logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={settings.logoDataUrl} alt={`${settings.companyName} logo`} />
              ) : (
                <ShieldCheck />
              )}
            </div>
            <div>
              <h2>{settings.companyName}</h2>
              <p>{settings.tagline || "Vehicle Inspection Management System (VIMS)"}</p>
            </div>
          </div>
          <div className="cert-contact-list">
            {settings.address && <ContactLine icon={<MapPin />} value={[settings.address, settings.city, settings.region].filter(Boolean).join(", ")} />}
            {settings.phone && <ContactLine icon={<Phone />} value={settings.phone} />}
            {settings.email && <ContactLine icon={<Mail />} value={settings.email} />}
            {settings.website && <ContactLine icon={<Globe2 />} value={settings.website} />}
          </div>
        </header>

        <div className="cert-top-rule">
          <span />
          <p>Certificate No.: <strong>{inspection.inspectionNumber}</strong></p>
        </div>

        <section className="cert-title">
          <h1>Vehicle Inspection Certificate</h1>
          <p>Official single-page digital certificate generated from the approved VIMS inspection record.</p>
        </section>

        <section className="cert-identity-grid">
          <Field label="Registration" value={vehicle.registrationNumber} strong />
          <Field label="Make / Model" value={`${vehicle.make} ${vehicle.model || ""}`.trim()} />
          <Field label="VIN / Chassis" value={vehicle.vin || vehicle.chassisNumber || "Not recorded"} mono />
          <Field label="Year / Class" value={`${vehicle.manufacturingYear || "—"} · ${vehicle.vehicleClass || vehicle.category || "Not recorded"}`} />
          <Field label="Transporter / Owner" value={transporter?.companyName || vehicle.ownerName || "Not recorded"} />
          <Field label="Operator / Contact" value={operatorName} />
          <Field label="Phone / Email" value={`${operatorPhone}${operatorEmail !== "Not recorded" ? ` · ${operatorEmail}` : ""}`} />
          <Field label="Mileage" value={inspection.odometerReading ? `${inspection.odometerReading.toLocaleString()} km` : "Not recorded"} />
        </section>

        <section className="cert-main-band">
          <div className="cert-result-side">
            <p className="cert-mini-heading">Vehicle Inspection Result</p>
            <div className="cert-result-options">
              <ResultChoice label="PASS" active={passSelected} tone="pass" />
              <ResultChoice label="FAIL" active={failSelected} tone="fail" />
            </div>
            <div className={`cert-recorded-result result-${state.tone}`}>
              <span>Recorded VIMS outcome</span>
              <strong>{state.label}</strong>
              <small>{state.description}</small>
            </div>
            <div className="cert-result-meta">
              <div><span>Inspection</span><strong>{formatDate(inspection.inspectionDate)}</strong></div>
              <div><span>Valid Until</span><strong>{issuanceRequirementsMet && inspection.overallResult === "pass" ? formatDate(validUntil) : "Not roadworthy-valid"}</strong></div>
              <div><span>Station</span><strong>{location?.name || inspection.station || "Not recorded"}</strong></div>
            </div>
          </div>

          <div className="cert-verify-side">
            <p className="cert-mini-heading">Scan to Verify</p>
            <div className="cert-qr-frame"><QRCode value={verifyUrl} size={94} /></div>
            <strong className="cert-verification-code">{verificationCode}</strong>
            <p>Secure online certificate verification</p>
          </div>
        </section>

        <section className="cert-checklist-summary">
          <div className="cert-summary-head">
            <div>
              <p className="cert-mini-heading">Digital Checklist Compliance Matrix</p>
              <span>Each row is calculated from the item-level checklist stored in VIMS.</span>
            </div>
            <div className="cert-score-row">
              <Score label="Pass" value={totalPass} tone="pass" />
              <Score label="Fail" value={totalFail} tone="fail" />
              <Score label="N/A" value={totalNa} tone="neutral" />
              <Score label="Total" value={checklistItems.length} tone="total" />
            </div>
          </div>

          {sectionSummaries.length === 0 ? (
            <div className="cert-historical-note">
              <AlertTriangle />
              <p>Historical record: item-level checklist responses were not present in the source register, so VIMS has preserved only the recorded overall result.</p>
            </div>
          ) : (
            <div className="cert-section-matrix">
              {sectionSummaries.map((section) => <SectionStatus key={`${section.code}-${section.title}`} section={section} />)}
            </div>
          )}
        </section>

        <section className="cert-lower-grid">
          <div className="cert-defects-box">
            <p className="cert-mini-heading">Failed / Attention Items</p>
            {failedItems.length === 0 ? (
              <p className="cert-clear-note">No failed checklist items recorded.</p>
            ) : (
              <ul>
                {failedItems.slice(0, 4).map((item, index) => (
                  <li key={`${item.section}-${item.name}-${index}`}>
                    <strong>{item.section} · {item.name}</strong>
                    <span>{[item.severity && `${item.severity} defect`, item.remarks && compactText(item.remarks, 62)].filter(Boolean).join(" — ") || item.title}</span>
                  </li>
                ))}
              </ul>
            )}
            {failedItems.length > 4 && <small>+ {failedItems.length - 4} additional failed item(s) recorded in the VIMS inspection record.</small>}
          </div>

          <div className="cert-remarks-box">
            <p className="cert-mini-heading">Official Remarks</p>
            <p>{remarks}</p>
            <small>Full checklist, photos and detailed remarks remain available in the inspection record.</small>
          </div>
        </section>

        <section className="cert-authorization-row">
          <div className="cert-auth-fields">
            <Field label="Inspector" value={inspectorName} />
            <Field label="Inspection Address / Station" value={stationAddress} />
            <Field label="Workflow" value={inspection.workflowStatus.replaceAll("_", " ").toUpperCase()} />
            <Field label="Supervisor" value={supervisorName} />
          </div>
          <SignatureCard title="Inspector Signature" dataUrl={inspectorSignature} name={inspectorName} />
          <SignatureCard title="Supervisor Signature" dataUrl={supervisorSignature} name={supervisorName} />
        </section>

        <footer className="cert-footer">
          <ShieldCheck />
          <div>
            <strong>{settings.companyName}</strong>
            <p>{compactText(settings.certificateFooter || "Electronically generated controlled certificate. Scan the QR code to verify authenticity.", 150)}</p>
          </div>
          <span>One-page A4 controlled document</span>
        </footer>
      </article>
    </main>
  );
}

function ContactLine({ icon, value }: { icon: React.ReactNode; value: string }) {
  return <div className="cert-contact-line"><span>{icon}</span><p>{value}</p></div>;
}

function Field({ label, value, strong, mono }: { label: string; value: string; strong?: boolean; mono?: boolean }) {
  return (
    <div className="cert-field">
      <span>{label}</span>
      <strong className={`${strong ? "is-strong" : ""} ${mono ? "is-mono" : ""}`}>{value}</strong>
    </div>
  );
}

function ResultChoice({ label, active, tone }: { label: string; active: boolean; tone: "pass" | "fail" }) {
  return (
    <div className={`cert-result-choice ${tone} ${active ? "active" : ""}`}>
      <span className={`cert-result-check ${active ? "checked" : ""}`}>{active ? "✓" : ""}</span>
      <strong>{label}</strong>
    </div>
  );
}

function Score({ label, value, tone }: { label: string; value: number; tone: "pass" | "fail" | "neutral" | "total" }) {
  return <div className={`cert-score ${tone}`}><span>{label}</span><strong>{value}</strong></div>;
}

function SectionStatus({ section }: { section: SectionSummary }) {
  const symbol = section.status === "pass" ? "✓" : section.status === "fail" ? "×" : "—";
  return (
    <div className={`cert-section-status ${section.status}`}>
      <span className="cert-section-symbol">{symbol}</span>
      <div className="cert-section-name"><strong>{section.code} · {section.title}</strong></div>
      <div className="cert-section-counts"><span>P {section.pass}</span><span>F {section.fail}</span><span>N {section.na}</span></div>
    </div>
  );
}

function SignatureCard({ title, dataUrl, name }: { title: string; dataUrl: string | null; name: string }) {
  return (
    <div className="cert-signature-card">
      <span>{title}</span>
      <div className="cert-signature-image">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt={title} />
        ) : (
          <p>Not captured</p>
        )}
      </div>
      <strong>{name}</strong>
    </div>
  );
}

function compactText(value: string, max: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function certificateState(result: string, issued: boolean, expired: boolean): { label: string; tone: ResultTone; description: string } {
  if (!issued) return { label: "PENDING AUTHORIZATION", tone: "pending", description: "Approval or required digital signatures are outstanding." };
  if (expired) return { label: "EXPIRED", tone: "expired", description: "The inspection validity period has ended." };
  if (result === "pass") return { label: "PASS — ROADWORTHY", tone: "pass", description: "The vehicle met the recorded VIMS inspection requirements." };
  if (result === "conditional_pass") return { label: "CONDITIONAL PASS", tone: "conditional", description: "Corrective conditions apply to continued operation." };
  if (result === "reinspection_required") return { label: "RE-INSPECTION REQUIRED", tone: "conditional", description: "Corrective work and re-inspection are required." };
  return { label: "FAIL — NOT ROADWORTHY", tone: "fail", description: "The vehicle did not meet the recorded inspection requirements." };
}
