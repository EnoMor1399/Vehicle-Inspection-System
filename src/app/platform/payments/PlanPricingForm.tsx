"use client";

import { useActionState } from "react";
import { updateSubscriptionPlanPricing, type PlanPricingState } from "./actions";

const initial: PlanPricingState = { ok: false, message: "" };

export function PlanPricingForm({
  plan,
}: {
  plan: {
    id: string;
    name: string;
    currency: string;
    price: string;
    billingCycle: "monthly" | "annual" | "custom";
    isActive: boolean;
  };
}) {
  const [state, action, pending] = useActionState(updateSubscriptionPlanPricing, initial);
  const ghanaPricing = plan.currency === "GHS";

  return (
    <form action={action} className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-[minmax(120px,2fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(130px,1fr)_auto] sm:items-end">
      <input type="hidden" name="planId" value={plan.id}/>
      <div>
        <p className="text-sm font-bold text-slate-950">{plan.name}</p>
        <p className="text-xs text-slate-500">Catalog price for future subscriber subscriptions</p>
      </div>
      <label className="text-xs font-semibold text-slate-700">
        GHS price
        <input name="price" defaultValue={plan.price} inputMode="decimal" required disabled={!ghanaPricing || pending}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-950"/>
      </label>
      <label className="text-xs font-semibold text-slate-700">
        Billing cycle
        <select name="billingCycle" defaultValue={plan.billingCycle} disabled={!ghanaPricing || pending}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-950">
          <option value="monthly">Monthly</option>
          <option value="annual">Annual</option>
          <option value="custom">Custom</option>
        </select>
      </label>
      <label className="text-xs font-semibold text-slate-700">
        New assignments
        <select name="isActive" defaultValue={plan.isActive ? "true" : "false"} disabled={!ghanaPricing || pending}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-950">
          <option value="true">Available</option>
          <option value="false">Hidden</option>
        </select>
      </label>
      <button type="submit" disabled={!ghanaPricing || pending}
        className="rounded-lg bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">
        {pending ? "Saving…" : "Update plan"}
      </button>
      {state.message && <p role={state.ok ? "status" : "alert"} className={`text-xs sm:col-span-5 ${state.ok ? "text-emerald-700" : "text-red-700"}`}>{state.message}</p>}
      {!ghanaPricing && <p className="text-xs text-amber-800 sm:col-span-5">Only GHS plans can be managed here.</p>}
    </form>
  );
}
