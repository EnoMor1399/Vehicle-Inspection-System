"use client";

import { useActionState } from "react";
import type { ReactNode } from "react";
import { CheckCircle2, Loader2, Save, Send, RotateCcw } from "lucide-react";
import { saveSubscriptionPackage, updatePlatformCopy, type CentreActionState } from "./actions";

const initial: CentreActionState = { ok: false, message: "" };

type CopyField = {
  key: string; label: string; area: string; maxLength: number; defaultText: string;
  draft: string; published: string | null; revision: number;
  publishedAt: Date | null; updatedAt: Date | null;
};

export function PlatformContentEditor({ item }: { item: CopyField }) {
  const [state, action, pending] = useActionState(updatePlatformCopy, initial);
  const draftIsLive = item.published === item.draft;
  return (
    <form action={action} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <input type="hidden" name="key" value={item.key} />
      <input type="hidden" name="revision" value={item.revision} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <label htmlFor={item.key} className="block font-semibold text-slate-950">{item.label}</label>
          <p className="mt-0.5 text-xs text-slate-400">{item.key} · max {item.maxLength} characters</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.published === null ? "bg-slate-100 text-slate-700" : draftIsLive ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
          {item.published === null ? "Default live" : draftIsLive ? "Published" : "Draft differs"}
        </span>
      </div>
      <textarea id={item.key} name="text" required maxLength={item.maxLength} rows={item.maxLength > 300 ? 4 : 2}
        defaultValue={item.draft} className="mt-3 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none focus:border-emerald-600" />
      {item.published !== null && !draftIsLive && (
        <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">Currently live: {item.published}</p>
      )}
      {state.message && <div role={state.ok ? "status" : "alert"} className={`mt-3 rounded-lg p-3 text-xs ${state.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{state.message}</div>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button name="operation" value="draft" disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 disabled:opacity-50">
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save draft
        </button>
        <button name="operation" value="publish" disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
          <Send className="h-3.5 w-3.5" /> Publish
        </button>
        <button name="operation" value="restore" disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50">
          <RotateCcw className="h-3.5 w-3.5" /> Restore default
        </button>
      </div>
    </form>
  );
}

const MODULE_OPTIONS = [
  ["vehicle_inspection", "Vehicle Inspection"],
  ["driver_training", "Driver Training & Assessment"],
  ["reports", "Reports & Analytics"],
  ["api", "API & Integrations"],
] as const;

type PlanView = {
  id: string; code: string; name: string; description: string | null;
  billingCycle: "monthly" | "annual" | "custom";
  price: string; currency: string; trialDays: number; maxUsers: number;
  maxStations: number; maxVehicles: number; maxInspectionsPerMonth: number;
  modules: string[]; features: Record<string, boolean>; isActive: boolean;
  sortOrder: number; subscriberAssignments: number;
};

export function SubscriptionPackageEditor({ plan }: { plan: PlanView | null }) {
  const [state, action, pending] = useActionState(saveSubscriptionPackage, initial);
  const existing = Boolean(plan);
  return (
    <form action={action} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <input name="id" type="hidden" value={plan?.id ?? "new"} />
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-950">{plan?.name ?? "New subscription package"}</h3>
          <p className="text-xs text-slate-500">{plan ? `${plan.subscriberAssignments} historical subscriber assignment(s)` : "Available to new companies when active"}</p>
        </div>
        {plan && <span className={`rounded-full px-3 py-1 text-xs font-semibold ${plan.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{plan.isActive ? "Active" : "Archived"}</span>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Package code">
          <input name="code" type="text" required minLength={2} maxLength={50}
            pattern="[a-z][a-z0-9_]{1,49}" readOnly={existing}
            defaultValue={plan?.code || ""} className={inputClass} placeholder="professional" />
        </Field>
        <Field label="Package name"><input name="name" required maxLength={120} defaultValue={plan?.name || ""} className={inputClass} /></Field>
        <Field label="Price">
          <input name="price" type="number" min="0" max="9999999999" step="0.01" required defaultValue={plan?.price || "0"} className={inputClass} />
        </Field>
        <Field label="Currency">
          <input name="currency" required pattern="[A-Za-z]{3}" maxLength={3}
            defaultValue={plan?.currency || "GHS"} className={inputClass} />
        </Field>
        <Field label="Billing cycle">
          <select name="billingCycle" defaultValue={plan?.billingCycle || "monthly"} className={inputClass}>
            <option value="monthly">Monthly</option><option value="annual">Annual</option><option value="custom">Custom</option>
          </select>
        </Field>
        <Field label="Trial days"><input name="trialDays" type="number" min={0} max={365} required defaultValue={plan?.trialDays ?? 14} className={inputClass} /></Field>
        <Field label="Maximum users"><input name="maxUsers" type="number" min={1} max={1000000} required defaultValue={plan?.maxUsers ?? 10} className={inputClass} /></Field>
        <Field label="Maximum stations"><input name="maxStations" type="number" min={1} max={100000} required defaultValue={plan?.maxStations ?? 2} className={inputClass} /></Field>
        <Field label="Maximum vehicles"><input name="maxVehicles" type="number" min={1} max={100000000} required defaultValue={plan?.maxVehicles ?? 500} className={inputClass} /></Field>
        <Field label="Monthly inspections"><input name="maxInspectionsPerMonth" type="number" min={1} max={100000000} required defaultValue={plan?.maxInspectionsPerMonth ?? 1000} className={inputClass} /></Field>
        <Field label="Display order"><input name="sortOrder" type="number" min={0} max={100000} required defaultValue={plan?.sortOrder ?? 100} className={inputClass} /></Field>
        <label className="flex items-center gap-2 self-end rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-800">
          <input name="isActive" type="checkbox" defaultChecked={plan?.isActive ?? true} className="h-4 w-4 accent-emerald-700" /> Available for selection
        </label>
      </div>
      <Field label="Package description">
        <textarea name="description" maxLength={2000} rows={2} defaultValue={plan?.description || ""} className={inputClass} />
      </Field>
      <fieldset className="mt-4 rounded-xl border border-slate-200 p-3">
        <legend className="px-1 text-sm font-semibold text-slate-800">Included modules</legend>
        <div className="mt-1 grid gap-2 sm:grid-cols-2">
          {MODULE_OPTIONS.map(([value, label]) => (
            <label key={value} className="flex min-h-9 items-center gap-2 text-xs text-slate-700">
              <input name="modules" type="checkbox" value={value}
                defaultChecked={(plan?.modules || ["vehicle_inspection", "reports"]).includes(value)}
                className="h-4 w-4 accent-emerald-700" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Advanced feature flags (JSON object: boolean values only)">
        <textarea name="features" rows={2} maxLength={5000}
          defaultValue={JSON.stringify(plan?.features || {}, null, 2)}
          className={`${inputClass} font-mono text-xs`} />
      </Field>
      {plan && plan.subscriberAssignments > 0 && (
        <p className="mt-3 text-xs leading-5 text-amber-800">
          Assigned tier: reducing limits, removing enabled entitlements, changing currency/cycle, or deactivating is blocked.
        </p>
      )}
      {state.message && <p role={state.ok ? "status" : "alert"}
        className={`mt-3 rounded-lg p-3 text-sm ${state.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{state.message}</p>}
      <button type="submit" disabled={pending}
        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        {pending ? "Saving..." : existing ? "Save package" : "Create package"}
      </button>
    </form>
  );
}

const inputClass = "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-600";
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="mt-3 block text-xs font-semibold text-slate-700">{label}{children}</label>;
}
