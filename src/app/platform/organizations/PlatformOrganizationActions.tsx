"use client";

import { useActionState } from "react";
import { CheckCircle2, Copy, Loader2 } from "lucide-react";
import {
  approveSubscriberRequest,
  type PlatformOrganizationActionState,
} from "./actions";

const initialState: PlatformOrganizationActionState = { ok: false, message: "" };

export function OnboardingApprovalForm({
  requestId,
  defaultPlanCode,
  plans,
}: {
  requestId: string;
  defaultPlanCode: string;
  plans: { code: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(approveSubscriberRequest, initialState);

  return (
    <div className="space-y-3">
      <form action={action} className="flex flex-col gap-2 sm:flex-row">
        <input type="hidden" name="requestId" value={requestId} />
        <select name="planCode" defaultValue={defaultPlanCode} className="min-h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm">
          {plans.map((plan) => <option key={plan.code} value={plan.code}>{plan.name}</option>)}
        </select>
        <button
          type="submit"
          disabled={pending || state.ok}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {state.ok ? "Converted" : "Approve & provision"}
        </button>
      </form>

      {state.message && (
        <div className={`rounded-lg border px-3 py-2 text-xs leading-5 ${state.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-800"}`}>
          {state.message}
        </div>
      )}

      {state.invitationPath && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-xs font-semibold text-blue-900">One-time owner invitation</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded bg-white px-2 py-1 text-xs text-slate-700 ring-1 ring-blue-100">{state.invitationPath}</code>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(`${window.location.origin}${state.invitationPath}`)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-700 text-white"
              aria-label="Copy invitation link"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
