"use client";

import { useActionState, useState } from "react";
import { CalendarDays, Calculator, Percent, Tag } from "lucide-react";
import { calculateAnnualPlanPrice } from "@/lib/subscription-plan-pricing";
import { updateSubscriptionPlanPricing, type PlanPricingState } from "./actions";

const initial: PlanPricingState = { ok: false, message: "" };

type EditablePlan = {
  id: string;
  name: string;
  currency: string;
  price: string;
  billingCycle: "monthly" | "annual" | "custom";
  isActive: boolean;
  annualDiscountPercent: number;
  promoDiscountPercent: number;
  promoLabel: string | null;
  promoStartsOn: string | null;
  promoEndsOn: string | null;
};

export function PlanPricingForm({ plan }: { plan: EditablePlan }) {
  const [state, action, pending] = useActionState(updateSubscriptionPlanPricing, initial);
  const [price, setPrice] = useState(plan.price);
  const [billingCycle, setBillingCycle] = useState(plan.billingCycle);
  const [annualDiscountPercent, setAnnualDiscountPercent] = useState(plan.annualDiscountPercent);
  const [promoDiscountPercent, setPromoDiscountPercent] = useState(plan.promoDiscountPercent);
  const [promoLabel, setPromoLabel] = useState(plan.promoLabel || "");
  const [promoStartsOn, setPromoStartsOn] = useState(plan.promoStartsOn || "");
  const [promoEndsOn, setPromoEndsOn] = useState(plan.promoEndsOn || "");
  const ghanaPricing = plan.currency === "GHS";
  const monthly = billingCycle === "monthly";
  let quote: ReturnType<typeof calculateAnnualPlanPrice> = null;
  try {
    quote = calculateAnnualPlanPrice({
      price, billingCycle, currency: plan.currency, annualDiscountPercent,
      promoDiscountPercent, promoLabel, promoStartsOn: promoStartsOn || null,
      promoEndsOn: promoEndsOn || null,
    });
  } catch {
    // The server performs authoritative validation on submission.
  }

  return (
    <form action={action} className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm">
      <input type="hidden" name="planId" value={plan.id} />
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
        <div>
          <h3 className="text-base font-extrabold text-slate-950">{plan.name}</h3>
          <p className="mt-1 text-xs text-slate-500">Plan-level pricing for future subscribers · {plan.currency}</p>
        </div>
        <label className="text-xs font-semibold text-slate-700">
          New subscriptions
          <select name="isActive" defaultValue={plan.isActive ? "true" : "false"} disabled={!ghanaPricing || pending}
            className="ml-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-950">
            <option value="true">Available</option>
            <option value="false">Hidden</option>
          </select>
        </label>
      </div>
      <div className="grid gap-5 p-5 lg:grid-cols-[1fr_1fr_1fr]">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-600">
            <Calculator className="h-4 w-4 text-emerald-700" aria-hidden="true" /> Base pricing
          </div>
          <label className="block text-xs font-semibold text-slate-700">
            Monthly base price (GH₵)
            <input name="price" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal"
              required disabled={!ghanaPricing || pending}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-950" />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Billing cycle
            <select name="billingCycle" value={billingCycle}
              onChange={(e) => {
                const next = e.target.value as EditablePlan["billingCycle"];
                setBillingCycle(next);
                if (next !== "monthly") {
                  setAnnualDiscountPercent(0);
                  setPromoDiscountPercent(0);
                }
              }}
              disabled={!ghanaPricing || pending}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950">
              <option value="monthly">Monthly (annual auto-calculated)</option>
              <option value="annual">Legacy annual-only plan</option>
              <option value="custom">Custom quote</option>
            </select>
          </label>
          <div className="rounded-lg bg-emerald-50 px-3 py-3 text-xs leading-5 text-emerald-900">
            {monthly ? "Annual list price is automatically calculated as 12 × monthly price." : "Select Monthly to enable automatic annual prices and offers."}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-600">
            <Percent className="h-4 w-4 text-emerald-700" aria-hidden="true" /> Annual savings
          </div>
          <label className="block text-xs font-semibold text-slate-700">
            Annual discount (%)
            <input name="annualDiscountPercent" type="number" min={0} max={90} step={1}
              value={annualDiscountPercent} onChange={(e) => setAnnualDiscountPercent(Number(e.target.value))}
              disabled={!ghanaPricing || !monthly || pending}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-950" />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Promotional discount (%)
            <input name="promoDiscountPercent" type="number" min={0} max={90} step={1}
              value={promoDiscountPercent} onChange={(e) => setPromoDiscountPercent(Number(e.target.value))}
              disabled={!ghanaPricing || !monthly || pending}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-950" />
          </label>
          <div className="rounded-lg bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-600">
            Discounts are applied sequentially: annual discount first, then the active promotion on the remaining annual amount.
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-600">
            <Tag className="h-4 w-4 text-emerald-700" aria-hidden="true" /> Promotional campaign
          </div>
          <label className="block text-xs font-semibold text-slate-700">
            Promotional label
            <input name="promoLabel" value={promoLabel} maxLength={80} onChange={(e) => setPromoLabel(e.target.value)}
              disabled={!ghanaPricing || !monthly || pending} placeholder="e.g. Year-end offer"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-950" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-700">
              Starts (UTC)
              <input name="promoStartsOn" type="date" value={promoStartsOn} onChange={(e) => setPromoStartsOn(e.target.value)}
                disabled={!ghanaPricing || !monthly || pending}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-2 py-2.5 text-xs text-slate-950" />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Ends (UTC)
              <input name="promoEndsOn" type="date" value={promoEndsOn} onChange={(e) => setPromoEndsOn(e.target.value)}
                disabled={!ghanaPricing || !monthly || pending}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-2 py-2.5 text-xs text-slate-950" />
            </label>
          </div>
          <p className="flex items-start gap-2 text-xs leading-5 text-slate-500">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Optional dates. If omitted, a nonzero promo remains active until you disable it.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-4 border-t border-slate-100 bg-[#f7faf9] px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <div><span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Annual list</span>
            <span className="text-base font-bold text-slate-800">{quote ? "GH₵ " + quote.baseAnnualPrice : "Custom quote"}</span>
          </div>
          <div><span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Current annual offer</span>
            <span className="text-xl font-extrabold text-emerald-800">{quote ? "GH₵ " + quote.annualPrice : "Custom quote"}</span>
          </div>
          {quote && quote.savingsMinor > 0 && <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">Save GH₵ {quote.savingsPrice} / year</span>}
          {quote?.activePromoLabel && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">{quote.activePromoLabel}</span>}
        </div>
        <button type="submit" disabled={!ghanaPricing || pending}
          className="rounded-xl bg-slate-950 px-6 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-50">
          {pending ? "Saving pricing…" : "Save pricing and promotion"}
        </button>
      </div>
      {state.message && <p role={state.ok ? "status" : "alert"} className={"border-t border-slate-100 px-5 py-3 text-sm " + (state.ok ? "text-emerald-700" : "text-red-700")}>{state.message}</p>}
      {!ghanaPricing && <p className="px-5 py-3 text-xs text-amber-800">Only GHS plans are managed here.</p>}
    </form>
  );
}
