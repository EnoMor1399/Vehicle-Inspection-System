"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, LockKeyhole, ShieldCheck, X } from "lucide-react";

type Organization = { id: string; name: string };
type Operations = {
  organizationId: string;
  organizationName: string;
  expiresAt: string;
  stepUpExpiresAt: string | null;
};
type Mode = "start" | "elevate" | null;

export function SuperAdminOperationControls({
  selectedOrganization,
  operations,
  expired = false,
}: {
  selectedOrganization?: Organization | null;
  operations?: Operations | null;
  expired?: boolean;
}) {
  const [mode, setMode] = useState<Mode>(null);
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const organization = operations
    ? { id: operations.organizationId, name: operations.organizationName }
    : selectedOrganization;
  if (!organization && !expired) return null;

  async function exitOperations() {
    if (busy) return;
    setError(""); setBusy(true);
    try {
      const response = await fetch("/api/platform/operations/end", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Could not exit operations mode");
      window.location.assign(result.destination || "/platform/oversight");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to exit operations");
      setBusy(false);
    }
  }

  function openDialog(nextMode: Exclude<Mode, null>) {
    setMode(nextMode); setReason(""); setCode(""); setConfirmation(""); setError("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mode || !organization || busy) return;
    setBusy(true); setError("");
    const route = mode === "start"
      ? "/api/platform/operations/start" : "/api/platform/operations/elevate";
    const body = mode === "start"
      ? { organizationId: organization.id, reason, authenticationCode: code, confirmation }
      : { authenticationCode: code, confirmation };
    try {
      const response = await fetch(route, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "same-origin", body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Authorization failed");
      if (mode === "start") {
        // Full reload ensures all Server Actions and pages use the newly issued
        // HttpOnly, actor-bound organization context rather than stale RSC data.
        window.location.assign(result.destination || "/");
        return;
      }
      setMode(null); setCode(""); setConfirmation("");
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authorization failed");
    } finally { setBusy(false); }
  }

  const label = organization?.name || "selected company";
  const phrase = mode === "start" ? `OPERATE ${label}` : `AUTHORIZE ${label}`;
  return (
    <>
      {operations ? (
        <section aria-label="Elevated organization operations"
          className="flex flex-wrap items-center gap-3 border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:px-6 lg:px-8">
          <ShieldCheck className="h-5 w-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-bold">Super Admin operating in {operations.organizationName}</p>
            <p className="text-xs">
              Scoped writes · authenticated as the real Super Admin · expires {new Date(operations.expiresAt).toLocaleTimeString()}.
              {operations.stepUpExpiresAt ? " Sensitive actions authorized temporarily." : " Sensitive actions need another MFA verification."}
            </p>
          </div>
          <button type="button" disabled={busy} onClick={() => openDialog("elevate")}
            className="rounded-lg border border-amber-700 bg-white px-3 py-2 text-xs font-bold hover:bg-amber-100 disabled:opacity-50">
            Authorize sensitive actions
          </button>
          <button type="button" disabled={busy} onClick={exitOperations}
            className="rounded-lg bg-amber-950 px-3 py-2 text-xs font-bold text-white hover:bg-amber-900 disabled:opacity-50">
            Exit company operations
          </button>
        </section>
      ) : expired ? (
        <section role="alert" className="flex flex-wrap items-center gap-3 border-b border-red-300 bg-red-50 px-4 py-3 text-sm text-red-950">
          <AlertTriangle className="h-5 w-5" />
          <p className="flex-1">Your privileged organization operations session has expired. Exit the mode before continuing.</p>
          <button type="button" onClick={exitOperations} disabled={busy}
            className="rounded-lg bg-red-900 px-4 py-2 font-semibold text-white">
            Exit expired session
          </button>
        </section>
      ) : (
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-700 sm:px-6 lg:px-8">
          <LockKeyhole className="h-4 w-4" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <strong>{label}</strong> · Currently viewing. Activate secured operations to create, edit or approve records for this organization.
          </span>
          <button type="button" onClick={() => openDialog("start")}
            className="rounded-lg bg-slate-900 px-3 py-2 font-semibold text-white hover:bg-slate-800">
            Enable organization operations
          </button>
        </div>
      )}

      {error && !mode && <div role="alert" className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-800">{error}</div>}

      {mode && (
        <div role="dialog" aria-modal="true"
          aria-label={mode === "start" ? "Enable Super Admin organization operations" : "Authorize high-risk changes"}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 text-slate-950 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">
                  {mode === "start" ? "Enable organization operations" : "Authorize sensitive operations"}
                </h2>
                <p className="mt-1 text-sm text-slate-600">{label}</p>
              </div>
              <button type="button" disabled={busy} aria-label="Close authorization"
                className="rounded-lg p-2 hover:bg-slate-100" onClick={() => { setMode(null); setError(""); }}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
              {mode === "start"
                ? "Operations last 15 minutes. Every permitted write is logged against your original Super Admin identity and the selected organization. Sensitive actions require a separate 2-minute authorization."
                : "This additional MFA verification authorizes sensitive writes for only 2 minutes. Review the target organization carefully before acting."}
            </p>
            <form onSubmit={submit} className="mt-4 space-y-4">
              {mode === "start" && (
                <label className="block text-sm font-semibold">
                  Reason for accessing organization operations
                  <textarea required minLength={12} maxLength={500} value={reason}
                    onChange={(e) => setReason(e.target.value)} rows={3}
                    placeholder="Describe the operational work you need to perform"
                    className="mt-1 block w-full rounded-lg border border-slate-300 p-3 text-sm" />
                </label>
              )}
              <label className="block text-sm font-semibold">
                Type this confirmation exactly: <span className="font-mono text-amber-900">{phrase}</span>
                <input required value={confirmation} autoComplete="off"
                  onChange={(e) => setConfirmation(e.target.value)}
                  className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm" />
              </label>
              <label className="block text-sm font-semibold">
                Authenticator app verification code
                <input required type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={8}
                  value={code} onChange={(e) => setCode(e.target.value)}
                  className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm" />
              </label>
              {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
              <button type="submit" disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 font-bold text-white disabled:opacity-50">
                <CheckCircle2 className="h-4 w-4" />
                {busy ? "Verifying…" : mode === "start" ? "Start secured organization operations" : "Authorize for 2 minutes"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
