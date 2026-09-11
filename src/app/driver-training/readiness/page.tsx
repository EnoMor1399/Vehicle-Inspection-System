import Link from "next/link";
import { asc, eq, inArray } from "drizzle-orm";
import { AlertTriangle, CheckCircle2, ClipboardCheck, ShieldAlert } from "lucide-react";
import { db } from "@/db";
import { trainingSessions } from "@/db/training-schema";
import { trainingInstructorProfiles, trainingSessionReadiness } from "@/db/training-readiness-schema";
import { Badge, Button, Card, EmptyState, PageHeader, TextArea } from "@/components/ui";
import { DRIVER_TRAINING_SERVICES } from "@/lib/driver-training";
import { requireInternalUser } from "@/lib/require-auth";
import { canManageTraining, canViewTraining } from "@/lib/training-access";
import { evaluateTrainingReadiness, instructorDeploymentState } from "@/lib/training-readiness-policy";
import { formatDateTime } from "@/lib/utils";
import { saveTrainingSessionReadiness } from "./actions";

export const dynamic = "force-dynamic";

const serviceNames = new Map(DRIVER_TRAINING_SERVICES.map((service) => [service.id, service.title]));

const readinessControls = [
  ["instructorConfirmed", "Qualified instructor confirmed"],
  ["venueConfirmed", "Venue / training area confirmed"],
  ["vehicleEquipmentReady", "Vehicle / equipment ready"],
  ["trainingMaterialsReady", "Training materials ready"],
  ["participantListConfirmed", "Participant list confirmed"],
  ["riskAssessmentComplete", "Risk assessment complete"],
  ["emergencyPlanConfirmed", "Emergency plan confirmed"],
  ["clientConfirmationReceived", "Client confirmation received"],
] as const;

function readinessTone(status: string) {
  if (status === "ready") return "emerald" as const;
  if (status === "blocked") return "red" as const;
  return "amber" as const;
}

function instructorTone(status: string) {
  if (status === "ready") return "emerald" as const;
  if (status === "attention") return "amber" as const;
  if (status === "blocked" || status === "unavailable") return "red" as const;
  return "slate" as const;
}

export default async function TrainingReadinessPage() {
  const user = await requireInternalUser();
  if (!canViewTraining(user)) {
    return <div className="p-8 text-sm text-slate-600">You do not have access to Driver Training & Assessment Services.</div>;
  }
  const canManage = canManageTraining(user);

  const sessions = await db
    .select({
      id: trainingSessions.id,
      referenceNumber: trainingSessions.referenceNumber,
      serviceId: trainingSessions.serviceId,
      title: trainingSessions.title,
      clientName: trainingSessions.clientName,
      venue: trainingSessions.venue,
      startAt: trainingSessions.startAt,
      endAt: trainingSessions.endAt,
      sessionStatus: trainingSessions.status,
      instructorId: trainingSessions.instructorId,
      instructorName: trainingSessions.instructorName,
      readinessId: trainingSessionReadiness.id,
      readinessStatus: trainingSessionReadiness.status,
      instructorConfirmed: trainingSessionReadiness.instructorConfirmed,
      venueConfirmed: trainingSessionReadiness.venueConfirmed,
      vehicleEquipmentReady: trainingSessionReadiness.vehicleEquipmentReady,
      trainingMaterialsReady: trainingSessionReadiness.trainingMaterialsReady,
      participantListConfirmed: trainingSessionReadiness.participantListConfirmed,
      riskAssessmentComplete: trainingSessionReadiness.riskAssessmentComplete,
      emergencyPlanConfirmed: trainingSessionReadiness.emergencyPlanConfirmed,
      clientConfirmationReceived: trainingSessionReadiness.clientConfirmationReceived,
      blockers: trainingSessionReadiness.blockers,
      readinessNotes: trainingSessionReadiness.notes,
      reviewedAt: trainingSessionReadiness.reviewedAt,
      instructorProfileStatus: trainingInstructorProfiles.status,
      trainerCertificationExpiry: trainingInstructorProfiles.trainerCertificationExpiry,
      medicalFitnessExpiry: trainingInstructorProfiles.medicalFitnessExpiry,
      driverLicenseExpiry: trainingInstructorProfiles.driverLicenseExpiry,
      firstAidExpiry: trainingInstructorProfiles.firstAidExpiry,
    })
    .from(trainingSessions)
    .leftJoin(trainingSessionReadiness, eq(trainingSessionReadiness.sessionId, trainingSessions.id))
    .leftJoin(trainingInstructorProfiles, eq(trainingInstructorProfiles.userId, trainingSessions.instructorId))
    .where(inArray(trainingSessions.status, ["scheduled", "in_progress"]))
    .orderBy(asc(trainingSessions.startAt))
    .limit(200);

  const summaries = sessions.map((session) => {
    const controls = {
      instructorConfirmed: Boolean(session.instructorConfirmed),
      venueConfirmed: Boolean(session.venueConfirmed),
      vehicleEquipmentReady: Boolean(session.vehicleEquipmentReady),
      trainingMaterialsReady: Boolean(session.trainingMaterialsReady),
      participantListConfirmed: Boolean(session.participantListConfirmed),
      riskAssessmentComplete: Boolean(session.riskAssessmentComplete),
      emergencyPlanConfirmed: Boolean(session.emergencyPlanConfirmed),
      clientConfirmationReceived: Boolean(session.clientConfirmationReceived),
      blockers: session.blockers || [],
    };
    const evaluation = evaluateTrainingReadiness(controls);
    const instructorState = session.instructorId && session.instructorProfileStatus
      ? instructorDeploymentState({
          status: session.instructorProfileStatus,
          trainerCertificationExpiry: session.trainerCertificationExpiry,
          medicalFitnessExpiry: session.medicalFitnessExpiry,
          driverLicenseExpiry: session.driverLicenseExpiry,
          firstAidExpiry: session.firstAidExpiry,
        })
      : "incomplete" as const;
    return { session, controls, evaluation, instructorState };
  });

  const readyCount = summaries.filter((item) => item.evaluation.status === "ready").length;
  const blockedCount = summaries.filter((item) => item.evaluation.status === "blocked").length;
  const notReadyCount = summaries.length - readyCount - blockedCount;
  const instructorAttention = summaries.filter((item) => ["attention", "blocked", "unavailable", "incomplete"].includes(item.instructorState)).length;

  return (
    <div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Session Readiness"
        description="Review delivery controls before training starts: qualified instructor, venue, vehicles/equipment, materials, participants, risk assessment, emergency plan, and client confirmation."
        action={<Link href="/driver-training/instructors" className="text-sm font-semibold text-[var(--brand-accent)] hover:opacity-75">Instructor qualifications →</Link>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Ready" value={readyCount} tone="emerald" icon={<CheckCircle2 className="h-5 w-5" />} />
        <SummaryCard label="Not ready" value={notReadyCount} tone="amber" icon={<ClipboardCheck className="h-5 w-5" />} />
        <SummaryCard label="Blocked" value={blockedCount} tone="red" icon={<ShieldAlert className="h-5 w-5" />} />
        <SummaryCard label="Instructor attention" value={instructorAttention} tone="slate" icon={<AlertTriangle className="h-5 w-5" />} />
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-[var(--vims-line)] px-5 py-4 sm:px-6">
          <h2 className="font-semibold text-[var(--vims-ink)]">Active & upcoming delivery readiness</h2>
          <p className="mt-1 text-sm text-[var(--vims-ink-muted)]">A session becomes ready only when all eight controls are confirmed and no blocker remains. Readiness review does not automatically change the session lifecycle.</p>
        </div>
        {summaries.length === 0 ? (
          <div className="p-5 sm:p-6"><EmptyState icon={<ClipboardCheck className="h-5 w-5" />} title="No active or upcoming sessions" description="Schedule a Driver Training session before completing delivery-readiness controls." /></div>
        ) : (
          <div className="divide-y divide-[var(--vims-line)]">
            {summaries.map(({ session, controls, evaluation, instructorState }) => (
              <div key={session.id} className="p-5 sm:p-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-[var(--vims-ink)]">{session.referenceNumber}</p><Badge tone={readinessTone(evaluation.status)}>{evaluation.status.replaceAll("_", " ")}</Badge><Badge tone={session.sessionStatus === "in_progress" ? "blue" : "slate"}>{session.sessionStatus.replaceAll("_", " ")}</Badge></div>
                    <p className="mt-1 text-sm text-[var(--vims-ink-soft)]">{serviceNames.get(session.serviceId) || session.title}</p>
                    <p className="mt-1 text-xs text-[var(--vims-ink-muted)]">{formatDateTime(session.startAt)} – {formatDateTime(session.endAt)} · {session.clientName || "Internal programme"} · {session.venue || "Venue not recorded"}</p>
                  </div>
                  <div className="lg:text-right"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--vims-ink-muted)]">Instructor</p><p className="mt-1 text-sm font-medium text-[var(--vims-ink)]">{session.instructorName || (session.instructorId ? "Assigned internal instructor" : "Not assigned")}</p><div className="mt-1"><Badge tone={instructorTone(instructorState)}>{instructorState}</Badge></div></div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {readinessControls.map(([key, label]) => <div key={key} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${controls[key] ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-[var(--vims-line)] bg-[var(--vims-panel-soft)] text-[var(--vims-ink-muted)]"}`}><span className={`h-2 w-2 rounded-full ${controls[key] ? "bg-emerald-500" : "bg-slate-300"}`} />{label}</div>)}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--vims-ink-muted)]"><span>{evaluation.completed}/{evaluation.total} controls</span><span>·</span><span>{evaluation.percentage}% complete</span>{session.reviewedAt && <><span>·</span><span>Reviewed {formatDateTime(session.reviewedAt)}</span></>}</div>
                {(session.blockers || []).length > 0 && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-red-700">Current blockers</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-800">{(session.blockers || []).map((blocker) => <li key={blocker}>{blocker}</li>)}</ul></div>}

                {canManage && (
                  <form action={saveTrainingSessionReadiness} className="mt-5 rounded-2xl border border-[var(--vims-line)] bg-[var(--vims-panel-soft)] p-4">
                    <input type="hidden" name="sessionId" value={session.id} />
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {readinessControls.map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-xl border border-[var(--vims-line)] bg-[var(--vims-panel-solid)] px-3 py-2.5 text-xs font-medium text-[var(--vims-ink-soft)]"><input type="checkbox" name={key} defaultChecked={controls[key]} className="h-4 w-4 rounded border-slate-300" />{label}</label>)}
                    </div>
                    <div className="mt-4 grid gap-4 lg:grid-cols-2"><label className="block"><span className="mb-1.5 block text-sm font-semibold text-[var(--vims-ink-soft)]">Blockers</span><TextArea name="blockers" maxLength={4000} defaultValue={(session.blockers || []).join("\n")} className="min-h-[88px]" placeholder="One blocker per line" /></label><label className="block"><span className="mb-1.5 block text-sm font-semibold text-[var(--vims-ink-soft)]">Readiness notes</span><TextArea name="notes" maxLength={4000} defaultValue={session.readinessNotes || ""} className="min-h-[88px]" /></label></div>
                    <div className="mt-4 flex justify-end"><Button type="submit"><ClipboardCheck className="h-4 w-4" /> Save readiness review</Button></div>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, tone, icon }: { label: string; value: number; tone: "slate" | "emerald" | "red" | "amber" | "blue" | "violet"; icon: React.ReactNode }) {
  const toneClasses = tone === "emerald" ? "bg-emerald-50 text-emerald-700" : tone === "red" ? "bg-red-50 text-red-700" : tone === "amber" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-700";
  return <Card className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--vims-ink-muted)]">{label}</p><p className="mt-2 text-2xl font-semibold text-[var(--vims-ink)]">{value}</p></div><div className={`grid h-10 w-10 place-items-center rounded-xl ${toneClasses}`}>{icon}</div></div></Card>;
}
