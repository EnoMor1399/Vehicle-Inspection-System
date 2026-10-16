"use client";

import { useActionState } from "react";
import { Building2, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { submitSubscriptionRequest, type SubscriptionRequestState } from "./actions";

type Plan = {
  code: string;
  name: string;
  description: string | null;
  price: string;
  currency: string;
  billingCycle: string;
  trialDays: number;
  maxUsers: number;
  maxStations: number;
  maxVehicles: number;
  modules: string[];
};

const initialState: SubscriptionRequestState = { ok: false, message: "" };

export function SubscribeForm({ plans }: { plans: Plan[] }) {
  const [state, action, pending] = useActionState(submitSubscriptionRequest, initialState);

  if (state.ok) {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-7 shadow-sm">
        <CheckCircle2 className="h-10 w-10 text-emerald-700" />
        <h2 className="mt-4 text-2xl font-semibold text-emerald-950">Request received</h2>
        <p className="mt-2 text-sm leading-6 text-emerald-900">{state.message}</p>
        {state.requestId && <p className="mt-3 text-xs font-medium text-emerald-800">Reference: {state.requestId}</p>}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div>
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-slate-950 text-white"><Building2 className="h-5 w-5" /></span>
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Company subscription request</h2>
            <p className="text-sm text-slate-500">Tell us about the organization and the capacity you need.</p>
          </div>
        </div>
      </div>

      {state.message && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{state.message}</div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company name"><input name="companyName" required maxLength={255} className={inputClass} /></Field>
        <Field label="Contact person"><input name="contactName" required maxLength={200} className={inputClass} /></Field>
        <Field label="Work email"><input name="contactEmail" type="email" required maxLength={200} className={inputClass} /></Field>
        <Field label="Phone"><input name="contactPhone" maxLength={50} className={inputClass} /></Field>
        <Field label="Country"><input name="country" defaultValue="Ghana" required maxLength={100} className={inputClass} /></Field>
        <Field label="Industry"><input name="industry" maxLength={120} placeholder="Transport, inspection, fleet, logistics…" className={inputClass} /></Field>
        <Field label="Estimated users"><input name="estimatedUsers" type="number" min={1} max={100000} defaultValue={10} className={inputClass} /></Field>
        <Field label="Estimated vehicles"><input name="estimatedVehicles" type="number" min={0} max={10000000} defaultValue={100} className={inputClass} /></Field>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Preferred plan</label>
        <select name="desiredPlanCode" className={inputClass} defaultValue={plans[0]?.code || "starter"}>
          {plans.map((plan) => (
            <option key={plan.code} value={plan.code}>
              {plan.name} · up to {plan.maxUsers} users · {plan.maxVehicles.toLocaleString()} vehicles
            </option>
          ))}
        </select>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">Required modules</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Check name="requestedModules" value="vehicle_inspection" label="Vehicle Inspection Administration" defaultChecked />
          <Check name="requestedModules" value="driver_training" label="Driver Training & Assessment" />
          <Check name="requestedModules" value="reports" label="Reports & Analytics" defaultChecked />
          <Check name="requestedModules" value="api" label="API & Integrations" />
        </div>
      </div>

      <Field label="Additional requirements">
        <textarea name="notes" rows={4} maxLength={4000} className={inputClass} placeholder="Sites, departments, workflow, integrations, compliance or rollout requirements…" />
      </Field>

      <input name="website" className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />

      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <p>Each subscriber receives a separate organization identity, subscription policy and administrator lifecycle. Operational access remains locked until the tenant data boundary is provisioned and verified.</p>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
        {pending ? "Submitting…" : "Request VIMS subscription"}
      </button>
    </form>
  );
}

const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>{children}</label>;
}

function Check({ name, value, label, defaultChecked = false }: { name: string; value: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700">
      <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} className="h-4 w-4 rounded border-slate-300 text-emerald-700" />
      {label}
    </label>
  );
}
