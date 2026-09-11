import Link from "next/link";
import type { ComponentType } from "react";
import { inArray, sql } from "drizzle-orm";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  Box,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  Mountain,
  Search,
  ShieldCheck,
  Target,
  Users,
  UsersRound,
} from "lucide-react";
import { db } from "@/db";
import { trainingCertificates, trainingParticipants, trainingSessions } from "@/db/training-schema";
import { Badge, Card, PageHeader, StatCard } from "@/components/ui";
import {
  DRIVER_TRAINING_DEPARTMENT,
  DRIVER_TRAINING_OUTCOMES,
  DRIVER_TRAINING_SERVICES,
} from "@/lib/driver-training";
import { requireInternalUser } from "@/lib/require-auth";
import { canManageTraining, canViewTraining } from "@/lib/training-access";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SERVICE_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  "defensive-driving": ShieldCheck,
  "driving-proficiency-test": ClipboardCheck,
  "hazmat-hydrocarbons": AlertTriangle,
  "off-road-driving": Mountain,
  "forklift-operator-safety": Box,
  "vehicle-safety-inspection": Search,
};

const SERVICE_NAMES = new Map(DRIVER_TRAINING_SERVICES.map((service) => [service.id, service.title]));

const DELIVERY_STEPS = [
  {
    number: "01",
    title: "Understand the operating risk",
    text: "Identify the vehicle, equipment, route, work environment, and safety exposure the programme needs to address.",
  },
  {
    number: "02",
    title: "Select the right service",
    text: "Match the organization or operator to the most relevant training or proficiency assessment service.",
  },
  {
    number: "03",
    title: "Build practical competence",
    text: "Combine safety knowledge with practical operating skills, hazard awareness, inspection discipline, and sound judgement.",
  },
  {
    number: "04",
    title: "Assess performance",
    text: "Review competence, safety awareness, handling, and operational behaviour against the objectives of the selected service.",
  },
  {
    number: "05",
    title: "Drive continuous improvement",
    text: "Use identified gaps to guide coaching, retraining, supervision, preventive action, and stronger safety practices.",
  },
] as const;

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
            <Badge tone="emerald"><GraduationCap className="h-4 w-4" /> {DRIVER_TRAINING_SERVICES.length} specialized services</Badge>
            <Badge tone={canManage ? "blue" : "slate"}>{canManage ? "Operational access" : "View access"}</Badge>
          </div>
        }
      />

      <section aria-labelledby="training-command-center">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-color)]">Department operations</p>
            <h2 id="training-command-center" className="mt-1 text-xl font-semibold tracking-tight text-[var(--vims-ink)]">Training command center</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--vims-ink-muted)]">Live programme, participant, risk, and certification indicators for the new department.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm font-semibold">
            <Link href="/driver-training/sessions" className="rounded-xl border border-[var(--vims-line-strong)] bg-[var(--vims-panel-solid)] px-3 py-2 text-[var(--vims-ink)] hover:bg-[var(--vims-panel-soft)]">Sessions</Link>
            <Link href="/driver-training/participants" className="rounded-xl border border-[var(--vims-line-strong)] bg-[var(--vims-panel-solid)] px-3 py-2 text-[var(--vims-ink)] hover:bg-[var(--vims-panel-soft)]">Participants</Link>
            <Link href="/driver-training/certificates" className="rounded-xl border border-[var(--vims-line-strong)] bg-[var(--vims-panel-solid)] px-3 py-2 text-[var(--vims-ink)] hover:bg-[var(--vims-panel-soft)]">Certificates</Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Training sessions" value={Number(sessionStats?.total || 0)} hint="All programmes" tone="blue" icon={<CalendarDays className="h-5 w-5" />} />
          <StatCard label="Active / upcoming" value={Number(sessionStats?.active || 0)} hint="Scheduled or in progress" tone="amber" icon={<GraduationCap className="h-5 w-5" />} />
          <StatCard label="Participants" value={Number(participantStats?.total || 0)} hint="Registered operators" tone="violet" icon={<UsersRound className="h-5 w-5" />} />
          <StatCard label="High-risk operators" value={Number(participantStats?.highRisk || 0)} hint="High or critical" tone="red" icon={<AlertTriangle className="h-5 w-5" />} />
          <StatCard label="Active certificates" value={Number(certificateStats?.active || 0)} hint="Competence records" tone="emerald" icon={<Award className="h-5 w-5" />} />
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 bg-gradient-to-br from-slate-950 to-slate-800 px-5 py-6 text-white sm:px-7 sm:py-8">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                <Target className="h-6 w-6 text-emerald-300" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Department mandate</p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">Safer operators. Safer fleets. Stronger operations.</h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">{DRIVER_TRAINING_DEPARTMENT.purpose}</p>
              </div>
            </div>
          </div>
          <div className="grid gap-px bg-slate-200 sm:grid-cols-2 lg:grid-cols-3">
            {DRIVER_TRAINING_OUTCOMES.map((outcome) => (
              <div key={outcome} className="flex items-center gap-2.5 bg-white px-4 py-3.5 text-sm font-medium text-slate-700">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                {outcome}
              </div>
            ))}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-[var(--vims-line)] p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><CalendarDays className="h-5 w-5" /></div>
              <div><p className="text-xs font-semibold uppercase tracking-wider text-[var(--vims-ink-muted)]">Next programmes</p><h2 className="text-base font-semibold text-[var(--vims-ink)]">Active & upcoming sessions</h2></div>
            </div>
          </div>
          {upcomingSessions.length === 0 ? (
            <div className="p-5 text-sm leading-6 text-[var(--vims-ink-muted)]">No scheduled or in-progress training sessions yet.</div>
          ) : (
            <div className="divide-y divide-[var(--vims-line)]">
              {upcomingSessions.map((session) => (
                <div key={session.id} className="p-4 sm:px-5">
                  <div className="flex items-start justify-between gap-3"><p className="font-semibold text-[var(--vims-ink)]">{session.referenceNumber}</p><Badge tone={session.status === "in_progress" ? "blue" : "amber"}>{session.status.replaceAll("_", " ")}</Badge></div>
                  <p className="mt-1 text-sm text-[var(--vims-ink-soft)]">{SERVICE_NAMES.get(session.serviceId) || session.title}</p>
                  <p className="mt-1 text-xs text-[var(--vims-ink-muted)]">{formatDateTime(session.startAt)} · {session.clientName || "Internal programme"}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      <section className="mt-6" aria-labelledby="training-services">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-color)]">Service portfolio</p>
            <h2 id="training-services" className="mt-1 text-xl font-semibold tracking-tight text-[var(--vims-ink)]">Training & assessment services</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--vims-ink-muted)]">Six focused services covering road driving, competence assessment, hazardous materials, difficult terrain, equipment operation, and vehicle inspection.</p>
          </div>
          <Badge tone="slate">Safety · Competence · Compliance</Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {DRIVER_TRAINING_SERVICES.map((service, index) => {
            const Icon = SERVICE_ICONS[service.id] || GraduationCap;
            return (
              <Card key={service.id} className="flex h-full flex-col overflow-hidden">
                <div className="border-b border-[var(--vims-line)] p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-950 text-white shadow-sm"><Icon className="h-5 w-5" /></div>
                    <span className="font-mono text-xs font-semibold text-slate-400">{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-[var(--vims-ink)]">{service.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--vims-ink-soft)]">{service.summary}</p>
                </div>
                <div className="flex-1 p-5 sm:p-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--vims-ink-muted)]">Core focus</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {service.focusAreas.map((area) => <span key={area} className="rounded-full border border-[var(--vims-line)] bg-[var(--vims-panel-soft)] px-2.5 py-1 text-xs font-medium text-[var(--vims-ink-soft)]">{area}</span>)}
                  </div>
                  <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-[var(--vims-ink-muted)]">Operational value</p>
                  <ul className="mt-3 space-y-2">
                    {service.outcomes.map((outcome) => <li key={outcome} className="flex items-start gap-2 text-sm leading-5 text-[var(--vims-ink-soft)]"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><span>{outcome}</span></li>)}
                  </ul>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mt-6" aria-labelledby="delivery-framework">
        <Card className="overflow-hidden">
          <div className="border-b border-[var(--vims-line)] px-5 py-5 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-color)]">Operational framework</p>
            <h2 id="delivery-framework" className="mt-1 text-lg font-semibold text-[var(--vims-ink)]">From risk need to safer performance</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--vims-ink-muted)]">The department now connects programme scheduling, participant records, competence assessment, and controlled certificate issuance to this improvement cycle.</p>
          </div>
          <div className="grid gap-px bg-[var(--vims-line)] md:grid-cols-5">
            {DELIVERY_STEPS.map((step, index) => (
              <div key={step.number} className="relative bg-[var(--vims-panel-solid)] p-5">
                <span className="text-xs font-bold text-[var(--brand-color)]">{step.number}</span>
                <h3 className="mt-3 text-sm font-semibold text-[var(--vims-ink)]">{step.title}</h3>
                <p className="mt-2 text-xs leading-5 text-[var(--vims-ink-muted)]">{step.text}</p>
                {index < DELIVERY_STEPS.length - 1 && <ArrowRight className="absolute right-3 top-5 hidden h-4 w-4 text-slate-300 md:block" />}
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}
