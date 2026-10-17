import Link from "next/link";
import { ArrowLeft, Building2, CheckCircle2, ChevronDown, ShieldCheck } from "lucide-react";
import { listSubscriptionPlans } from "@/lib/organization-control-plane";
import { SubscribeForm } from "./SubscribeForm";

export const dynamic = "force-dynamic";

export default async function SubscribePage() {
  const plans = await listSubscriptionPlans();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:py-12">
      <div className="mx-auto max-w-7xl">
        <Link href="/login" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950">
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>

        <div className="mt-7 grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800">
              <Building2 className="h-4 w-4" /> Multi-organization VIMS
            </span>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">VIMS for your organization.</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
              A secure, dedicated workspace with flexible subscription plans and separate operational administration.
            </p>

            <div className="mt-6 space-y-2.5">
              {[
                "Private company workspace",
                "Independent inspection and training administration",
                "Configurable capacity and permissions",
              ].map((item) => (
                <div key={item} className="flex gap-2.5 text-sm leading-6 text-slate-700">
                  <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" /> {item}
                </div>
              ))}
            </div>

            <details className="group mt-7 rounded-xl border border-slate-200 bg-white p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
                Compare plans and prices
                <ChevronDown className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-4 grid gap-3">
                {plans.map((plan) => (
                  <div key={plan.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-semibold text-slate-950">{plan.name}</h2>
                        <p className="mt-1 text-sm text-slate-500">{plan.description}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {Number(plan.price) > 0 ? `${plan.currency} ${Number(plan.price).toLocaleString()}` : "Custom quote"}
                      </span>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">{plan.maxUsers} users · {plan.maxStations} stations · {plan.maxVehicles.toLocaleString()} vehicles · {plan.trialDays}-day trial policy</p>
                  </div>
                ))}
              </div>
            </details>

            <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-slate-500">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
              Operational access begins only after organization identity and tenant isolation checks are complete.
            </p>
          </div>

          <SubscribeForm plans={plans.map((plan) => ({
            code: plan.code,
            name: plan.name,
            description: plan.description,
            price: String(plan.price),
            currency: plan.currency,
            billingCycle: plan.billingCycle,
            trialDays: plan.trialDays,
            maxUsers: plan.maxUsers,
            maxStations: plan.maxStations,
            maxVehicles: plan.maxVehicles,
            modules: plan.modules,
          }))} />
        </div>
      </div>
    </main>
  );
}
