"use client";

import { useActionState } from "react";
import { CheckCircle2, Copy, Loader2, ShieldCheck } from "lucide-react";
import {
  activateSubscriberWorkspace,
  reissueSubscriberOwnerInvitation,
  type PlatformOrganizationActionState,
} from "../actions";

const initial: PlatformOrganizationActionState = { ok: false, message: "" };

type Readiness = {
  ownerReady: boolean;
  inspectionRequired: boolean;
  inspectionReady: boolean;
  trainingRequired: boolean;
  trainingReady: boolean;
  subscriptionReady: boolean;
  organizationReady: boolean;
  canAttemptActivation: boolean;
  ownerInvitationStatus: string;
  ownerInvitationEmail: string | null;
};

export function ActivationReadinessControls({
  organizationId,
  readiness,
}: {
  organizationId: string;
  readiness: Readiness;
}) {
  const [activation, activate, activating] = useActionState(activateSubscriberWorkspace, initial);
  const [invitation, reissue, reissuing] = useActionState(reissueSubscriberOwnerInvitation, initial);
  const needsOwner = !readiness.ownerReady;

  return (
    <section aria-label="Workspace activation requirements" className="mt-5 space-y-3">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-semibold text-slate-950">Activation requirements</h3>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          A subscription marked active does not make a workspace operational. The required
          subscriber administrators must accept their invitations first.
        </p>
        <div className="mt-3 space-y-2 text-xs">
          <Requirement ok={readiness.organizationReady} label="Organization permitted to operate" />
          <Requirement ok={readiness.subscriptionReady} label="Subscription and billing period eligible" />
          <Requirement ok={readiness.ownerReady} label="Active Organization Owner account" />
          {readiness.inspectionRequired && (
            <Requirement ok={readiness.inspectionReady} label="Active Vehicle Inspection Administrator" />
          )}
          {readiness.trainingRequired && (
            <Requirement ok={readiness.trainingReady} label="Active Driver Training Administrator" />
          )}
        </div>
      </div>

      {needsOwner && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Owner setup incomplete</p>
          <p className="mt-1 text-xs leading-5">
            Owner invitation: <strong>{readiness.ownerInvitationStatus}</strong>
            {readiness.ownerInvitationEmail && <> — {readiness.ownerInvitationEmail}</>}.
            The intended owner must open the one-time invitation link, set a password,
            and activate their account before workspace verification can succeed.
          </p>
          {readiness.ownerInvitationEmail ? (
            <div className="mt-3 space-y-3">
              <form action={reissue}>
                <input type="hidden" name="organizationId" value={organizationId} />
                <button type="submit" disabled={reissuing || invitation.ok}
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-amber-600 bg-white px-3 text-xs font-semibold text-amber-950 disabled:opacity-60">
                  {reissuing && <Loader2 className="h-4 w-4 animate-spin" />}
                  {invitation.ok ? "Invitation reissued" : "Reissue one-time owner invitation"}
                </button>
              </form>
              <p className="text-xs leading-5">
                Reissuing revokes previously unused owner invitations. Only send the new link to the verified intended owner.
              </p>
              {invitation.message && (
                <p role={invitation.ok ? "status" : "alert"}
                  className={invitation.ok ? "text-emerald-800" : "text-red-800"}>{invitation.message}</p>
              )}
              {invitation.invitationPath && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-blue-950">
                  <div className="mb-2 text-xs font-semibold">New one-time invitation link</div>
                  <div className="flex items-center gap-2">
                    <code className="min-w-0 flex-1 break-all rounded bg-white p-2 text-xs">{invitation.invitationPath}</code>
                    <button type="button"
                      onClick={() => navigator.clipboard.writeText(`${window.location.origin}${invitation.invitationPath}`)}
                      className="rounded-lg bg-blue-700 p-2 text-white"
                      aria-label="Copy owner invitation link">
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-2 text-xs">No Owner invitation is recorded. Review the original subscriber onboarding request.</p>
          )}
        </div>
      )}

      {readiness.ownerReady && (!readiness.inspectionReady || !readiness.trainingReady) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-950">
          The Organization Owner can now sign in, open <strong>Organization Account</strong> and
          invite separate operational administrators. Each administrator must accept their invitation.
        </div>
      )}

      <form action={activate} className="space-y-2">
        <input type="hidden" name="organizationId" value={organizationId} />
        <button type="submit" disabled={activating || !readiness.canAttemptActivation}
          className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
          {activating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {activating ? "Verifying..." : "Verify & activate workspace"}
        </button>
        {!readiness.canAttemptActivation && (
          <p className="text-xs leading-5 text-slate-600">
            Complete the requirements above to enable this action. Database tenant-isolation checks
            also run during final verification.
          </p>
        )}
        {activation.message && (
          <p role={activation.ok ? "status" : "alert"}
            className={`rounded-lg border p-3 text-xs ${activation.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900"}`}>{activation.message}</p>
        )}
      </form>
    </section>
  );
}

function Requirement({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" /> : <span aria-hidden="true" className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-amber-200 text-[10px] font-bold text-amber-950">!</span>}
      <span className={ok ? "text-emerald-900" : "text-amber-900"}>
        {label}: <strong>{ok ? "Ready" : "Required"}</strong>
      </span>
    </div>
  );
}
