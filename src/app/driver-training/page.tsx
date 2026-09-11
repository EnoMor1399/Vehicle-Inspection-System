import type { ComponentType } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Box,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  Mountain,
  Search,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react";
import { Badge, Card, PageHeader } from "@/components/ui";
import { requireInternalUser } from "@/lib/require-auth";
import {
  DRIVER_TRAINING_DEPARTMENT,
  DRIVER_TRAINING_OUTCOMES,
  DRIVER_TRAINING_SERVICES,
} from "@/lib/driver-training";

export const dynamic = "force-dynamic";

const SERVICE_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  "defensive-driving": ShieldCheck,
  "driving-proficiency-test": ClipboardCheck,
  "hazmat-hydrocarbons": AlertTriangle,
  "off-road-driving": Mountain,
  "forklift-operator-safety": Box,
  "vehicle-safety-inspection": Search,
};

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
  await requireInternalUser();

  return (
    <div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8 xl:p-10">
      <PageHeader
        eyebrow="Operational Department"
        title={DRIVER_TRAINING_DEPARTMENT.name}
        description={DRIVER_TRAINING_DEPARTMENT.description}
        action={
          <Badge tone="emerald" className="px-3 py-1 text-sm">
            <GraduationCap className="h-4 w-4" /> {DRIVER_TRAINING_SERVICES.length} specialized services
          </Badge>
        }
      />

      <section className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
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

        <Card className="p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Who this supports</p>
              <h2 className="text-base font-semibold text-slate-950">Drivers, operators & safety teams</h2>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            The service portfolio supports professional drivers, bulk and petroleum transport operators, off-road vehicle operators, forklift operators, fleet personnel, supervisors, safety officers, and organizations managing transport or equipment risk.
          </p>
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-emerald-950">Department objective</p>
            <p className="mt-1 text-xs leading-5 text-emerald-800">
              Improve competence and safety behaviour while reducing avoidable accidents, equipment damage, downtime, maintenance exposure, and compliance risk.
            </p>
          </div>
        </Card>
      </section>

      <section className="mt-6" aria-labelledby="training-services">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-color)]">Service portfolio</p>
            <h2 id="training-services" className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Training & assessment services</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              Six focused services covering road driving, competence assessment, hazardous materials, difficult terrain, equipment operation, and vehicle inspection.
            </p>
          </div>
          <Badge tone="slate">Safety · Competence · Compliance</Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {DRIVER_TRAINING_SERVICES.map((service, index) => {
            const Icon = SERVICE_ICONS[service.id] || GraduationCap;
            return (
              <Card key={service.id} className="flex h-full flex-col overflow-hidden">
                <div className="border-b border-slate-200 p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-950 text-white shadow-sm">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="font-mono text-xs font-semibold text-slate-400">{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-slate-950">{service.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{service.summary}</p>
                </div>

                <div className="flex-1 p-5 sm:p-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Core focus</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {service.focusAreas.map((area) => (
                      <span key={area} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {area}
                      </span>
                    ))}
                  </div>

                  <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-slate-500">Operational value</p>
                  <ul className="mt-3 space-y-2">
                    {service.outcomes.map((outcome) => (
                      <li key={outcome} className="flex items-start gap-2 text-sm leading-5 text-slate-600">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        <span>{outcome}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mt-6" aria-labelledby="delivery-framework">
        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-color)]">Operational framework</p>
            <h2 id="delivery-framework" className="mt-1 text-lg font-semibold text-slate-950">From risk need to safer performance</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              The department workspace organizes service delivery around a practical competence-improvement cycle.
            </p>
          </div>
          <div className="grid gap-px bg-slate-200 md:grid-cols-5">
            {DELIVERY_STEPS.map((step, index) => (
              <div key={step.number} className="relative bg-white p-5">
                <span className="text-xs font-bold text-[var(--brand-color)]">{step.number}</span>
                <h3 className="mt-3 text-sm font-semibold text-slate-950">{step.title}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-500">{step.text}</p>
                {index < DELIVERY_STEPS.length - 1 && (
                  <ArrowRight className="absolute right-3 top-5 hidden h-4 w-4 text-slate-300 md:block" />
                )}
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}
