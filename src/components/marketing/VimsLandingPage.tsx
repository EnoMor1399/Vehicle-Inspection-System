"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight, ArrowUpRight, BarChart3, CalendarCheck2, Check, CheckCircle2, ChevronDown,
  ClipboardCheck, FileCheck2, Layers3, LockKeyhole, Minus, ShieldCheck, Sparkles, Truck, UsersRound,
} from "lucide-react";
import type { subscriptionPlans } from "@/db/schema";

type Plan = typeof subscriptionPlans.$inferSelect;
type BillingView = "monthly" | "annual";
type FeatureRow = { label: string; description?: string; value: (plan: Plan) => string | boolean };
type FeatureGroup = { title: string; rows: FeatureRow[] };

const comparison: FeatureGroup[] = [
  {
    title: "Inspection operations",
    rows: [
      { label: "Digital vehicle inspection", value: (plan) => plan.modules.includes("vehicle_inspection") },
      { label: "Fleet and transporter records", value: (plan) => plan.modules.includes("vehicle_inspection") },
      { label: "Inspection reports and certificates", value: (plan) => plan.modules.includes("vehicle_inspection") },
      { label: "Users", description: "Maximum active user accounts", value: (plan) => plan.maxUsers.toLocaleString("en-GH") },
      { label: "Stations", description: "Maximum inspection locations", value: (plan) => plan.maxStations.toLocaleString("en-GH") },
      { label: "Registered vehicles", value: (plan) => plan.maxVehicles.toLocaleString("en-GH") },
      { label: "Inspections per month", value: (plan) => plan.maxInspectionsPerMonth.toLocaleString("en-GH") },
    ],
  },
  {
    title: "Modules & reporting",
    rows: [
      { label: "Reports & analytics", value: (plan) => plan.modules.includes("reports") },
      { label: "Driver training & assessment", value: (plan) => plan.modules.includes("driver_training") },
      { label: "API & integrations", description: "Requires the API module in your plan", value: (plan) => plan.modules.includes("api") },
    ],
  },
  {
    title: "Organisation & security",
    rows: [
      { label: "Dedicated organisation workspace", value: () => true },
      { label: "Role-based employee access", value: () => true },
      { label: "Activity and audit history", value: () => true },
      { label: "Organisation branding", value: (plan) => Boolean(plan.features?.custom_branding) },
      { label: "Priority support", value: (plan) => Boolean(plan.features?.priority_support) },
      { label: "Trial policy", value: (plan) => plan.trialDays > 0 ? plan.trialDays + " days" : "On request" },
    ],
  },
];

const benefits = [
  { icon: ClipboardCheck, title: "Structured inspections", text: "Digital assessment workflows, traceable findings and approvals." },
  { icon: Truck, title: "Connected fleet records", text: "Vehicles, transporters, compliance history and certificates in one place." },
  { icon: BarChart3, title: "Operational visibility", text: "Actionable reporting for inspection and fleet management teams." },
  { icon: LockKeyhole, title: "Protected company data", text: "Role-aware access and separate organisation workspaces." },
];

const faq = [
  { q: "Can we add staff to our organisation?", a: "Yes. Organisation administrators can create employee accounts inside their own organisation, within the subscribed user capacity." },
  { q: "Is driver training included with every package?", a: "No. Included modules differ by package. Consult the comparison table to confirm whether Driver Training & Assessment is included." },
  { q: "Can we request annual billing?", a: "Yes. Select Annual pricing to request a quote. The current catalogue may not publish an annual rate, so the final price must be confirmed during review." },
  { q: "Will our data be separate from other subscribers?", a: "Each company is assigned its own organisation-scoped workspace. Activation requires administrative approval and tenant-isolation verification." },
];

function priceFor(plan: Plan, period: BillingView) {
  const value = Number(plan.price);
  if (plan.billingCycle === period && value > 0 && Number.isFinite(value)) {
    const amount = new Intl.NumberFormat("en-GH", { minimumFractionDigits: value % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 }).format(value);
    return { amount: plan.currency === "GHS" ? "GH₵" + amount : plan.currency + " " + amount, frequency: period === "annual" ? "per year" : "per month" };
  }
  return { amount: "Custom quote", frequency: period === "annual" ? "Annual terms on request" : "Pricing on request" };
}

function ValueCell({ value }: { value: string | boolean }) {
  if (typeof value === "boolean") {
    return value
      ? <span className="inline-flex items-center gap-1 text-emerald-700" aria-label="Included"><CheckCircle2 size={17} aria-hidden="true" /><span className="sr-only">Included</span></span>
      : <span className="inline-flex items-center gap-1 text-slate-400" aria-label="Not included"><Minus size={16} aria-hidden="true" /><span className="sr-only">Not included</span></span>;
  }
  return <span className="font-medium text-zinc-700">{value}</span>;
}

function PlanAction({ plan, view, wide = false }: { plan: Plan; view: BillingView; wide?: boolean }) {
  const href = "/subscribe?plan=" + encodeURIComponent(plan.code) + (view === "annual" ? "&billing=annual" : "");
  return (
    <Link href={href} className={"inline-flex items-center justify-center rounded-lg bg-[#141414] px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 " + (wide ? "w-full" : "")}>
      {view === "annual" ? "Request annual quote" : "Get started"}
    </Link>
  );
}

export function VimsLandingPage({ plans }: { plans: Plan[] }) {
  const [billingView, setBillingView] = useState<BillingView>("monthly");
  const highlighted = plans.some((plan) => plan.code === "professional") ? "professional" : plans[1]?.code;

  return (
    <div className="min-h-screen bg-[#efefef] px-0 py-0 text-[#171717] sm:px-5 sm:py-9 lg:py-14">
      <div className="mx-auto min-h-screen max-w-[1270px] bg-white shadow-[0_12px_70px_rgba(0,0,0,.045)] sm:min-h-[95vh]">
        <div className="relative z-30 px-4 pt-4 sm:px-7 sm:pt-6 lg:px-10">
          <header className="flex min-h-[66px] items-center justify-between gap-3 rounded-[19px] border border-white/10 bg-[#101b22] px-4 text-white shadow-[0_14px_32px_rgba(8,18,28,.16)] sm:rounded-full sm:px-6">
            <Link href="/welcome" className="inline-flex shrink-0 items-center gap-2.5 text-sm font-black tracking-[-.03em]" aria-label="VIMS home">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-400 text-[#05281e]"><ShieldCheck size={20} aria-hidden="true" /></span>
              <span>VIMS<span className="text-emerald-400">.</span><span className="ml-2 hidden border-l border-white/20 pl-3 text-[10px] font-medium uppercase tracking-[.15em] text-slate-400 lg:inline">Enterprise</span></span>
            </Link>
            <nav aria-label="Landing page" className="hidden flex-1 items-center justify-center gap-6 text-[12px] font-semibold text-white/80 md:flex">
              <a href="#overview" className="transition hover:text-emerald-300">Home</a>
              <a href="#benefits" className="transition hover:text-emerald-300">Features</a>
              <a href="#pricing" className="transition hover:text-emerald-300">Pricing</a>
              <a href="#workflow" className="transition hover:text-emerald-300">How it works</a>
              <a href="#faq" className="transition hover:text-emerald-300">FAQs</a>
            </nav>
            <div className="hidden items-center gap-3 sm:flex">
              <Link href="/login" className="rounded-full px-3 py-2.5 text-xs font-semibold text-white/85 transition hover:text-emerald-300">Log in</Link>
              <Link href="/subscribe" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-xs font-extrabold text-[#12232c] transition hover:bg-emerald-100">Request access <ArrowUpRight size={15} aria-hidden="true" /></Link>
            </div>
            <details className="group relative sm:hidden">
              <summary className="flex cursor-pointer list-none items-center gap-1 rounded-full border border-white/25 px-3 py-2 text-xs font-semibold [&::-webkit-details-marker]:hidden">Menu <ChevronDown size={15} className="transition group-open:rotate-180" /></summary>
              <nav aria-label="Mobile landing page" className="absolute right-0 top-11 z-30 flex w-56 flex-col rounded-2xl border border-zinc-700 bg-[#101b22] p-2 shadow-2xl">
                <a href="#overview" className="rounded-lg px-3 py-2.5 text-xs hover:bg-zinc-700">Home</a>
                <a href="#pricing" className="rounded-lg px-3 py-2.5 text-xs hover:bg-zinc-700">Pricing</a>
                <a href="#benefits" className="rounded-lg px-3 py-2.5 text-xs hover:bg-zinc-700">Features</a>
                <a href="#faq" className="rounded-lg px-3 py-2.5 text-xs hover:bg-zinc-700">FAQs</a>
                <Link href="/login" className="rounded-lg px-3 py-2.5 text-xs hover:bg-zinc-700">Log in</Link>
                <Link href="/subscribe" className="rounded-lg bg-emerald-400 px-3 py-2.5 text-xs font-bold text-[#103024]">Request access</Link>
              </nav>
            </details>
          </header>
        </div>

        <main>
          <section id="overview" className="scroll-mt-4 px-4 pb-3 pt-5 sm:px-7 lg:px-10">
            <div className="relative isolate overflow-hidden rounded-[28px] bg-[#0a2431] px-6 py-11 text-white sm:px-10 sm:py-14 lg:px-14 lg:py-[68px]">
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_78%_17%,rgba(52,211,153,.25),transparent_36%),linear-gradient(120deg,#102d3c_0%,#091c2a_67%,#0e3441_100%)]" />
              <div aria-hidden="true" className="pointer-events-none absolute -right-28 -top-48 -z-10 h-[520px] w-[520px] rounded-full border border-white/10" />
              <div aria-hidden="true" className="pointer-events-none absolute -right-5 -top-24 -z-10 h-[370px] w-[370px] rounded-full border border-white/10" />
              <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_.95fr] lg:gap-14">
                <div className="relative max-w-[600px]">
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-4 py-2 text-[11px] font-bold tracking-wide text-emerald-200"><Sparkles size={14} aria-hidden="true" /> Designed for modern inspection operations</span>
                  <h1 className="mt-6 text-[clamp(2.55rem,5vw,4.65rem)] font-extrabold leading-[1.08] tracking-[-.055em]">Every inspection.<br /><span className="text-emerald-300">One powerful</span><br />platform.</h1>
                  <p className="mt-6 max-w-[515px] text-sm leading-7 text-slate-300 sm:text-base sm:leading-8">Run vehicle inspections, manage fleet compliance and keep certificates, people and reports connected — all from one secure VIMS workspace.</p>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <a href="#pricing" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-6 py-3 text-sm font-extrabold text-[#09352a] shadow-[0_12px_28px_rgba(52,211,153,.18)] transition hover:-translate-y-0.5 hover:bg-emerald-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400">Explore pricing <ArrowRight size={17} aria-hidden="true" /></a>
                    <Link href="/subscribe" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/25 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">Request a workspace</Link>
                  </div>
                  <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-[11px] font-semibold text-slate-300">
                    <span className="inline-flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-300" /> Company data isolation</span>
                    <span className="inline-flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-300" /> Digital inspection workflows</span>
                    <span className="inline-flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-300" /> Audit-ready records</span>
                  </div>
                </div>
                <div className="relative mx-auto w-full max-w-[560px]">
                  <div className="absolute -inset-4 rounded-[30px] bg-emerald-400/10 blur-2xl" aria-hidden="true" />
                  <div className="relative overflow-hidden rounded-[23px] border border-white/20 bg-white p-3 text-slate-900 shadow-[0_30px_65px_rgba(0,0,0,.32)] sm:p-4">
                    <div className="flex items-center justify-between rounded-xl bg-[#0b2735] px-4 py-3 text-white">
                      <span className="inline-flex items-center gap-2 text-xs font-extrabold"><span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-400 text-[#07352b]"><ShieldCheck size={16} /></span> VIMS Operations</span>
                      <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-200">Workflow preview</span>
                    </div>
                    <div className="px-1 pb-1 pt-5 sm:px-2">
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">Operations workspace</p><h2 className="mt-1 text-base font-extrabold tracking-tight">All your inspections, connected.</h2></div>
                        <span className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700"><Layers3 size={19} /></span>
                      </div>
                      <div className="mt-5 grid grid-cols-2 gap-2.5 sm:gap-3">
                        {[
                          { icon: Truck, title: "Fleet records", subtitle: "Vehicles & transporters" },
                          { icon: ClipboardCheck, title: "Inspections", subtitle: "Digital assessments" },
                          { icon: FileCheck2, title: "Certificates", subtitle: "Review & verification" },
                          { icon: BarChart3, title: "Reporting", subtitle: "Operational insight" },
                        ].map(({ icon: Icon, title, subtitle }) => (
                          <div key={title} className="rounded-xl border border-slate-100 bg-[#f7f9fb] px-3 py-3.5">
                            <span className="inline-flex items-center gap-2 text-[11px] font-bold"><Icon size={16} className="shrink-0 text-emerald-700" />{title}</span>
                            <p className="mt-1 text-[10px] text-slate-500">{subtitle}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 rounded-xl border border-slate-100 bg-[#f7f9fb] p-3 sm:p-4">
                        <div className="flex items-center justify-between gap-2"><span className="text-xs font-extrabold">Inspection workflow</span><span className="text-[10px] font-medium text-slate-400">Illustrative interface</span></div>
                        <div className="mt-4 grid grid-cols-4 gap-1">
                          {["Register", "Inspect", "Review", "Certify"].map((label, index) => (
                            <div key={label} className="flex flex-col items-center gap-2 text-center">
                              <span className={"grid h-9 w-9 place-items-center rounded-full text-xs font-extrabold " + (index < 3 ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500")}>{index < 3 ? <Check size={16} aria-hidden="true" /> : "4"}</span>
                              <span className="text-[9px] font-semibold text-slate-600 sm:text-[10px]">{label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute -bottom-5 -left-4 hidden items-center gap-2 rounded-xl border border-white/20 bg-[#163b42] px-3.5 py-3 text-white shadow-xl sm:inline-flex"><span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-400/15 text-emerald-300"><ShieldCheck size={18} /></span><span className="text-[11px] font-extrabold">Secure by design</span></div>
                </div>
              </div>
            </div>
          </section>

          <section id="pricing" className="relative scroll-mt-4 overflow-hidden px-5 pb-4 pt-16 sm:px-10 lg:px-[7%] lg:pt-20">
            <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-36 h-[410px] w-[410px] rounded-full border border-zinc-100">
              <div className="absolute inset-9 rounded-full border border-zinc-100" />
              <div className="absolute inset-[75px] rounded-full border border-zinc-100" />
              <div className="absolute inset-[119px] rounded-full border border-zinc-100" />
            </div>
            <div className="relative">
              <span className="text-[11px] font-bold uppercase tracking-[.17em] text-emerald-700">Vehicle Inspection Management System</span>
              <h1 className="mt-3 text-[clamp(2.35rem,5vw,4.05rem)] font-extrabold leading-tight tracking-[-.06em] text-[#161616]">Pricing plans</h1>
              <p className="mt-3 max-w-xl text-sm leading-7 text-[#747474] sm:text-base">A plan for every inspection operation. Compare real VIMS limits and benefits before you request your company workspace.</p>

              <div className="mt-10 inline-flex gap-1 rounded-xl border border-zinc-200 bg-[#f5f5f5] p-1" role="group" aria-label="Billing period">
                <button type="button" aria-pressed={billingView === "annual"} onClick={() => setBillingView("annual")} className={"rounded-lg px-4 py-2 text-xs font-semibold transition " + (billingView === "annual" ? "bg-white text-black shadow-sm ring-1 ring-zinc-200" : "text-zinc-500 hover:text-black")}>Annual pricing</button>
                <button type="button" aria-pressed={billingView === "monthly"} onClick={() => setBillingView("monthly")} className={"rounded-lg px-4 py-2 text-xs font-semibold transition " + (billingView === "monthly" ? "bg-white text-black shadow-sm ring-1 ring-zinc-200" : "text-zinc-500 hover:text-black")}>Monthly pricing</button>
              </div>
              {billingView === "annual" && <p className="mt-2 text-xs text-zinc-500">Annual prices are shown only when published for the plan. Other annual terms require a quote.</p>}
            </div>
            {plans.length === 0 ? (
              <div className="mt-7 rounded-2xl border border-zinc-200 bg-zinc-50 p-8 text-center">
                <h2 className="text-xl font-bold">Subscription packages are being updated</h2>
                <p className="mt-2 text-sm text-zinc-500">Request a tailored VIMS proposal while the catalogue is updated.</p>
                <Link href="/subscribe" className="mt-5 inline-flex rounded-lg bg-zinc-900 px-5 py-3 text-sm font-semibold text-white">Request proposal</Link>
              </div>
            ) : (
              <div className="mt-8 grid gap-5 lg:grid-cols-3">
                {plans.map((plan) => {
                  const price = priceFor(plan, billingView);
                  const isPopular = plan.code === highlighted;
                  return (
                    <article key={plan.id} className="relative flex min-h-[265px] flex-col rounded-[20px] border border-[#ededed] bg-[#f3f3f3] px-5 pb-5 pt-6 sm:px-6">
                      {isPopular && <span className="absolute -top-3 left-3 rounded-full bg-[#171717] px-3 py-1 text-[10px] font-bold text-white">Most popular</span>}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h2 className="text-lg font-extrabold tracking-tight">{plan.name} plan</h2>
                          <p className="mt-1 min-h-11 text-xs leading-5 text-zinc-500">{plan.description || "Flexible inspection operations for your organisation."}</p>
                        </div>
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-zinc-400 text-zinc-800"><CheckCircle2 size={18} aria-hidden="true" /></span>
                      </div>
                      <div className="mt-auto flex min-h-[91px] items-center gap-2 pt-4">
                        <span className="text-[clamp(1.75rem,2.6vw,2.55rem)] font-extrabold tracking-[-.055em]">{price.amount}</span>
                        {price.amount !== "Custom quote" && <span className="max-w-[64px] text-[11px] leading-4 text-zinc-500">{price.frequency}</span>}
                      </div>
                      {price.amount === "Custom quote" && <p className="-mt-1 mb-3 text-[11px] text-zinc-500">{price.frequency}</p>}
                      <div className="mt-2"><PlanAction plan={plan} view={billingView} wide /></div>
                    </article>
                  );
                })}
              </div>
            )}

            <p className="mt-5 text-xs leading-5 text-zinc-500">Prices and plan capacities are taken from the active VIMS catalogue. A request is subject to administrative approval; no payment is collected on this page.</p>
          </section>

          {plans.length > 0 && (
            <section aria-labelledby="compare-title" className="px-5 pb-12 pt-7 sm:px-10 lg:px-[7%]">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 id="compare-title" className="text-xl font-extrabold tracking-tight sm:text-2xl">Compare what’s included</h2>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">Plan entitlements, operational capacities and security benefits.</p>
                </div>
                <span className="rounded-full border border-zinc-200 px-3 py-1.5 text-[11px] font-medium text-zinc-600"><ShieldCheck size={13} className="mr-1 inline text-emerald-700" /> Separate company workspaces</span>
              </div>
              <div className="overflow-x-auto" role="region" aria-label="Subscription feature comparison" tabIndex={0}>
                <table className="w-full min-w-[690px] table-fixed border-separate border-spacing-0 text-left">
                  <caption className="sr-only">VIMS subscription packages and included benefits</caption>
                  <thead>
                    <tr className="text-xs text-zinc-900">
                      <th scope="col" className="w-[29%] border-b border-zinc-200 py-4 pr-3 font-bold">Features</th>
                      {plans.map((plan) => <th scope="col" key={plan.id} className="border-b border-zinc-200 px-3 py-4 text-center font-bold">{plan.name} plan</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.map((group) => (
                      <FragmentGroup key={group.title} group={group} plans={plans} />
                    ))}
                    <tr>
                      <th scope="row" className="py-6 pr-3 text-xs font-semibold">Ready to get started?</th>
                      {plans.map((plan) => (
                        <td key={plan.id} className="px-2 py-6 text-center"><PlanAction plan={plan} view={billingView} wide /></td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-zinc-500">Features can require administrative setup and assigned roles. API access requires the API module to be included in the plan.</p>
            </section>
          )}

          <section id="benefits" className="scroll-mt-6 border-t border-zinc-100 px-5 py-14 sm:px-10 lg:px-[7%]">
            <div className="max-w-2xl">
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-700">Why VIMS</span>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight">All the essentials. One smarter workspace.</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-500">Designed for vehicle inspection centres, fleet teams and transport organisations. Module availability depends on your plan.</p>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {benefits.map(({ icon: Icon, title, text }) => (
                <article key={title} className="rounded-2xl border border-zinc-200 bg-[#f8f8f8] p-5">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-white text-emerald-700"><Icon size={20} aria-hidden="true" /></div>
                  <h3 className="mt-4 text-sm font-bold">{title}</h3>
                  <p className="mt-2 text-xs leading-6 text-zinc-500">{text}</p>
                </article>
              ))}
            </div>
            <p className="mt-5 text-[11px] text-zinc-500">Illustrative interface features; availability and user permissions depend on your subscription and account role.</p>
          </section>

          <section id="workflow" className="scroll-mt-6 border-y border-zinc-100 bg-[#fafafa] px-5 py-12 sm:px-10 lg:px-[7%]">
            <div className="grid gap-5 md:grid-cols-[1fr_1.5fr] md:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Getting started</p>
                <h2 className="mt-2 text-2xl font-extrabold tracking-tight">From plan to workspace</h2>
              </div>
              <ol className="grid gap-4 sm:grid-cols-3">
                {[
                  { step: "01", label: "Choose your plan" },
                  { step: "02", label: "Submit your request" },
                  { step: "03", label: "Approve & activate" },
                ].map((item) => <li key={item.step} className="flex items-center gap-3 text-xs font-semibold text-zinc-700"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-zinc-200 bg-white font-bold text-emerald-700">{item.step}</span>{item.label}</li>)}
              </ol>
            </div>
          </section>

          <section id="faq" className="scroll-mt-6 px-5 py-14 sm:px-10 lg:px-[7%]">
            <h2 className="text-2xl font-extrabold tracking-tight">Frequently asked questions</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {faq.map(({ q, a }) => (
                <details key={q} className="group rounded-xl border border-zinc-200 p-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">{q}<ChevronDown size={17} className="shrink-0 transition group-open:rotate-180" /></summary>
                  <p className="mt-3 text-xs leading-6 text-zinc-600">{a}</p>
                </details>
              ))}
            </div>
          </section>
        </main>

        <footer className="border-t border-zinc-100 px-5 pb-12 pt-14 sm:px-10 lg:px-[7%]">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.8fr_repeat(4,minmax(0,1fr))]">
            <div>
              <Link href="/welcome" className="inline-flex items-center gap-2 text-base font-extrabold">
                <span className="grid h-8 w-8 place-items-center rounded-full border border-zinc-800"><ShieldCheck size={17} /></span> VIMS
              </Link>
              <p className="mt-4 max-w-[245px] text-xs leading-6 text-zinc-500">The enterprise platform for digital vehicle inspection, safer fleet operations and accountable compliance.</p>
            </div>
            <FooterColumn title="Platform" items={[{ label: "Overview", href: "/welcome" }, { label: "Features", href: "#benefits" }, { label: "Pricing", href: "#pricing" }]} />
            <FooterColumn title="Organisation" items={[{ label: "Get started", href: "/subscribe" }, { label: "How it works", href: "#workflow" }, { label: "Login", href: "/login" }]} />
            <FooterColumn title="Resources" items={[{ label: "FAQs", href: "#faq" }, { label: "Plan comparison", href: "#compare-title" }, { label: "Subscriptions", href: "/subscribe" }]} />
            <FooterColumn title="Security" items={[{ label: "Tenant isolation", href: "#benefits" }, { label: "Plan access", href: "#compare-title" }, { label: "Secure sign in", href: "/login" }]} />
          </div>
          <div className="mt-14 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-6 text-[11px] text-zinc-500"><span>© {new Date().getFullYear()} VIMS. Vehicle Inspection Management System.</span><span>Secure inspection operations for modern organisations.</span></div>
        </footer>
      </div>
    </div>
  );
}

function FragmentGroup({ group, plans }: { group: FeatureGroup; plans: Plan[] }) {
  return <>
    <tr><th scope="colgroup" colSpan={plans.length + 1} className="pt-8 pb-3 text-xs font-extrabold text-[#1a1a1a]">{group.title}</th></tr>
    {group.rows.map((row) => (
      <tr key={row.label}>
        <th scope="row" className="border-t border-zinc-100 py-4 pr-3 align-middle text-xs font-semibold text-zinc-700">
          <span>{row.label}</span>
          {row.description && <span className="ml-1 cursor-help text-zinc-400" title={row.description} aria-label={row.description}>ⓘ</span>}
        </th>
        {plans.map((plan) => <td key={plan.id} className="border-t border-zinc-100 px-3 py-4 text-center text-xs"><ValueCell value={row.value(plan)} /></td>)}
      </tr>
    ))}
  </>;
}

function FooterColumn({ title, items }: { title: string; items: { label: string; href: string }[] }) {
  return <div><h3 className="text-xs font-extrabold">{title}</h3><nav aria-label={title + " links"} className="mt-4 flex flex-col gap-3">{items.map((item) => <Link key={item.label} href={item.href} className="text-xs text-zinc-600 hover:text-black">{item.label}</Link>)}</nav></div>;
}
