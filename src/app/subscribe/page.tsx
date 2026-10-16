import Link from "next/link";
import { ArrowLeft, Building2, CheckCircle2, ShieldCheck } from "lucide-react";
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

        <div className="mt-8 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800">
              <Building2 className="h-4 w-4" /> Multi-organization VIMS
            </span>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">A dedicated VIMS workspace for your organization.</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
              Subscribe with organization-specific branding, administrators, modules and capacity limits. Vehicle Inspection and Driver Training administrations remain separate, while subscription ownership is managed independently.
            </p>

            <div className="mt-7 space-y-3">
              {[
                "Isolated organization identity and controlled provisioning",
                "Vehicle Inspection and Driver Training administration separation",
                "Subscription plans with user, station, vehicle and inspection limits",
                "Organization-specific branding, security and notification settings",
                "One-time administrator invitations with expiring tokens",
                "Operational access unlocked only after tenant isolation verification",
              ].map((item) => (
                <div key={item} className="flex gap-3 text-sm leading-6 text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> {item}
                </div>
              ))}
            </div>

            <div className="mt-8 grid gap-3">
              {plans.map((plan) => (
                <div key={plan.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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

            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
              Subscription approval does not bypass security review. A new company cannot see RSL or another subscriber’s operational records while provisioning is incomplete.
            </div>
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
