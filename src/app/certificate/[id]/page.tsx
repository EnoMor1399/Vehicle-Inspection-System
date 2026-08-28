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
import { formatDateTime, formatDate } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  Globe2,
  Mail,
  MapPin,
  Minus,
  Phone,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { CertificateToolbar } from "../CertificateToolbar";
import { certificateVerificationCode, createCertificateSignature } from "@/lib/certificate-security";

export const dynamic = "force-dynamic";

type ResultTone = "pass" | "conditional" | "fail" | "pending" | "expired";

type ChecklistItem = InspectionSectionData["items"][number];

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

  return (
    <main className="certificate-screen">
      <CertificateToolbar
        inspectionId={inspection.id}
        vehicleRegistration={vehicle.registrationNumber}
        verifyUrl={verifyUrl}
      />

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
          <p>Digitally generated from the approved VIMS inspection checklist and verification record.</p>
        </section>

        <SectionLabel>Vehicle Operator / Transporter Details</SectionLabel>
        <section className="cert-form-grid cert-operator-grid">
          <Field label="Full Name / Contact Person" value={operatorName} />
          <Field label="Email Address" value={operatorEmail} />
          <Field label="Phone Number" value={operatorPhone} />
          <Field label="Inspection Date" value={formatDate(inspection.inspectionDate)} />
          <Field label="Operator Signature" value="Not captured in technical inspection record" muted />
        </section>

        <SectionLabel>Vehicle & Inspection Identification</SectionLabel>
        <section className="cert-form-grid cert-vehicle-grid">
          <Field label="Company / Transporter" value={transporter?.companyName || vehicle.ownerName || "Not recorded"} />
          <Field label="Vehicle Mileage" value={inspection.odometerReading ? `${inspection.odometerReading.toLocaleString()} km` : "Not recorded"} />
          <Field label="License Plate / Registration" value={vehicle.registrationNumber} strong />
          <Field label="VIN" value={vehicle.vin || "Not recorded"} mono />
          <Field label="Vehicle Make" value={vehicle.make} />
          <Field label="Vehicle Model" value={vehicle.model || "Not recorded"} />
          <Field label="Model Year" value={vehicle.manufacturingYear ? String(vehicle.manufacturingYear) : "Not recorded"} />
          <Field label="Vehicle Class" value={vehicle.vehicleClass || vehicle.category || "Not recorded"} />
        </section>

        <section className="cert-result-panel">
          <div className="cert-result-side">
            <p className="cert-result-heading">Vehicle Inspection Result</p>
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
              <div><span>Inspection date</span><strong>{formatDate(inspection.inspectionDate)}</strong></div>
              <div><span>Validity</span><strong>{issuanceRequirementsMet && inspection.overallResult === "pass" ? `Until ${formatDate(validUntil)}` : "Not roadworthiness-valid"}</strong></div>
            </div>
          </div>

          <div className="cert-verify-side">
            <p className="cert-result-heading">Verification QR Code</p>
            <div className="cert-qr-frame">
              <QRCode value={verifyUrl} size={132} />
            </div>
            <strong className="cert-verification-code">{verificationCode}</strong>
            <p>Scan to verify this certificate against the live VIMS record and cryptographic signature.</p>
          </div>
        </section>

        <SectionLabel>Inspector Authorization</SectionLabel>
        <section className="cert-inspector-grid">
          <div className="cert-inspector-fields">
            <Field label="Inspector Name" value={inspectorName} />
            <Field label="Inspection Address / Station" value={stationAddress} />
            <Field label="Workflow Status" value={inspection.workflowStatus.replaceAll("_", " ").toUpperCase()} />
            <Field label="Supervisor" value={inspection.supervisorName || supervisorSig?.signerName || (settings.requireSupervisorApproval ? "Pending" : "Not required")} />
          </div>
          <SignatureCard title="Inspector Digital Signature" dataUrl={inspectorSignature} name={inspectorName} />
          <SignatureCard
            title="Supervisor Digital Signature"
            dataUrl={supervisorSignature}
            name={inspection.supervisorName || supervisorSig?.signerName || "Not recorded"}
          />
        </section>

        <section className="cert-checklist-area">
          <div className="cert-checklist-title">
            <div>
              <p>Digital Checklist Appendix</p>
              <h2>Inspection Checklist — Digitally Checked</h2>
            </div>
            <div className="cert-score-row">
              <Score label="Pass" value={totalPass} tone="pass" />
              <Score label="Fail" value={totalFail} tone="fail" />
              <Score label="N/A" value={totalNa} tone="neutral" />
              <Score label="Total" value={checklistItems.length} tone="total" />
            </div>
          </div>

          {sections.length === 0 ? (
            <div className="cert-historical-note">
              <AlertTriangle />
              <div>
                <strong>Historical inspection record</strong>
                <p>
                  The source record contains an overall result but no item-level checklist responses. VIMS has preserved the historical outcome without inventing digital checklist answers.
                </p>
              </div>
            </div>
          ) : (
            <div className="cert-checklist-columns">
              {sections.map((section) => (
                <ChecklistSection key={`${section.section}-${section.title}`} section={section} />
              ))}
            </div>
          )}
        </section>

        {(inspection.inspectorRemarks || inspection.supervisorRemarks) && (
          <section className="cert-remarks">
            <SectionLabel>Official Remarks</SectionLabel>
            {inspection.inspectorRemarks && <p><strong>Inspector:</strong> {inspection.inspectorRemarks}</p>}
            {inspection.supervisorRemarks && <p><strong>Supervisor:</strong> {inspection.supervisorRemarks}</p>}
          </section>
        )}

        <footer className="cert-footer">
          <ShieldCheck />
          <div>
            <strong>{settings.companyName}</strong>
            <p>{settings.certificateFooter || "This is an electronically generated controlled certificate. Scan the QR code to verify authenticity."}</p>
          </div>
          <span>Committed to safety. Driven by integrity.</span>
        </footer>
      </article>
    </main>
  );
}

function ContactLine({ icon, value }: { icon: React.ReactNode; value: string }) {
  return <div className="cert-contact-line"><span>{icon}</span><p>{value}</p></div>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="cert-section-label"><span>{children}</span></div>;
}

function Field({ label, value, strong, mono, muted }: { label: string; value: string; strong?: boolean; mono?: boolean; muted?: boolean }) {
  return (
    <div className={`cert-field ${muted ? "is-muted" : ""}`}>
      <span>{label}</span>
      <strong className={`${strong ? "is-strong" : ""} ${mono ? "is-mono" : ""}`}>{value}</strong>
    </div>
  );
}

function ResultChoice({ label, active, tone }: { label: string; active: boolean; tone: "pass" | "fail" }) {
  return (
    <div className={`cert-result-choice ${tone} ${active ? "active" : ""}`}>
      <DigitalCheck active={active} tone={tone} />
      <strong>{label}</strong>
    </div>
  );
}

function DigitalCheck({ active, tone = "neutral", na = false }: { active: boolean; tone?: "pass" | "fail" | "neutral"; na?: boolean }) {
  return (
    <span className={`cert-digital-check ${active ? `checked ${tone}` : ""}`} aria-label={active ? "Checked" : "Not checked"}>
      {active ? (na ? <Minus /> : "✓") : ""}
    </span>
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

function Score({ label, value, tone }: { label: string; value: number; tone: "pass" | "fail" | "neutral" | "total" }) {
  return <div className={`cert-score ${tone}`}><span>{label}</span><strong>{value}</strong></div>;
}

function ChecklistSection({ section }: { section: InspectionSectionData }) {
  const items = section.items || [];
  const pass = items.filter((item) => item.result === "pass").length;
  const fail = items.filter((item) => item.result === "fail").length;

  return (
    <section className="cert-checklist-section">
      <header>
        <div><span>SECTION {section.section}</span><strong>{section.title}</strong></div>
        <small>{pass} pass · {fail} fail</small>
      </header>
      <div className="cert-checklist-table">
        <div className="cert-checklist-row cert-checklist-head">
          <span>Inspection point</span><span>Pass</span><span>Fail</span><span>N/A</span>
        </div>
        {items.map((item, index) => <ChecklistRow key={`${item.name}-${index}`} item={item} />)}
      </div>
    </section>
  );
}

function ChecklistRow({ item }: { item: ChecklistItem }) {
  return (
    <div className="cert-checklist-row">
      <div className="cert-item-name">
        <strong>{item.name}</strong>
        {item.remarks && <small>{item.remarks}</small>}
        {item.result === "fail" && item.severity && <em>{item.severity} defect</em>}
      </div>
      <DigitalCheck active={item.result === "pass"} tone="pass" />
      <DigitalCheck active={item.result === "fail"} tone="fail" />
      <DigitalCheck active={item.result === "na"} tone="neutral" na />
    </div>
  );
}

function certificateState(result: string, issued: boolean, expired: boolean): { label: string; tone: ResultTone; description: string } {
  if (!issued) return { label: "PENDING AUTHORIZATION", tone: "pending", description: "Approval or required digital signatures are outstanding." };
  if (expired) return { label: "EXPIRED", tone: "expired", description: "The inspection validity period has ended." };
  if (result === "pass") return { label: "PASS — ROADWORTHY", tone: "pass", description: "The vehicle met the recorded VIMS inspection requirements." };
  if (result === "conditional_pass") return { label: "CONDITIONAL PASS", tone: "conditional", description: "Corrective conditions apply to continued operation." };
  if (result === "reinspection_required") return { label: "RE-INSPECTION REQUIRED", tone: "conditional", description: "Corrective work and re-inspection are required." };
  return { label: "FAIL — NOT ROADWORTHY", tone: "fail", description: "The vehicle did not meet the recorded inspection requirements." };
}
