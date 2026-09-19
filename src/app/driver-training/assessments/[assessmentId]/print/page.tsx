import Image from "next/image";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { trainingAssessments, trainingParticipants, trainingSessions } from "@/db/training-schema";
import { requireInternalUser } from "@/lib/require-auth";
import { canViewTraining } from "@/lib/training-access";
import AutoPrint from "./AutoPrint";

export const dynamic = "force-dynamic";

type LegacyCriterion = { no: number; label: string; weight: number; ratingId: string };
type LegacySection = { code: string; title: string; criteria: readonly LegacyCriterion[] };

const LEFT_SECTIONS: readonly LegacySection[] = [
  { code: "A", title: "Starting and Stopping", criteria: [
    { no: 1, label: "Checks right, left and rear before starting", weight: 1, ratingId: "mirror_use" },
    { no: 2, label: "Gearing up and down with ease and not aggressively (rough use)", weight: 2, ratingId: "gear_selection" },
    { no: 3, label: "Lifting foot of the clutch and not slipping the clutch", weight: 2, ratingId: "clutch_control" },
    { no: 4, label: "Applies brakes early and smoothly", weight: 3, ratingId: "progressive_braking" },
    { no: 5, label: "Stops well behind other vehicles in front", weight: 3, ratingId: "stopping_distance" },
    { no: 6, label: "Comes to a complete stop at stop signs and red traffic lights", weight: 2, ratingId: "traffic_lights_signals" },
    { no: 7, label: "Anticipates need to stop well in advance", weight: 3, ratingId: "hazard_approach_speed" },
  ]},
  { code: "B", title: "General Driving", criteria: [
    { no: 8, label: "Maintains a safe following distance (4 second rule)", weight: 4, ratingId: "following_distance" },
    { no: 9, label: "Allows adequate space cushion around the vehicle", weight: 4, ratingId: "safe_clearance" },
    { no: 10, label: "Yields to oncoming traffic", weight: 2, ratingId: "right_of_way" },
    { no: 11, label: "Controls and maintains a safe speed", weight: 3, ratingId: "appropriate_speed" },
    { no: 12, label: "Checking all mirrors frequently and according to traffic", weight: 4, ratingId: "mirror_use" },
    { no: 13, label: "Uses horn when appropriate and in good time", weight: 3, ratingId: "horn_use" },
    { no: 14, label: "Uses indicators when changing lanes", weight: 2, ratingId: "indicator_use" },
    { no: 15, label: "Maintains a firm grip on the steering wheel", weight: 2, ratingId: "steering_control" },
    { no: 16, label: "Centres well in lane", weight: 2, ratingId: "lane_position" },
    { no: 17, label: "Maintaining a good engine RPM and not over revving or over-loading the engine", weight: 2, ratingId: "engine_revving" },
  ]},
  { code: "C", title: "Passing or overtaking", criteria: [
    { no: 18, label: "Anticipates ahead and has adequate visibility ahead", weight: 2, ratingId: "advance_planning" },
    { no: 19, label: "Does not obstruct oncoming vehicles or cyclists", weight: 2, ratingId: "overtake_conditions" },
    { no: 20, label: "Uses indicators and mirrors", weight: 2, ratingId: "manoeuvre_mirrors" },
    { no: 21, label: "Does not cut back too soon", weight: 1, ratingId: "safe_lane_return" },
  ]},
] as const;

const RIGHT_SECTIONS: readonly LegacySection[] = [
  { code: "D", title: "Observation and Anticipation", criteria: [
    { no: 22, label: "All round observation (keeping their eyes moving)", weight: 5, ratingId: "continuous_scanning" },
    { no: 23, label: "Scans the road well ahead and looking for changing road and weather conditions", weight: 3, ratingId: "changing_conditions" },
    { no: 24, label: "Alert for pedestrians including children and animals", weight: 3, ratingId: "vulnerable_road_users" },
    { no: 25, label: "Alert for vehicles leaving parking space or pulling out", weight: 3, ratingId: "anticipates_road_users" },
    { no: 26, label: "Identifying Potential Hazards and anticipating well in advance", weight: 5, ratingId: "early_hazard_identification" },
  ]},
  { code: "E", title: "Approaching junctions, turning and exiting", criteria: [
    { no: 27, label: "Observes right-of-way rules", weight: 2, ratingId: "right_of_way" },
    { no: 28, label: "Gives proper signals well in advance", weight: 2, ratingId: "timely_signalling" },
    { no: 29, label: "Gets into lane well ahead of turning or exit point", weight: 2, ratingId: "pre_manoeuvre_position" },
    { no: 30, label: "Adjusts speed to avoid collision should side street or oncoming driver fail to stop", weight: 3, ratingId: "hazard_response" },
    { no: 31, label: "Checks vehicles behind when braking", weight: 3, ratingId: "mirror_use" },
    { no: 32, label: "Makes turn from the correct lane", weight: 2, ratingId: "lane_discipline" },
    { no: 33, label: "Turns slowly enough to be safe and steers smoothly", weight: 2, ratingId: "bends_corners" },
    { no: 34, label: "Observes vehicle or trailer articulation while cornering", weight: 2, ratingId: "vehicle_dimensions" },
  ]},
  { code: "F", title: "Reversing", criteria: [
    { no: 35, label: "Checks obstructions and areas of space", weight: 2, ratingId: "manoeuvre_blind_spots" },
    { no: 36, label: "Manoeuvring skills", weight: 2, ratingId: "low_speed_control" },
    { no: 37, label: "Reversing speed", weight: 1, ratingId: "reversing" },
  ]},
  { code: "G", title: "General road behaviour", criteria: [
    { no: 38, label: "Tolerant of bad driving and habits of other road users", weight: 3, ratingId: "courtesy_patience" },
    { no: 39, label: "Confident, calm and relaxed", weight: 2, ratingId: "calm_under_pressure" },
    { no: 40, label: "Checks if others in the vehicle are belted up", weight: 2, ratingId: "seatbelt_use" },
  ]},
] as const;

const ALL_CRITERIA = [...LEFT_SECTIONS, ...RIGHT_SECTIONS].flatMap((section) => section.criteria);
const LEGACY_MAX_SCORE = ALL_CRITERIA.reduce((sum, item) => sum + item.weight, 0);

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function formatPercent(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${numeric.toFixed(numeric % 1 === 0 ? 0 : 1)}%` : "—";
}

function awardFor(weight: number, rating: number | null | undefined) {
  if (typeof rating !== "number" || rating < 1 || rating > 5) return null;
  return Math.round((weight * rating / 5) * 10) / 10;
}

function displayAward(value: number | null) {
  if (value === null) return "";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

async function getUserSummary(id?: string | null) {
  if (!id) return null;
  const [record] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, id)).limit(1);
  return record || null;
}

export default async function LegacyDriverAssessmentPrintPage({ params }: { params: Promise<{ assessmentId: string }> }) {
  const user = await requireInternalUser();
  if (!canViewTraining(user)) return <div className="p-8 text-sm text-slate-600">You do not have access to Driver Training & Assessment Services.</div>;

  const { assessmentId } = await params;
  const [assessment] = await db.select().from(trainingAssessments).where(eq(trainingAssessments.id, assessmentId)).limit(1);
  if (!assessment) notFound();

  const [[participant], [session], assessor, reviewer] = await Promise.all([
    db.select().from(trainingParticipants).where(eq(trainingParticipants.id, assessment.participantId)).limit(1),
    db.select().from(trainingSessions).where(eq(trainingSessions.id, assessment.sessionId)).limit(1),
    getUserSummary(assessment.assessorId),
    getUserSummary(assessment.reviewerId),
  ]);
  if (!participant || !session) notFound();

  const ratings = assessment.criteriaRatings || {};
  const critical = new Set(Array.isArray(assessment.criticalViolations) ? assessment.criticalViolations : []);
  const weightedAward = ALL_CRITERIA.reduce((sum, item) => sum + (awardFor(item.weight, ratings[item.ratingId]) || 0), 0);
  const hasAnyMappedRating = ALL_CRITERIA.some((item) => typeof ratings[item.ratingId] === "number");
  const totalAward = hasAnyMappedRating ? Math.round(weightedAward * 10) / 10 : null;
  const recommended = assessment.result === "competent" || assessment.result === "pass";

  const beltDisqualification = critical.has("seatbelt_violation");
  const accidentDisqualification = critical.has("preventable_collision") || critical.has("loss_of_control");
  const mobileDisqualification = critical.has("mobile_phone_use");
  const regulationDisqualification = ["dangerous_speeding", "ignored_traffic_signal", "unsafe_overtaking", "failure_to_yield", "failure_to_stop", "dangerous_following", "reckless_aggressive", "vulnerable_user_violation"].some((id) => critical.has(id));

  const additionalComments = assessment.remarks || assessment.qualitativeFeedback?.trainerComments || assessment.reviewComments || assessment.driverComments || "";

  return (
    <main className="legacy-print-page">
      <style>{PRINT_CSS}</style>
      <AutoPrint />
      <section className="legacy-a4-form" aria-label="Driver assessment A4 print form">
        <div className="top-black-band" />
        <div className="meta-grid">
          <table className="meta-table" aria-label="Driver information"><tbody>
            <MetaRow label="Name:" value={participant.fullName} />
            <tr><th>Sex:</th><td>—</td><th className="small-label">Age:</th><td className="small-value">—</td></tr>
            <MetaRow label="Company:" value={participant.companyName || "—"} />
            <MetaRow label="Assess. Type:" value={assessment.assessmentType.replaceAll("_", " ")} />
            <MetaRow label="Vehicle used:" value="—" />
          </tbody></table>
          <table className="meta-table" aria-label="Test and licence information"><tbody>
            <MetaRow label="Test Date:" value={formatDate(assessment.assessedAt)} />
            <MetaRow label="Weather:" value="—" />
            <tr><th>CoC</th><td>{participant.driverLicenseNumber || "—"}</td><th className="small-label">Lic C.</th><td className="small-value">{participant.driverLicenseClass || "—"}</td></tr>
            <MetaRow label="Date of Issue:" value="—" />
            <MetaRow label="Expiry Date:" value={participant.driverLicenseExpiry || "—"} />
          </tbody></table>
        </div>

        <div className="criteria-grid">
          <CriteriaTable sections={LEFT_SECTIONS} ratings={ratings} showHeader />
          <CriteriaTable sections={RIGHT_SECTIONS} ratings={ratings} showHeader showTotal totalAward={totalAward} />
        </div>

        <div className="bottom-grid">
          <div className="bottom-left">
            <table className="recommendation-table"><tbody>
              <tr><th>Recommended to Drive</th><td>{recommended ? "✓" : ""}</td></tr>
              <tr><th>Not Recommended to Drive</th><td>{recommended ? "" : "✓"}</td></tr>
            </tbody></table>

            <div className="performance-box">
              <div className="performance-title">Detailed Performance</div>
              <table><tbody>
                <tr><th>Theory /100</th><td>{formatPercent(assessment.theoryScore)}</td></tr>
                <tr><th>Road Signs /100</th><td>{formatPercent(assessment.roadSignScore)}</td></tr>
                <tr><th>Assessment /100</th><td>{formatPercent(assessment.practicalScore)}</td></tr>
                <tr><th>Total /100</th><td>{formatPercent(assessment.overallScore)}</td></tr>
              </tbody></table>
            </div>

            <div className="comments-box"><div className="box-heading">Additional Comments</div><div className="comments-text">{additionalComments}</div></div>
          </div>

          <div className="bottom-right">
            <table className="disqualification-table"><thead><tr><th colSpan={2}>Mandatory Disqualification</th></tr></thead><tbody>
              <DisqualificationRow label="Fails to belt up during Assessment" active={beltDisqualification} />
              <DisqualificationRow label="Occurrence of Accident or Near Miss" active={accidentDisqualification} />
              <DisqualificationRow label="Unjustifiable Violation of Regulations" active={regulationDisqualification} />
              <DisqualificationRow label="Use of Mobile Phone while Driving" active={mobileDisqualification} />
            </tbody></table>

            <table className="grading-table" aria-label="Assessment grading scale"><tbody>
              <tr><td>0 - 60%</td><th>FAIL</th></tr>
              <tr><td>61 - 74%</td><th>POOR PASS</th></tr>
              <tr><td>75 - 80%</td><th>FAIR PASS</th></tr>
              <tr><td>81 - 90%</td><th>GOOD PASS</th></tr>
              <tr><td>91 - 100%</td><th>V GOOD PASS</th></tr>
            </tbody></table>

            <div className="assessor-name-block"><div className="signature-rule" /><div>Name of Assessor</div><strong>{assessor?.name || "—"}</strong>{reviewer?.name ? <small>Reviewed by: {reviewer.name}</small> : null}</div>
          </div>
        </div>

        <div className="company-footer">Road Safety Limited. PMB, Tema. Email: info@rslghana.com Tel: +233 (0) 303 976 777</div>
        <div className="signature-footer">
          <div>
            <strong>Assessor Sign:</strong>
            <span className="signature-slot">
              {assessment.assessorSignature ? <Image src={assessment.assessorSignature} alt="Assessor digital signature" width={400} height={120} unoptimized /> : null}
            </span>
          </div>
          <div>
            <strong>Mgr Sign:</strong>
            <span className="signature-slot">
              {assessment.reviewerSignature ? <Image src={assessment.reviewerSignature} alt="Reviewer digital signature" width={400} height={120} unoptimized /> : null}
            </span>
          </div>
        </div>
        <div className="system-footnote">VIMS assessment record {session.referenceNumber} · Total Performance = (Theory + Road Signs + Assessment Performance) ÷ 3.</div>
      </section>
    </main>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) { return <tr><th>{label}</th><td colSpan={3}>{value}</td></tr>; }

function CriteriaTable({ sections, ratings, showHeader, showTotal = false, totalAward = null }: { sections: readonly LegacySection[]; ratings: Record<string, number>; showHeader?: boolean; showTotal?: boolean; totalAward?: number | null }) {
  return <table className="criteria-table">{showHeader ? <thead><tr><th className="no-col">No.</th><th>Criteria observed</th><th className="score-col">Score</th><th className="award-col">Award</th></tr></thead> : null}<tbody>{sections.map((section) => <SectionRows key={section.code} section={section} ratings={ratings} />)}{showTotal ? <tr className="total-row"><th colSpan={2}>TOTAL %</th><th>{LEGACY_MAX_SCORE}</th><th>{displayAward(totalAward)}</th></tr> : null}</tbody></table>;
}

function SectionRows({ section, ratings }: { section: LegacySection; ratings: Record<string, number> }) {
  return <><tr className="section-row"><th colSpan={4}>{section.code} - {section.title}</th></tr>{section.criteria.map((item) => <tr key={item.no} className="criterion-row"><td className="criterion-no">{item.no}</td><td>{item.label}</td><td className="numeric-cell">{item.weight}</td><td className="numeric-cell award-cell">{displayAward(awardFor(item.weight, ratings[item.ratingId]))}</td></tr>)}</>;
}

function DisqualificationRow({ label, active }: { label: string; active: boolean }) { return <tr><th>{label}</th><td>{active ? "X" : ""}</td></tr>; }

const PRINT_CSS = `
  :root { color-scheme: light; }
  .legacy-print-page { min-height: 100vh; background: #e5e7eb; padding: 24px; color: #000; font-family: Arial, Helvetica, sans-serif; }
  .legacy-a4-form { width: 194mm; min-height: 281mm; margin: 0 auto; background: #fff; color: #000; padding: 0 3mm 2mm; box-sizing: border-box; box-shadow: 0 10px 35px rgba(0,0,0,.16); font-family: Arial, Helvetica, sans-serif; font-size: 7.1pt; line-height: 1.08; }
  .top-black-band { height: 8.5mm; margin: 0 5mm; background: #000; }
  .meta-grid, .criteria-grid, .bottom-grid { display: grid; grid-template-columns: 1fr 1.03fr; gap: 2.6mm; }
  .meta-grid { margin-top: 0; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; }
  .meta-table { border: .35mm solid #000; border-bottom: 0; font-size: 7pt; }
  .meta-table th, .meta-table td { border: .25mm solid #000; height: 5.3mm; padding: .45mm .8mm; vertical-align: middle; }
  .meta-table th { width: 23%; text-align: right; font-weight: 800; white-space: nowrap; }
  .meta-table td { font-weight: 600; }
  .meta-table .small-label { width: 12%; }
  .meta-table .small-value { width: 13%; text-align: center; }
  .criteria-grid { gap: 2.6mm; align-items: start; }
  .criteria-table { border: .35mm solid #000; font-size: 6.65pt; }
  .criteria-table th, .criteria-table td { border: .22mm solid #000; padding: .3mm .55mm; vertical-align: middle; }
  .criteria-table thead th { height: 4.6mm; text-align: center; font-weight: 800; }
  .criteria-table .no-col { width: 7%; }
  .criteria-table .score-col { width: 10.5%; }
  .criteria-table .award-col { width: 11.5%; }
  .criteria-table .section-row th { height: 4.6mm; text-align: left; font-size: 7.5pt; font-weight: 900; padding: .45mm .65mm; }
  .criteria-table .criterion-row td { min-height: 3.75mm; height: 3.75mm; }
  .criterion-no, .numeric-cell { text-align: center; font-weight: 700; }
  .award-cell { font-weight: 900; }
  .total-row th { height: 5mm; text-align: center; font-size: 8.3pt; font-weight: 900; }
  .total-row th:first-child { text-align: right; padding-right: 1.2mm; }
  .bottom-grid { margin-top: 2.1mm; gap: 6mm; grid-template-columns: 1.13fr .87fr; align-items: start; }
  .recommendation-table { border: .35mm solid #000; font-size: 8.2pt; }
  .recommendation-table th, .recommendation-table td { border: .25mm solid #000; height: 5.2mm; }
  .recommendation-table th { text-align: center; font-weight: 900; }
  .recommendation-table td { width: 12%; text-align: center; font-size: 11pt; font-weight: 900; }
  .performance-box { display: grid; grid-template-columns: 1fr 31mm; border: .35mm solid #000; border-top: 0; min-height: 24mm; }
  .performance-title { display: flex; align-items: center; justify-content: center; font-size: 9pt; font-weight: 900; border-right: .25mm solid #000; }
  .performance-box table th, .performance-box table td { border-bottom: .25mm solid #000; height: 5.6mm; padding: .2mm .7mm; font-size: 8pt; }
  .performance-box table tr:last-child th, .performance-box table tr:last-child td { border-bottom: 0; }
  .performance-box table th { text-align: right; font-weight: 700; }
  .performance-box table td { width: 11mm; text-align: center; font-weight: 800; border-left: .25mm solid #000; }
  .comments-box { border: .35mm solid #000; border-top: 0; height: 31mm; }
  .box-heading { height: 5.2mm; display: flex; align-items: center; justify-content: center; border-bottom: .25mm solid #000; background: #f1f1f1; font-size: 8.2pt; font-weight: 800; }
  .comments-text { padding: 1.2mm; font-size: 7pt; white-space: pre-wrap; overflow: hidden; max-height: 24mm; }
  .disqualification-table { border: .35mm solid #000; font-size: 7.2pt; }
  .disqualification-table thead th { height: 5.2mm; font-size: 8pt; text-align: center; font-weight: 900; }
  .disqualification-table tbody th, .disqualification-table tbody td { border: .25mm solid #000; height: 5.2mm; }
  .disqualification-table tbody th { text-align: center; font-weight: 700; }
  .disqualification-table tbody td { width: 12%; text-align: center; font-size: 9pt; font-weight: 900; }
  .grading-table { margin-top: 2.2mm; border: .35mm solid #000; font-size: 7.7pt; }
  .grading-table td, .grading-table th { border-bottom: .25mm solid #000; height: 5.2mm; padding: .2mm .7mm; }
  .grading-table tr:last-child td, .grading-table tr:last-child th { border-bottom: 0; }
  .grading-table td { width: 48%; text-align: right; font-weight: 800; }
  .grading-table th { text-align: left; font-weight: 900; }
  .assessor-name-block { margin-top: 8mm; text-align: center; font-size: 8.5pt; }
  .signature-rule { width: 75%; border-top: .35mm solid #000; margin: 0 auto 1.5mm; }
  .assessor-name-block strong { display: block; margin-top: 1.3mm; font-size: 7.4pt; }
  .assessor-name-block small { display: block; margin-top: .6mm; font-size: 6.2pt; }
  .company-footer { margin-top: 2.5mm; text-align: center; font-size: 8pt; font-weight: 700; }
  .signature-footer { display: grid; grid-template-columns: 1fr 1fr; gap: 12mm; margin-top: 5mm; font-size: 8pt; }
  .signature-footer > div { display: flex; align-items: end; gap: 1.2mm; }
  .signature-slot { flex: 1; display: flex; align-items: end; justify-content: center; border-bottom: .35mm solid #000; height: 7mm; overflow: hidden; }
  .signature-slot img { width: 34mm; height: 6.5mm; object-fit: contain; }
  .system-footnote { margin-top: 2.2mm; text-align: center; font-size: 5.5pt; color: #333; }
  @page { size: A4 portrait; margin: 8mm; }
  @media print {
    html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; color: #000 !important; }
    body * { visibility: hidden !important; }
    .legacy-a4-form, .legacy-a4-form * { visibility: visible !important; }
    .legacy-a4-form { position: absolute !important; left: 0 !important; top: 0 !important; width: 194mm !important; height: 281mm !important; min-height: 281mm !important; max-height: 281mm !important; margin: 0 !important; padding: 0 3mm 2mm !important; overflow: hidden !important; box-shadow: none !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .legacy-print-page { min-height: 0 !important; margin: 0 !important; padding: 0 !important; background: #fff !important; }
  }
`;
