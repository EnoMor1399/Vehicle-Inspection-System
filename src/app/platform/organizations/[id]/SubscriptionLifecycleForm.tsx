"use client";

import { useActionState } from "react";
import { Loader2, Save, ShieldAlert } from "lucide-react";
import {
  updateSubscriberSubscription,
  type SubscriptionLifecycleActionState,
} from "../actions";

type PlanOption = {
  code: string;
  name: string;
  maxUsers: number;
  maxStations: number;
  maxVehicles: number;
  maxInspectionsPerMonth: number;
  modules: string[];
};

type CurrentSubscription = {
  planCode: string;
  status: string;
  amount: string;
  currency: string;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  graceEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  notes: string | null;
};

const initialState: SubscriptionLifecycleActionState = { ok: false, message: "" };

function dateTimeValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

export function SubscriptionLifecycleForm({
  organizationId,
  plans,
  current,
}: {
  organizationId: string;
  plans: PlanOption[];
  current: CurrentSubscription;
}) {
  const [state, action, pending] = useActionState(updateSubscriberSubscription, initialState);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="organizationId" value={organizationId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Subscription plan">
          <select name="planCode" defaultValue={current.planCode} className={inputClass}>
            {plans.map((plan) => (
              <option key={plan.code} value={plan.code}>
                {plan.name} · {plan.maxUsers} users · {plan.maxVehicles.toLocaleString()} vehicles
              </option>
            ))}
          </select>
        </Field>

        <Field label="Subscription status">
          <select name="status" defaultValue={current.status} className={inputClass}>
            <option value="trialing">Trialing</option>
            <option value="active">Active</option>
            <option value="past_due">Past due</option>
            <option value="grace">Grace period</option>
            <option value="suspended">Suspended</option>
            <option value="cancelled">Cancelled</option>
            <option value="expired">Expired</option>
          </select>
        </Field>

        <Field label="Amount">
          <input
            name="amount"
            inputMode="decimal"
            defaultValue={current.amount}
            className={inputClass}
            placeholder="0.00"
          />
        </Field>

        <Field label="Currency">
          <input
            name="currency"
            defaultValue={current.currency}
            maxLength={3}
            className={inputClass}
            placeholder="GHS"
          />
        </Field>

        <Field label="Current period end">
          <input
            name="currentPeriodEnd"
            type="datetime-local"
            defaultValue={dateTimeValue(current.currentPeriodEnd)}
            className={inputClass}
          />
        </Field>

        <Field label="Trial ends">
          <input
            name="trialEndsAt"
            type="datetime-local"
            defaultValue={dateTimeValue(current.trialEndsAt)}
            className={inputClass}
          />
        </Field>

        <Field label="Grace period ends">
          <input
            name="graceEndsAt"
            type="datetime-local"
            defaultValue={dateTimeValue(current.graceEndsAt)}
            className={inputClass}
          />
        </Field>

        <label className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700">
          <input
            type="checkbox"
            name="cancelAtPeriodEnd"
            defaultChecked={current.cancelAtPeriodEnd}
            className="h-4 w-4 rounded border-slate-300 text-emerald-700"
          />
          Cancel at period end
        </label>
      </div>

      <Field label="Subscription notes">
        <textarea
          name="notes"
          rows={4}
          maxLength={4000}
          defaultValue={current.notes || ""}
          className={inputClass}
          placeholder="Commercial terms, renewal notes, support context or other internal notes..."
        />
      </Field>

      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        Plan reductions are blocked when current users, stations, vehicles, or monthly inspections exceed the target plan. Plan or status changes revoke active organization sessions so new entitlements take effect immediately.
      </div>

      {state.message && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            state.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {state.message}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {pending ? "Saving…" : "Save subscription"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  );
}
