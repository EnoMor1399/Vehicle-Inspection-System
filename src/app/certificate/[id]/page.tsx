import "../certificate.css";
import { addMonths } from "date-fns";
import { db } from "@/db";
import {
  inspections,
  vehicles,
  signatures,
  transporters,
  locations,
  users,
  type InspectionSectionData,
} from "@/db/schema";
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
      .map((item) => ({
        section: section.section,
        title: section.title,
        name: item.name,
        severity: item.severity,
        remarks: item.remarks,
      })),
  );

  const signatureRequirementsMet = !settings.requireDigitalSignature
    || Boolean(
      (inspectorSig || inspection.inspectorSignature)
      && (!settings.requireSupervisorApproval || supervisorSig || inspection.supervisorSignature),
    );
  const approvalRequirementsMet = settings.requireSupervisorApproval
    ? inspection.workflowStatus === "approved"
    : ["completed", "approved"].includes(inspection.workflowStatus);
  const issuanceRequirementsMet = approvalRequirementsMet && signatureRequirementsMet;

  const validUntil = inspection.nextInspectionDate
    ? new Date(`${inspection.nextInspectionDate}T23:59:59`)
    : addMonths(new Date(inspection.inspectionDate), settings.certificateValidityMonths);
  const validityApplies = ["pass", "conditional_pass"].includes(inspection.overallResult);
  const expired = issuanceRequirementsMet && validityApplies && validUntil.getTime() < Date.now();

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
  // Prefer the host that served this request so a stale localhost environment value can never leak into a live QR code.
  const baseUrl = forwardedHost ? `${forwardedProto}://${forwardedHost}` : configuredBaseUrl;
  const verifyPath = `/verify/${inspection.id}?sig=${encodeURIComponent(signature)}`;
  const verifyUrl = baseUrl ? `${baseUrl}${verifyPath}` : verifyPath;

  const state = certificateState(inspection.overallResult, issuanceRequirementsMet, expired);
  const operatorName = transporter?.companyName || vehicle.ownerName || "Not recorded";
  const stationName = location?.name || inspection.station || "Not recorded";
  const stationAddress = location?.address || inspection.station || "Not recorded";
  const inspectorName = inspection.inspectorName || inspectorSig?.signerName || inspectorUser?.name || "Not recorded";
  const inspectorSignature = inspectorSig?.dataUrl || inspection.inspectorSignature || null;
  const supervisorSignature = supervisorSig?.dataUrl || inspection.supervisorSignature || null;
  const supervisorName = inspection.supervisorName
    || supervisorSig?.signerName
    || (settings.requireSupervisorApproval ? "Pending" : "Not required");
  const remarks = compactText(inspection.supervisorRemarks || inspection.inspectorRemarks || "No additional remarks recorded.", 210);
  const validityText = certificateValidityText(
    inspection.overallResult,
    issuanceRequirementsMet,
    expired,
    validUntil,
  );

  const measurements = [
    { label: "Service Brake Efficiency", value: percentReading(inspection.serviceBrakeEfficiency) },
    { label: "Parking Brake Efficiency", value: percentReading(inspection.parkingBrakeEfficiency) },
    { label: "Smoke Test", value: resultReading(inspection.smokeTest) },
    { label: "Noise Reading", value: plainReading(inspection.noiseLevel) },
    { label: "Exhaust Emission", value: plainReading(inspection.exhaustEmission) },
    { label: "Opacity Reading", value: plainReading(inspection.opacityTest) },
  ];

  return (
    <main className="certificate-screen">
      <CertificateToolbar
        inspectionId={inspection.id}
        vehicleRegistration={vehicle.registrationNumber}
        verifyUrl={verifyUrl}
      />

      <article className={`certificate-document certificate-state-${state.tone}`}>
        {!issuanceRequirementsMet && <div className="cert-watermark">PENDING AUTHORIZATION</div>}
        {expired && <div className="cert-watermark">EXPIRED</div>}

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
            <div className="cert-brand-copy">
              <h2>{settings.companyName}</h2>
              <p>{settings.tagline || "Vehicle Inspection Management System (VIMS)"}</p>
            </div>
          </div>
          <div className="cert-contact-list">
            {settings.address && (
              <ContactLine
                icon={<MapPin />}
                value={[settings.address, settings.city, settings.region].filter(Boolean).join(", ")}
              />
            )}
            {settings.phone && <ContactLine icon={<Phone />} value={settings.phone} />}
            {settings.email && <ContactLine icon={<Mail />} value={settings.email} />}
            {settings.website && <ContactLine icon={<Globe2 />} value={settings.website} />}
          </div>
        </header>

        <div className="cert-top-rule">
          <span />
          <p>Certificate No. <strong>{inspection.inspectionNumber}</strong></p>
        </div>

        <section className="cert-title-row">
          <div>
            <p className="cert-kicker">Controlled Vehicle Inspection Record</p>
            <h1>Vehicle Inspection Certificate</h1>
            <p className="cert-subtitle">
              Issued from the approved VIMS inspection record and independently verifiable online.
            </p>
          </div>
          <div className={`cert-state-chip ${state.tone}`}>
            <span>Certificate status</span>
            <strong>{state.label}</strong>
          </div>
        </section>

        <section className="cert-identity-section">
          <div className="cert-section-heading">
            <div>
              <p>Vehicle Identification</p>
              <span>Primary identifiers used to bind this certificate to the inspected vehicle.</span>
            </div>
            <strong className="cert-registration">{vehicle.registrationNumber}</strong>
          </div>
          <div className="cert-identity-grid">
            <Field label="Make / Model" value={`${vehicle.make} ${vehicle.model || ""}`.trim()} />
            <Field label="VIN / Chassis" value={vehicle.vin || vehicle.chassisNumber || "Not recorded"} mono />
            <Field label="Engine Number" value={vehicle.engineNumber || "Not recorded"} mono />
            <Field label="Year / Body Type" value={`${vehicle.manufacturingYear || "—"} · ${vehicle.bodyType || "Not recorded"}`} />
            <Field label="Class / Category" value={vehicle.vehicleClass || vehicle.category || "Not recorded"} />
            <Field label="Fuel / Axles" value={`${vehicle.fuelType || "Not recorded"} · ${vehicle.numberOfAxles ?? "—"} axle(s)`} />
            <Field label="Transporter / Owner" value={operatorName} />
            <Field label="Odometer" value={inspection.odometerReading ? `${inspection.odometerReading.toLocaleString()} km` : "Not recorded"} />
            <Field label="Inspection Type" value={inspection.templateType ? inspection.templateType.replaceAll("_", " ") : "Comprehensive vehicle inspection"} />
          </div>
        </section>

        <section className="cert-outcome-band">
          <div className="cert-outcome-main">
            <p className="cert-mini-heading">Certified Inspection Outcome</p>
            <div className={`cert-outcome-card ${state.tone}`}>
              <strong>{state.label}</strong>
              <p>{state.description}</p>
            </div>
            <p className="cert-certification-statement">
              This certificate records the inspection decision captured in VIMS for the vehicle identified above. Validity is subject to the recorded outcome, authorization status and online verification.
            </p>
            <div className="cert-outcome-meta">
              <Meta label="Inspection Date" value={formatDate(inspection.inspectionDate)} />
              <Meta label="Certificate Validity" value={validityText} />
              <Meta label="Inspection Station" value={stationName} />
              <Meta label="Workflow" value={inspection.workflowStatus.replaceAll("_", " ").toUpperCase()} />
            </div>
          </div>

          <aside className="cert-verify-panel">
            <p className="cert-mini-heading">Verify Authenticity</p>
            <div className="cert-qr-frame"><QRCode value={verifyUrl} size={92} /></div>
            <strong className="cert-verification-code">{verificationCode}</strong>
            <p>Scan the QR code or use the verification code to confirm the current VIMS record.</p>
          </aside>
        </section>

        <section className="cert-technical-section">
          <div className="cert-section-heading compact">
            <div>
              <p>Recorded Technical Measurements</p>
              <span>Values shown exactly as stored in the completed inspection record.</span>
            </div>
          </div>
          <div className="cert-measurement-grid">
            {measurements.map((measurement) => (
              <div className="cert-measurement" key={measurement.label}>
                <span>{measurement.label}</span>
                <strong>{measurement.value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="cert-checklist-summary">
          <div className="cert-summary-head">
            <div>
              <p className="cert-mini-heading">Checklist Compliance Summary</p>
              <span>Section status is calculated from the item-level responses stored in VIMS.</span>
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
              <p>Historical record: item-level checklist responses were not present in the source register. VIMS therefore preserves the recorded overall result without inventing checklist answers.</p>
            </div>
          ) : (
            <div className="cert-section-matrix">
              {sectionSummaries.map((section) => (
                <SectionStatus key={`${section.code}-${section.title}`} section={section} />
              ))}
            </div>
          )}
        </section>

        <section className="cert-lower-grid">
          <div className="cert-defects-box">
            <p className="cert-mini-heading">Defects / Attention Items</p>
            {failedItems.length === 0 ? (
              <p className="cert-clear-note">No failed checklist items were recorded.</p>
            ) : (
              <ul>
                {failedItems.slice(0, 3).map((item, index) => (
                  <li key={`${item.section}-${item.name}-${index}`}>
                    <strong>{item.section} · {item.name}</strong>
                    <span>{[item.severity && `${item.severity} defect`, item.remarks && compactText(item.remarks, 74)].filter(Boolean).join(" — ") || item.title}</span>
                  </li>
                ))}
              </ul>
            )}
            {failedItems.length > 3 && (
              <small>+ {failedItems.length - 3} additional failed item(s). Scan the QR code for the complete inspection record.</small>
            )}
          </div>

          <div className="cert-remarks-box">
            <p className="cert-mini-heading">Official Remarks / Conditions</p>
            <p>{remarks}</p>
            <small>Detailed checklist evidence, photographs and supporting records remain in VIMS.</small>
          </div>
        </section>

        <section className="cert-authorization-row">
          <div className="cert-auth-summary">
            <Field label="Inspector" value={inspectorName} />
            <Field label="Station / Address" value={stationAddress} />
            <Field label="Supervisor" value={supervisorName} />
          </div>
          <SignatureCard
            title="Inspector Authorization"
            dataUrl={inspectorSignature}
            name={inspectorName}
            signedAt={inspectorSig?.signedAt || null}
          />
          <SignatureCard
            title={settings.requireSupervisorApproval ? "Supervisor Authorization" : "Supervisor Authorization (Optional)"}
            dataUrl={supervisorSignature}
            name={supervisorName}
            signedAt={supervisorSig?.signedAt || null}
          />
        </section>

        <footer className="cert-footer">
          <ShieldCheck />
          <div>
            <strong>{settings.companyName}</strong>
            <p>{compactText(settings.certificateFooter || "Electronically generated controlled certificate. Scan the QR code to verify authenticity and current status.", 175)}</p>
          </div>
          <div className="cert-footer-control">
            <span>Verification code</span>
            <strong>{verificationCode}</strong>
          </div>
        </footer>
      </article>
    </main>
  );
}

function ContactLine({ icon, value }: { icon: React.ReactNode; value: string }) {
  return <div className="cert-contact-line"><span>{icon}</span><p>{value}</p></div>;
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="cert-field">
      <span>{label}</span>
      <strong className={mono ? "is-mono" : ""}>{value}</strong>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div className="cert-meta"><span>{label}</span><strong>{value}</strong></div>;
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

function SignatureCard({
  title,
  dataUrl,
  name,
  signedAt,
}: {
  title: string;
  dataUrl: string | null;
  name: string;
  signedAt: Date | string | null;
}) {
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
      <small>{signedAt ? `Signed ${formatDate(signedAt)}` : "Signature date not recorded"}</small>
    </div>
  );
}

function compactText(value: string, max: number): string {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function plainReading(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not recorded";
  return String(value);
}

function percentReading(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not recorded";
  return `${value}%`;
}

function resultReading(value: string | null): string {
  if (!value) return "Not recorded";
  return value.replaceAll("_", " ").toUpperCase();
}

function certificateValidityText(
  result: string,
  issued: boolean,
  expired: boolean,
  validUntil: Date,
): string {
  if (!issued) return "Pending authorization";
  if (["fail", "reinspection_required"].includes(result)) return "No valid certification";
  if (expired) return `Expired ${formatDate(validUntil)}`;
  if (result === "conditional_pass") return `Conditional through ${formatDate(validUntil)}`;
  return `Valid through ${formatDate(validUntil)}`;
}

function certificateState(
  result: string,
  issued: boolean,
  expired: boolean,
): { label: string; tone: ResultTone; description: string } {
  if (!issued) {
    return {
      label: "PENDING AUTHORIZATION",
      tone: "pending",
      description: "Required approval or digital authorization is still outstanding; this document is not yet an issued certificate.",
    };
  }
  if (result === "fail") {
    return {
      label: "FAIL",
      tone: "fail",
      description: "The vehicle did not meet the recorded inspection requirements. Corrective action is required before certification.",
    };
  }
  if (result === "reinspection_required") {
    return {
      label: "RE-INSPECTION REQUIRED",
      tone: "fail",
      description: "Corrective work and a subsequent inspection are required before a valid certification can be issued.",
    };
  }
  if (expired) {
    return {
      label: "EXPIRED",
      tone: "expired",
      description: "The recorded certificate validity period has ended. A current inspection is required to restore certification.",
    };
  }
  if (result === "conditional_pass") {
    return {
      label: "CONDITIONAL PASS",
      tone: "conditional",
      description: "The vehicle passed subject to the recorded remarks or corrective conditions. Review the conditions before continued operation.",
    };
  }
  if (result === "pass") {
    return {
      label: "PASS / CERTIFIED",
      tone: "pass",
      description: "The vehicle met the inspection requirements recorded in VIMS for this inspection.",
    };
  }
  return {
    label: result.replaceAll("_", " ").toUpperCase(),
    tone: "pending",
    description: "Recorded VIMS inspection outcome.",
  };
}
