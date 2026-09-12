import Link from "next/link";
import { inArray, sql } from "drizzle-orm";
import {
  AlertTriangle,
  Award,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  ClipboardPlus,
  GraduationCap,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { db } from "@/db";
import { trainingCertificates, trainingParticipants, trainingSessions } from "@/db/training-schema";
import { Badge, Card, PageHeader, StatCard } from "@/components/ui";
import { DRIVER_TRAINING_DEPARTMENT, DRIVER_TRAINING_SERVICES } from "@/lib/driver-training";
import { requireInternalUser } from "@/lib/require-auth";
import { canManageTraining, canViewTraining } from "@/lib/training-access";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SERVICE_NAMES = new Map(DRIVER_TRAINING_SERVICES.map((service) => [service.id, service.title]));

export default async function DriverTrainingPage() {
  const user = await requireInternalUser();
  if (!canViewTraining(user)) {
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
        <Card className="p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/45 dark:text-amber-300 dark:ring-amber-800">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-lg font-semibold text-[var(--vims-ink)]">Driver Training access required</h1>
              <p className="mt-1.5 text-sm leading-6 text-[var(--vims-ink-muted)]">
                Your account does not currently have permission to view Driver Training & Assessment Services.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const canManage = canManageTraining(user);

  const [sessionResult, participantResult, certificateResult, scheduleResult] = await Promise.allSettled([
    db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${trainingSessions.status} in ('scheduled','in_progress'))::int`,
      })
      .from(trainingSessions),
    db
      .select({
        total: sql<number>`count(*)::int`,
        highRisk: sql<number>`count(*) filter (where ${trainingParticipants.riskLevel} in ('high','critical'))::int`,
      })
      .from(trainingParticipants),
    db
      .select({
        active: sql<number>`count(*) filter (where ${trainingCertificates.status} = 'active')::int`,
      })
      .from(trainingCertificates),
    db
      .select({
        id: trainingSessions.id,
        referenceNumber: trainingSessions.referenceNumber,
        serviceId: trainingSessions.serviceId,
        title: trainingSessions.title,
        clientName: trainingSessions.clientName,
        startAt: trainingSessions.startAt,
        status: trainingSessions.status,
      })
      .from(trainingSessions)
      .where(inArray(trainingSessions.status, ["scheduled", "in_progress"]))
      .orderBy(trainingSessions.startAt)
      .limit(6),
  ] as const);

  const sessionStats = sessionResult.status === "fulfilled" ? sessionResult.value[0] : undefined;
  const participantStats = participantResult.status === "fulfilled" ? participantResult.value[0] : undefined;
  const certificateStats = certificateResult.status === "fulfilled" ? certificateResult.value[0] : undefined;
  const upcomingSessions = scheduleResult.status === "fulfilled" ? scheduleResult.value : [];
  const hasDataIssue = [sessionResult, participantResult, certificateResult, scheduleResult].some(
    (result) => result.status === "rejected",
  );

  if (hasDataIssue) {
    console.error("[driver-training] One or more dashboard data segments could not be loaded", {
      sessions: sessionResult.status,
      participants: participantResult.status,
      certificates: certificateResult.status,
      schedule: scheduleResult.status,
    });
  }

  return (
    <div className="mx-auto max-w-[1450px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={DRIVER_TRAINING_DEPARTMENT.name}
        description="Manage training delivery, driver assessment, participant risk and certification from one workspace."
        action={
          canManage ? (
            <details className="group relative">
              <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-xl bg-[var(--brand-color)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-color)] focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
                Create
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
              </summary>
              <div className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-[var(--vims-line)] bg-[var(--vims-panel-solid)] p-1.5 shadow-xl">
                <Link href="/driver-training/requests" className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-[var(--vims-ink-soft)] hover:bg-[var(--vims-panel-soft)] hover:text-[var(--vims-ink)]">
                  <ClipboardPlus className="h-4 w-4" /> Training request
                </Link>
                <Link href="/driver-training/sessions" className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-[var(--vims-ink-soft)] hover:bg-[var(--vims-panel-soft)] hover:text-[var(--vims-ink)]">
                  <CalendarDays className="h-4 w-4" /> Training session
                </Link>
                <Link href="/driver-training/assessments" className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-[var(--vims-ink-soft)] hover:bg-[var(--vims-panel-soft)] hover:text-[var(--vims-ink)]">
                  <ClipboardCheck className="h-4 w-4" /> Driver assessment
                </Link>
              </div>
            </details>
          ) : undefined
        }
      />

      {hasDataIssue && (
        <div role="status" className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-sm leading-5">Some live metrics are temporarily unavailable. Available workspaces remain usable.</p>
        </div>
      )}

      <section aria-label="Driver Training summary" className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Training sessions"
          value={sessionStats ? Number(sessionStats.total || 0) : "—"}
          hint={sessionStats ? `${Number(sessionStats.active || 0)} active or upcoming` : "Temporarily unavailable"}
          tone="blue"
          icon={<GraduationCap className="h-5 w-5" />}
        />
        <StatCard
          label="Participants"
          value={participantStats ? Number(participantStats.total || 0) : "—"}
          hint={participantStats ? `${Number(participantStats.highRisk || 0)} high or critical risk` : "Temporarily unavailable"}
          tone="violet"
          icon={<UsersRound className="h-5 w-5" />}
        />
        <StatCard
          label="Active certificates"
          value={certificateStats ? Number(certificateStats.active || 0) : "—"}
          hint={certificateStats ? "Current competence records" : "Temporarily unavailable"}
          tone="emerald"
          icon={<Award className="h-5 w-5" />}
        />
      </section>

      <Card className="mt-6 overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-[var(--vims-line)] px-5 py-4 sm:px-6">
          <div>
            <h2 className="font-semibold text-[var(--vims-ink)]">Active & upcoming sessions</h2>
            <p className="mt-1 text-sm text-[var(--vims-ink-muted)]">Next scheduled or in-progress programmes.</p>
          </div>
          <Link href="/driver-training/sessions" className="shrink-0 text-sm font-semibold text-[var(--brand-color)] hover:opacity-75">
            View sessions →
          </Link>
        </div>

        {scheduleResult.status === "rejected" ? (
          <div className="p-6 text-sm text-[var(--vims-ink-muted)]">The live programme schedule is temporarily unavailable.</div>
        ) : upcomingSessions.length === 0 ? (
          <div className="p-6 text-sm text-[var(--vims-ink-muted)]">No scheduled or in-progress training sessions.</div>
        ) : (
          <div className="divide-y divide-[var(--vims-line)]">
            {upcomingSessions.map((session) => (
              <div key={session.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[var(--vims-ink)]">{session.referenceNumber}</p>
                    <Badge tone={session.status === "in_progress" ? "blue" : "amber"}>{session.status.replaceAll("_", " ")}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-[var(--vims-ink-soft)]">{SERVICE_NAMES.get(session.serviceId) || session.title}</p>
                </div>
                <p className="shrink-0 text-xs text-[var(--vims-ink-muted)]">
                  {formatDateTime(session.startAt)} · {session.clientName || "Internal programme"}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
