import Link from "next/link";
import type { ComponentType } from "react";
import { inArray, sql } from "drizzle-orm";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  BarChart3,
  CalendarDays,
  ClipboardList,
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

type QuickWorkspace = {
  href: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
};

const QUICK_WORKSPACES: QuickWorkspace[] = [
  {
    href: "/driver-training/requests",
    label: "Training requests",
    description: "Review demand, approvals and programme intake.",
    icon: ClipboardPlus,
  },
  {
    href: "/driver-training/sessions",
    label: "Sessions",
    description: "Schedule and manage training delivery.",
    icon: CalendarDays,
  },
  {
    href: "/driver-training/participants",
    label: "Participants",
    description: "Manage operator records, risk and assessment status.",
    icon: UsersRound,
  },
  {
    href: "/driver-training/certificates",
    label: "Certificates",
    description: "Control competence records and certificate status.",
    icon: Award,
  },
  {
    href: "/driver-training/analytics",
    label: "Analytics",
    description: "Review programme, participant and performance trends.",
    icon: BarChart3,
  },
  {
    href: "/driver-training/compliance",
    label: "Compliance",
    description: "Track obligations, controls and compliance evidence.",
    icon: ShieldCheck,
  },
];

const SERVICE_NAMES = new Map(DRIVER_TRAINING_SERVICES.map((service) => [service.id, service.title]));

export default async function DriverTrainingPage() {
  const user = await requireInternalUser();
  if (!canViewTraining(user)) {
    return <div className="p-8 text-sm text-slate-600">You do not have access to Driver Training & Assessment Services.</div>;
  }

  const canManage = canManageTraining(user);

  const [[sessionStats], [participantStats], [certificateStats], upcomingSessions] = await Promise.all([
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
      .limit(5),
  ]);

  return (
    <div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8 xl:p-10">
      <PageHeader
        title={DRIVER_TRAINING_DEPARTMENT.name}
        description={DRIVER_TRAINING_DEPARTMENT.description}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="emerald">
              <GraduationCap className="h-4 w-4" />
              {DRIVER_TRAINING_SERVICES.length} services
            </Badge>
            <Badge tone={canManage ? "blue" : "slate"}>{canManage ? "Management access" : "View access"}</Badge>
          </div>
        }
      />

      <section aria-labelledby="training-overview">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-color)]">Department operations</p>
          <h2 id="training-overview" className="mt-1 text-xl font-semibold tracking-tight text-[var(--vims-ink)]">
            Operational overview
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--vims-ink-muted)]">
            Current training activity, participant risk and certification status at a glance.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Training sessions"
            value={Number(sessionStats?.total || 0)}
            hint="All programmes"
            tone="blue"
            icon={<CalendarDays className="h-5 w-5" />}
          />
          <StatCard
            label="Active / upcoming"
            value={Number(sessionStats?.active || 0)}
            hint="Scheduled or in progress"
            tone="amber"
            icon={<GraduationCap className="h-5 w-5" />}
          />
          <StatCard
            label="Participants"
            value={Number(participantStats?.total || 0)}
            hint="Registered operators"
            tone="violet"
            icon={<UsersRound className="h-5 w-5" />}
          />
          <StatCard
            label="High-risk operators"
            value={Number(participantStats?.highRisk || 0)}
            hint="High or critical"
            tone="red"
            icon={<AlertTriangle className="h-5 w-5" />}
          />
          <StatCard
            label="Active certificates"
            value={Number(certificateStats?.active || 0)}
            hint="Competence records"
            tone="emerald"
            icon={<Award className="h-5 w-5" />}
          />
        </div>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.08fr_.92fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-[var(--vims-line)] px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/45 dark:text-blue-300">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--vims-ink-muted)]">Programme schedule</p>
                <h2 className="text-base font-semibold text-[var(--vims-ink)]">Active & upcoming sessions</h2>
              </div>
            </div>
            <Link
              href="/driver-training/sessions"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--brand-color)] hover:underline"
            >
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {upcomingSessions.length === 0 ? (
            <div className="p-6 text-sm leading-6 text-[var(--vims-ink-muted)]">
              No scheduled or in-progress training sessions.
            </div>
          ) : (
            <div className="divide-y divide-[var(--vims-line)]">
              {upcomingSessions.map((session) => (
                <div key={session.id} className="px-5 py-4 sm:px-6">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--vims-ink)]">{session.referenceNumber}</p>
                      <p className="mt-1 text-sm text-[var(--vims-ink-soft)]">
                        {SERVICE_NAMES.get(session.serviceId) || session.title}
                      </p>
                    </div>
                    <Badge tone={session.status === "in_progress" ? "blue" : "amber"}>
                      {session.status.replaceAll("_", " ")}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-[var(--vims-ink-muted)]">
                    {formatDateTime(session.startAt)} · {session.clientName || "Internal programme"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-[var(--vims-line)] px-5 py-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--vims-ink-muted)]">Workspace</p>
            <h2 className="mt-0.5 text-base font-semibold text-[var(--vims-ink)]">Quick access</h2>
          </div>
          <div className="grid gap-px bg-[var(--vims-line)] sm:grid-cols-2">
            {QUICK_WORKSPACES.map(({ href, label, description, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="group flex min-h-28 gap-3 bg-[var(--vims-panel-solid)] p-4 transition-colors hover:bg-[var(--vims-panel-soft)] sm:p-5"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--vims-panel-soft)] text-[var(--brand-color)] ring-1 ring-inset ring-[var(--vims-line)] transition-colors group-hover:bg-[var(--vims-panel-solid)]">
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-[var(--vims-ink)]">
                    {label}
                    <ArrowRight className="h-3.5 w-3.5 text-[var(--vims-ink-muted)] transition-transform group-hover:translate-x-0.5" />
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-[var(--vims-ink-muted)]">{description}</span>
                </span>
              </Link>
            ))}
          </div>
        </Card>
      </section>

      <section className="mt-6" aria-labelledby="training-services">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-color)]">Service portfolio</p>
            <h2 id="training-services" className="mt-1 text-xl font-semibold tracking-tight text-[var(--vims-ink)]">
              Training & assessment services
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--vims-ink-muted)]">
              Core services delivered by the department. Detailed programme controls are available from the workspace navigation above.
            </p>
          </div>
          <Badge tone="slate">Safety · Competence · Compliance</Badge>
        </div>

        <Card className="overflow-hidden">
          <div className="grid gap-px bg-[var(--vims-line)] md:grid-cols-2 xl:grid-cols-3">
            {DRIVER_TRAINING_SERVICES.map((service, index) => (
              <div key={service.id} className="bg-[var(--vims-panel-solid)] p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--vims-panel-soft)] text-[var(--brand-color)] ring-1 ring-inset ring-[var(--vims-line)]">
                    <ClipboardList className="h-4 w-4" />
                  </div>
                  <span className="font-mono text-[11px] font-semibold text-[var(--vims-ink-muted)]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-4 text-sm font-semibold text-[var(--vims-ink)]">{service.title}</h3>
                <p className="mt-1.5 text-xs leading-5 text-[var(--vims-ink-muted)]">{service.summary}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}
