"use client";

import Link from "next/link";
import { useActionState } from "react";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { acceptInvitationAction, type InvitationAcceptState } from "./actions";

const initial: InvitationAcceptState = { ok: false, message: "" };

export function AcceptInvitationForm({
  token,
  email,
  suggestedName,
}: {
  token: string;
  email: string;
  suggestedName: string | null;
}) {
  const [state, action, pending] = useActionState(acceptInvitationAction, initial);

  if (state.ok) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <CheckCircle2 className="h-8 w-8 text-emerald-700" />
        <h2 className="mt-3 text-lg font-semibold text-emerald-950">Invitation accepted</h2>
        <p className="mt-2 text-sm leading-6 text-emerald-900">{state.message}</p>
        <Link href="/login" className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white">Sign in to VIMS</Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Email</label>
        <input value={email} readOnly className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-500" />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Full name</label>
        <input name="name" required minLength={2} maxLength={200} defaultValue={suggestedName || ""} className={inputClass} />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Password</label>
        <input name="password" type="password" required minLength={12} maxLength={128} className={inputClass} autoComplete="new-password" />
        <p className="mt-1 text-xs text-slate-500">Use 12+ characters with uppercase, lowercase, a number and a special character.</p>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Confirm password</label>
        <input name="confirmPassword" type="password" required minLength={12} maxLength={128} className={inputClass} autoComplete="new-password" />
      </div>

      {state.message && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{state.message}</div>}

      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-900">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        Privileged administrator accounts may be required to enroll in two-factor authentication before entering an operational workspace.
      </div>

      <button disabled={pending} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60">
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Create account
      </button>
    </form>
  );
}

const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/10";
