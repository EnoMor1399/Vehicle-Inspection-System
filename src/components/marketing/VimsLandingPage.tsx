import Link from "next/link";
import {
  ArrowRight, BarChart3, Building2,
  CalendarCheck2, Check, CheckCircle2, ChevronDown, ClipboardCheck,
  FileCheck2, Fingerprint, Globe2, GraduationCap, Layers3, LockKeyhole,
  MapPinned, Shield, ShieldCheck, Sparkles, Truck, Users,
  Zap,
} from "lucide-react";
import type { subscriptionPlans } from "@/db/schema";

type Plan = typeof subscriptionPlans.$inferSelect;

const benefits = [
  {
    icon: ClipboardCheck,
    title: "Complete digital inspections",
    copy: "Standardise vehicle assessments, record findings, capture evidence and guide inspectors through consistent checklists.",
  },
  {
    icon: Truck,
    title: "Fleet & transporter records",
    copy: "Keep vehicles, transporters, inspection histories and compliance documents organised in one workspace.",
  },
  {
    icon: FileCheck2,
    title: "Certificates & verification",
    copy: "Support inspection approvals, digital certificates and QR-based verification with traceable records.",
  },
  {
    icon: GraduationCap,
    title: "Driver training & assessment",
    copy: "Manage training and assessment workflows when the Driver Training module is included in your plan.",
  },
  {
    icon: BarChart3,
    title: "Reports that drive decisions",
    copy: "Review inspection performance, defects and compliance trends with operational reports and analytics.",
  },
  {
    icon: ShieldCheck,
    title: "Secure organisation workspaces",
    copy: "Separate company data with role-based permissions, audit trails and controlled workspace activation.",
  },
] as const;

const moduleNames: Record<string, string> = {
  vehicle_inspection: "Vehicle inspection operations",
  driver_training: "Driver training & assessment",
  reports: "Reports & analytics",
  api: "API & integrations",
};

function readablePrice(plan: Plan): { value: string; period: string } {
  const price = Number(plan.price);
  if (!Number.isFinite(price) || price <= 0 || plan.billingCycle === "custom") {
    return { value: "Custom quote", period: "Tailored to your organisation" };
  }
  const symbol = plan.currency === "GHS" ? "GH₵" : `${plan.currency} `;
  const value = new Intl.NumberFormat("en-GH", { maximumFractionDigits: 2, minimumFractionDigits: price % 1 ? 2 : 0 }).format(price);
  return {
    value: `${symbol}${value}`,
    period: plan.billingCycle === "annual" ? "/ year" : "/ month",
  };
}

function planHighlights(plan: Plan) {
  const values = [
    ...plan.modules.map((code) => moduleNames[code] || code.replaceAll("_", " ")),
  ];
  if (plan.features?.custom_branding) values.push("Organisation branding");
  if (plan.features?.priority_support) values.push("Priority support");
  return [...new Set(values)];
}

const faq = [
  {
    question: "Can I inspect vehicles from multiple stations?",
    answer: "Yes. Every package has its own station and vehicle capacity. Select the package that fits the scale of your inspection operations.",
  },
  {
    question: "Can I add employees and control their permissions?",
    answer: "Organisation administrators can provision employees within their organisation, subject to the plan's user limit. Role-based permissions and audit controls help safeguard your records.",
  },
  {
    question: "Is Driver Training included in every plan?",
    answer: "No. Each card shows the modules included in that package. Driver Training & Assessment is available only on plans that list that module.",
  },
  {
    question: "Will my organisation's data be isolated?",
    answer: "Each subscriber has an organisation-scoped workspace. Operational access is enabled only after platform approval and tenant-isolation verification.",
  },
  {
    question: "Can I pay immediately after choosing a package?",
    answer: "A subscription request is first reviewed by a platform administrator. Any subsequent payment or checkout requires the applicable subscription approval and payment configuration. Submitting the form is not a payment.",
  },
] as const;

export function VimsLandingPage({ plans }: { plans: Plan[] }) {
  const featuredCode = plans.some((plan) => plan.code === "professional") ? "professional" : plans[0]?.code;
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f6f8fb] text-[#0b1b30]">
      <header className="relative z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-4 sm:px-7 lg:px-10">
          <Link href="/welcome" className="flex min-w-0 items-center gap-3" aria-label="VIMS home">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-[#0c2434] text-emerald-300 shadow-sm">
              <ShieldCheck aria-hidden="true" className="h-6 w-6" />
            </span>
            <span className="flex flex-col">
              <span className="text-[20px] font-black leading-tight tracking-[-0.04em] text-[#09233a]">VIMS<span className="text-emerald-600">.</span></span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Inspection Management</span>
            </span>
          </Link>
          <nav aria-label="Landing page" className="hidden items-center gap-7 text-sm font-semibold text-slate-600 lg:flex">
            <a href="#benefits" className="hover:text-emerald-700">Benefits</a>
            <a href="#workflow" className="hover:text-emerald-700">How it works</a>
            <a href="#pricing" className="hover:text-emerald-700">Packages</a>
            <a href="#faq" className="hover:text-emerald-700">FAQs</a>
          </nav>
          <div className="hidden items-center gap-3 sm:flex">
            <Link href="/login" className="rounded-xl px-4 py-2.5 text-sm font-semibold text-[#17384e] hover:bg-slate-100">
              Sign in
            </Link>
            <Link href="/subscribe" className="inline-flex items-center gap-2 rounded-xl bg-[#087f5b] px-5 py-3 text-sm font-bold text-white shadow-[0_8px_20px_rgba(5,150,105,.14)] transition hover:bg-[#086948]">
              Request access <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <details className="group relative sm:hidden">
            <summary className="flex cursor-pointer list-none items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
              Menu <ChevronDown aria-hidden="true" className="h-4 w-4 transition group-open:rotate-180" />
            </summary>
            <nav aria-label="Mobile landing page" className="absolute right-0 top-12 z-30 flex w-52 flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
              <a className="rounded-lg px-3 py-2 hover:bg-slate-50" href="#benefits">Benefits</a>
              <a className="rounded-lg px-3 py-2 hover:bg-slate-50" href="#workflow">How it works</a>
              <a className="rounded-lg px-3 py-2 hover:bg-slate-50" href="#pricing">Packages</a>
              <a className="rounded-lg px-3 py-2 hover:bg-slate-50" href="#faq">FAQs</a>
              <Link className="rounded-lg px-3 py-2 hover:bg-slate-50" href="/login">Sign in</Link>
              <Link className="rounded-lg bg-emerald-700 px-3 py-2 font-semibold text-white" href="/subscribe">Request subscription</Link>
            </nav>
          </details>
        </div>
      </header>

      <main>
        <section className="relative isolate overflow-hidden bg-[#092131] text-white">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_80%_20%,rgba(16,185,129,.16),transparent_45%),linear-gradient(135deg,#0b2637_2%,#081b2d_55%,#092538_100%)]" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 top-10 -z-10 h-96 w-96 rounded-full border border-white/10" />
          <div aria-hidden="true" className="pointer-events-none absolute right-10 top-32 -z-10 h-64 w-64 rounded-full border border-white/10" />
          <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-16 sm:px-7 sm:pt-20 lg:grid-cols-[1.02fr_.98fr] lg:gap-12 lg:px-10 lg:pb-24 lg:pt-24">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-4 py-2 text-xs font-bold tracking-wide text-emerald-200">
                <Sparkles aria-hidden="true" className="h-4 w-4" />
                An enterprise platform for safer fleets
              </span>
              <h1 className="mt-7 max-w-2xl text-[clamp(2.8rem,5vw,4.65rem)] font-extrabold leading-[1.07] tracking-[-0.055em]">
                Safer vehicles.<br />
                <span className="text-emerald-300">Smarter inspections.</span><br />
                Better decisions.
              </h1>
              <p className="mt-7 max-w-xl text-base leading-8 text-slate-300 sm:text-lg">
                Bring vehicle inspection, compliance, fleet records, digital certification and performance reporting together in one secure, organisation-ready workspace.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <a href="#pricing" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-6 py-3 text-sm font-extrabold text-[#063f35] transition hover:bg-emerald-300">
                  Explore subscription packages <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </a>
                <Link href="/subscribe" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/25 px-6 py-3 text-sm font-semibold text-white hover:border-white/60 hover:bg-white/5">
                  Request a workspace
                </Link>
              </div>
              <div className="mt-11 flex flex-wrap gap-x-6 gap-y-3 text-xs font-medium text-slate-300">
                <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-300" /> Organisation data isolation</span>
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-300" /> Audit-ready operations</span>
                <span className="inline-flex items-center gap-2"><Globe2 className="h-4 w-4 text-emerald-300" /> Web-based access</span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[570px]">
              <div className="absolute -left-5 bottom-12 h-32 w-32 rounded-full bg-emerald-400/15 blur-3xl" aria-hidden="true" />
              <div className="relative overflow-hidden rounded-[27px] border border-white/15 bg-white/95 p-3 text-[#12263a] shadow-[0_30px_75px_rgba(0,0,0,.25)] sm:p-4">
                <div className="flex items-center justify-between gap-3 rounded-[18px] bg-[#10293b] px-4 py-4 text-white">
                  <span className="inline-flex items-center gap-2 text-sm font-extrabold"><span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-400/15"><Layers3 className="h-4 w-4 text-emerald-300" /></span> VIMS Workspace</span>
                  <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[10px] font-semibold text-emerald-200">Workflow preview</span>
                </div>
                <div className="p-2 sm:p-3">
                  <div className="flex items-center justify-between gap-3 py-3">
                    <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Operations overview</p><p className="mt-1 text-lg font-extrabold tracking-tight">Built for real inspections</p></div>
                    <span className="rounded-lg bg-emerald-50 p-2.5 text-emerald-700"><ActivityIcon /></span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <PreviewTile icon={Truck} title="Fleet records" detail="Organised & searchable" />
                    <PreviewTile icon={CalendarCheck2} title="Appointments" detail="Inspection scheduling" />
                    <PreviewTile icon={FileCheck2} title="Certificates" detail="Digital verification" />
                    <PreviewTile icon={BarChart3} title="Analytics" detail="Reports & insights" />
                  </div>
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-slate-800">Inspection workflow</span>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-500">Illustrative preview</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {["Register", "Inspect", "Approve", "Certify"].map((step, index) => (
                        <div key={step} className="text-center">
                          <span className={`mx-auto grid h-9 w-9 place-items-center rounded-full text-xs font-extrabold ${index < 3 ? "bg-emerald-100 text-emerald-700" : "bg-white text-slate-500 ring-1 ring-slate-200"}`}>
                            {index < 3 ? <Check aria-hidden="true" className="h-4 w-4" /> : "4"}
                          </span>
                          <span className="mt-2 block text-[10px] font-semibold text-slate-600">{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-center text-xs text-slate-400">Illustrative interface — not live inspection or customer data</p>
            </div>
          </div>
        </section>

        <section aria-label="VIMS capabilities" className="border-b border-slate-200 bg-white">
          <div className="mx-auto grid max-w-7xl gap-5 px-5 py-7 sm:grid-cols-2 sm:px-7 lg:grid-cols-4 lg:px-10">
            {[
              { icon: ClipboardCheck, label: "Vehicle inspections" },
              { icon: Shield, label: "Roadworthiness & compliance" },
              { icon: FileCheck2, label: "Digital certificates" },
              { icon: BarChart3, label: "Operational intelligence" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3 text-sm font-bold text-slate-600"><Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-emerald-700" />{label}</div>
            ))}
          </div>
        </section>

        <section id="benefits" className="scroll-mt-20 px-5 py-20 sm:px-7 lg:px-10 lg:py-24">
          <div className="mx-auto max-w-7xl">
            <SectionIntro eyebrow="Why organisations choose VIMS" title="One connected platform. Clearer control at every step."
              body="Replace fragmented records and manual follow-ups with a structured digital system built for inspection centres, fleet operators, transport businesses and training providers." />
            <div className="mt-11 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {benefits.map(({ icon: Icon, title, copy }) => (
                <article key={title} className="group rounded-[22px] border border-slate-200 bg-white p-7 shadow-[0_10px_30px_rgba(20,35,55,.035)] transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-[0_18px_42px_rgba(20,35,55,.08)]">
                  <div className="grid h-13 w-13 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><Icon aria-hidden="true" className="h-6 w-6" /></div>
                  <h3 className="mt-6 text-lg font-extrabold tracking-tight text-slate-900">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{copy}</p>
                </article>
              ))}
            </div>
            <p className="mt-6 text-xs text-slate-500">Available modules and capacity depend on your selected subscription.</p>
          </div>
        </section>

        <section id="workflow" className="scroll-mt-20 bg-white px-5 py-20 sm:px-7 lg:px-10 lg:py-24">
          <div className="mx-auto max-w-7xl">
            <SectionIntro eyebrow="Simple, controlled onboarding" title="From enquiry to inspection-ready."
              body="Choose the level that matches your operations and request a dedicated company workspace. Activation follows a deliberate review and security process." />
            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {[
                { number: "01", icon: Layers3, title: "Explore your package", body: "Compare users, stations, vehicles, inspection limits and included modules across the active packages." },
                { number: "02", icon: Building2, title: "Request a subscription", body: "Send your organisation details and preferred plan through the secure request form." },
                { number: "03", icon: LockKeyhole, title: "Approve & activate", body: "A platform administrator reviews provisioning, invitations and tenant isolation before enabling operations." },
              ].map(({ number, icon: Icon, title, body }) => (
                <article key={number} className="relative rounded-2xl border border-slate-200 bg-[#f8fafc] p-7">
                  <div className="flex items-center justify-between">
                    <span className="text-4xl font-extrabold tracking-[-0.07em] text-emerald-200">{number}</span>
                    <Icon aria-hidden="true" className="h-7 w-7 text-emerald-700" />
                  </div>
                  <h3 className="mt-7 text-lg font-extrabold text-slate-900">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="scroll-mt-20 px-5 py-20 sm:px-7 lg:px-10 lg:py-24">
          <div className="mx-auto max-w-7xl">
            <SectionIntro eyebrow="Flexible subscriptions" title="A package for every stage of growth."
              body="Transparent plan details from the current VIMS subscription catalogue. Compare actual limits and module access before sending your request." />
            {plans.length > 0 ? (
              <div className="mt-12 grid items-stretch gap-6 lg:grid-cols-3">
                {plans.map((plan) => {
                  const featured = plan.code === featuredCode;
                  const price = readablePrice(plan);
                  return (
                    <article key={plan.id} className={`relative flex flex-col overflow-hidden rounded-[26px] border bg-white shadow-[0_14px_40px_rgba(20,35,55,.055)] ${featured ? "border-emerald-500 ring-1 ring-emerald-500 shadow-[0_18px_44px_rgba(5,150,105,.12)]" : "border-slate-200"}`}>
                      {featured && <div className="bg-emerald-700 px-4 py-2 text-center text-xs font-extrabold uppercase tracking-[.1em] text-white">Popular for growing teams</div>}
                      <div className="flex flex-1 flex-col p-7 sm:p-8">
                        <div className="flex items-center justify-between gap-3">
                          <span className="grid h-11 w-11 place-items-center rounded-[15px] bg-emerald-50 text-emerald-700"><Layers3 aria-hidden="true" className="h-5 w-5" /></span>
                          {plan.trialDays > 0 && <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600">{plan.trialDays}-day trial policy</span>}
                        </div>
                        <h3 className="mt-6 text-2xl font-extrabold tracking-tight text-slate-900">{plan.name}</h3>
                        <p className="mt-3 min-h-14 text-sm leading-7 text-slate-600">{plan.description || "A flexible VIMS package for your operations."}</p>
                        <div className="mt-7 flex min-h-17 flex-col justify-center border-b border-slate-200 pb-7">
                          <p className="text-[32px] font-black leading-tight tracking-[-0.045em] text-[#102b3d]">{price.value}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">{price.period}</p>
                        </div>
                        <p className="mt-6 text-xs font-bold uppercase tracking-wider text-slate-500">Package capacity</p>
                        <dl className="mt-4 grid grid-cols-2 gap-4 rounded-2xl bg-slate-50 p-4">
                          <CapacityItem label="Users" value={plan.maxUsers} icon={Users} />
                          <CapacityItem label="Stations" value={plan.maxStations} icon={MapPinned} />
                          <CapacityItem label="Vehicles" value={plan.maxVehicles} icon={Truck} />
                          <CapacityItem label="Inspections / mo." value={plan.maxInspectionsPerMonth} icon={ClipboardCheck} />
                        </dl>
                        <p className="mt-7 text-xs font-bold uppercase tracking-wider text-slate-500">Included with this plan</p>
                        <ul className="mt-4 flex-1 space-y-3">
                          {planHighlights(plan).map((item) => (
                            <li key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                              <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700"><Check aria-hidden="true" className="h-3.5 w-3.5" /></span>
                              {item}
                            </li>
                          ))}
                        </ul>
                        <Link href={`/subscribe?plan=${encodeURIComponent(plan.code)}`}
                          className={`mt-9 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-extrabold transition ${featured ? "bg-[#087f5b] text-white hover:bg-[#086747]" : "border border-slate-300 bg-[#0d2436] text-white hover:bg-[#18384e]"}`}>
                          Request {plan.name} <ArrowRight aria-hidden="true" className="h-4 w-4" />
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-8 text-center">
                <h3 className="text-xl font-extrabold">Subscription packages are being updated</h3>
                <p className="mt-2 text-sm text-slate-600">You can still request a tailored VIMS proposal for your organisation.</p>
                <Link href="/subscribe" className="mt-6 inline-flex rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white">Request a proposal</Link>
              </div>
            )}
            <p className="mx-auto mt-7 max-w-3xl text-center text-xs leading-6 text-slate-500">
              Prices, modules and limits are sourced from the active VIMS plan catalogue and may change. A request is subject to administrative approval; no payment is collected on this page. Trial duration indicates plan policy, not immediate activation.
            </p>
          </div>
        </section>

        <section className="bg-[#0d2736] px-5 py-16 text-white sm:px-7 lg:px-10">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-7 lg:flex-row lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-300"><Fingerprint className="h-4 w-4" aria-hidden="true" /> Security by design</span>
              <h2 className="mt-3 max-w-2xl text-2xl font-extrabold tracking-tight sm:text-3xl">Your operations. Your people. Your organisation’s data.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">Role-aware accounts, audit history and controlled organisation activation help protect critical inspection workflows.</p>
            </div>
            <Link href="/subscribe" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-extrabold text-[#0b2834] hover:bg-emerald-50">
              Get your workspace <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section id="faq" className="scroll-mt-20 bg-white px-5 py-20 sm:px-7 lg:px-10 lg:py-24">
          <div className="mx-auto max-w-4xl">
            <SectionIntro eyebrow="Frequently asked questions" title="Everything you need before getting started."
              body="Clear answers on package access, team management, subscription requests and organisation security." centered />
            <div className="mt-10 space-y-3">
              {faq.map(({ question, answer }) => (
                <details key={question} className="group rounded-2xl border border-slate-200 bg-white px-5 py-5 open:border-emerald-200 open:bg-emerald-50/20 sm:px-6">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-extrabold text-slate-900 [&::-webkit-details-marker]:hidden sm:text-base">
                    {question} <ChevronDown aria-hidden="true" className="h-5 w-5 shrink-0 text-emerald-700 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-16 sm:px-7 lg:px-10">
          <div className="mx-auto max-w-7xl rounded-[28px] bg-[linear-gradient(125deg,#0c3140,#116a59)] px-7 py-12 text-white sm:px-12 lg:flex lg:items-center lg:justify-between lg:gap-12">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-200">Ready to modernise?</p>
              <h2 className="mt-3 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">Give your inspection team a better way to work.</h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-emerald-50/85">Tell us what your organisation needs. We’ll help you select the appropriate VIMS subscription.</p>
            </div>
            <Link href="/subscribe" className="mt-7 inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-extrabold text-[#0b403e] hover:bg-emerald-50 lg:mt-0">
              Request subscription <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white px-5 py-9 sm:px-7 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#09283a] text-emerald-300"><ShieldCheck className="h-5 w-5" /></span><span><span className="block text-sm font-extrabold text-slate-900">VIMS Enterprise</span><span className="block text-xs text-slate-500">Vehicle Inspection Management System</span></span></div>
          <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-6 gap-y-3 text-xs font-semibold text-slate-600">
            <a href="#benefits" className="hover:text-emerald-700">Benefits</a>
            <a href="#pricing" className="hover:text-emerald-700">Packages</a>
            <Link href="/subscribe" className="hover:text-emerald-700">Request access</Link>
            <Link href="/login" className="hover:text-emerald-700">Sign in</Link>
          </nav>
          <p className="text-xs text-slate-500">© {new Date().getFullYear()} VIMS</p>
        </div>
      </footer>
    </div>
  );
}

function ActivityIcon() {
  return <Zap aria-hidden="true" className="h-5 w-5" />;
}

function PreviewTile({ icon: Icon, title, detail }: { icon: typeof Truck; title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2 text-emerald-700"><Icon aria-hidden="true" className="h-4 w-4" /><span className="text-[11px] font-extrabold text-slate-800">{title}</span></div>
      <p className="mt-2 text-[10px] leading-4 text-slate-500">{detail}</p>
    </div>
  );
}

function CapacityItem({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Users }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500"><Icon aria-hidden="true" className="h-3.5 w-3.5 text-emerald-700" />{label}</dt>
      <dd className="mt-1 text-lg font-extrabold text-slate-900">{value.toLocaleString("en-GH")}</dd>
    </div>
  );
}

function SectionIntro({ eyebrow, title, body, centered = false }: {
  eyebrow: string; title: string; body: string; centered?: boolean;
}) {
  return (
    <div className={centered ? "text-center" : ""}>
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-700">{eyebrow}</p>
      <h2 className={`mt-4 max-w-3xl text-3xl font-extrabold leading-tight tracking-[-0.045em] text-[#0d2738] sm:text-4xl ${centered ? "mx-auto" : ""}`}>{title}</h2>
      <p className={`mt-5 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base ${centered ? "mx-auto" : ""}`}>{body}</p>
    </div>
  );
}
