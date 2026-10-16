"use client";

import type { ReactNode } from "react";
import { useActionState } from "react";
import { CheckCircle2, Copy, Loader2, UserPlus } from "lucide-react";
import {
  inviteOrganizationAdministrator,
  updateOrganizationAccount,
  type OrganizationAccountState,
} from "./actions";

const initial: OrganizationAccountState = { ok: false, message: "" };

export function OrganizationProfileForm({ organization }: { organization: {
  name: string;
  legalName: string | null;
  registrationNumber: string | null;
  taxId: string | null;
  industry: string | null;
  country: string;
  region: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  themeColor: string;
  accentColor: string;
} }) {
  const [state, action, pending] = useActionState(updateOrganizationAccount, initial);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Organization name"><input name="name" required defaultValue={organization.name} className={inputClass} /></Field>
        <Field label="Legal name"><input name="legalName" defaultValue={organization.legalName || ""} className={inputClass} /></Field>
        <Field label="Registration number"><input name="registrationNumber" defaultValue={organization.registrationNumber || ""} className={inputClass} /></Field>
        <Field label="Tax ID"><input name="taxId" defaultValue={organization.taxId || ""} className={inputClass} /></Field>
        <Field label="Industry"><input name="industry" defaultValue={organization.industry || ""} className={inputClass} /></Field>
        <Field label="Country"><input name="country" required defaultValue={organization.country} className={inputClass} /></Field>
        <Field label="Region"><input name="region" defaultValue={organization.region || ""} className={inputClass} /></Field>
        <Field label="City"><input name="city" defaultValue={organization.city || ""} className={inputClass} /></Field>
        <Field label="Phone"><input name="phone" defaultValue={organization.phone || ""} className={inputClass} /></Field>
        <Field label="Email"><input name="email" type="email" defaultValue={organization.email || ""} className={inputClass} /></Field>
        <Field label="Website"><input name="website" defaultValue={organization.website || ""} className={inputClass} /></Field>
        <Field label="Address"><input name="address" defaultValue={organization.address || ""} className={inputClass} /></Field>
        <Field label="Primary colour"><input name="themeColor" type="color" defaultValue={organization.themeColor} className="h-12 w-full rounded-xl border border-slate-300 bg-white p-1.5" /></Field>
        <Field label="Accent colour"><input name="accentColor" type="color" defaultValue={organization.accentColor} className="h-12 w-full rounded-xl border border-slate-300 bg-white p-1.5" /></Field>
      </div>
      {state.message && <Status state={state} />}
      <button disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        Save organization profile
      </button>
    </form>
  );
}

export function AdministratorInvitationForm({ trainingEnabled }: { trainingEnabled: boolean }) {
  const [state, action, pending] = useActionState(inviteOrganizationAdministrator, initial);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Administrator name"><input name="name" className={inputClass} /></Field>
        <Field label="Email"><input name="email" type="email" required className={inputClass} /></Field>
        <Field label="Administration domain">
          <select name="role" className={inputClass} defaultValue="vehicle_inspection_admin">
            <option value="vehicle_inspection_admin">Vehicle Inspection Administrator</option>
            {trainingEnabled && <option value="driver_training_admin">Driver Training Administrator</option>}
          </select>
        </Field>
      </div>
      {state.message && <Status state={state} />}
      {state.invitationPath && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3">
          <code className="min-w-0 flex-1 break-all text-xs text-blue-950">{state.invitationPath}</code>
          <button type="button" onClick={() => navigator.clipboard.writeText(`${window.location.origin}${state.invitationPath}`)} className="grid h-9 w-9 place-items-center rounded-lg bg-blue-700 text-white" aria-label="Copy invitation link"><Copy className="h-4 w-4" /></button>
        </div>
      )}
      <button disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        Create administrator invitation
      </button>
    </form>
  );
}

const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>{children}</label>;
}
function Status({ state }: { state: OrganizationAccountState }) {
  return <div className={`rounded-xl border px-4 py-3 text-sm ${state.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-800"}`}>{state.message}</div>;
}
