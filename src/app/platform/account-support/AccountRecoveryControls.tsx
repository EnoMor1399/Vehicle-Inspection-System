"use client";

import { useState, useTransition } from "react";
import { trySuperAdminResetUserPassword } from "../organizations/super-admin-account-recovery";

type Account = {
  id: string; name: string; email: string; role: string;
  isActive: boolean; organizationName: string; supportAvailable: boolean;
};

export function AccountRecoveryControls({ accounts }: { accounts: Account[] }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ accountEmail: string; temporaryPassword: string } | null>(null);
  const [supportTarget, setSupportTarget] = useState<Account | null>(null);
  const [resetTarget, setResetTarget] = useState<Account | null>(null);
  const [resetCode, setResetCode] = useState("");
  const [reason, setReason] = useState("");
  const [authenticationCode, setAuthenticationCode] = useState("");
  const [error, setError] = useState("");

  return (
    <div className="space-y-4">
      {result && (
        <section role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="font-semibold">One-time temporary password for {result.accountEmail}</p>
          <p className="mt-2 break-all font-mono">{result.temporaryPassword}</p>
          <p className="mt-2 text-xs">Share securely and instruct the user to change this password immediately.</p>
          <button type="button" className="mt-3 rounded border px-3 py-2" onClick={() => setResult(null)}>Clear from screen</button>
        </section>
      )}
      {error && (
        <p role="alert" aria-live="assertive" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {resetTarget && (
        <section className="rounded-xl border border-slate-300 bg-slate-50 p-5" aria-label="Confirm password reset">
          <h2 className="text-lg font-semibold">Reset password: {resetTarget.name}</h2>
          <p className="mt-1 text-sm text-slate-600">This revokes all the user&apos;s active sessions and generates a one-time temporary password.</p>
          <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={(event) => {
            event.preventDefault();
            setResult(null); setError("");
            startTransition(async () => {
              try {
                const outcome = await trySuperAdminResetUserPassword(resetTarget.id, resetCode);
                setResetCode("");
                if (!outcome.ok) {
                  setError(outcome.message);
                  return;
                }
                setResult({ accountEmail: outcome.accountEmail, temporaryPassword: outcome.temporaryPassword });
                setResetTarget(null);
              } catch (e) {
                setResetCode("");
                setError(e instanceof Error ? e.message : "Password reset failed");
              }
            });
          }}>
            <label className="text-sm font-medium">Your authenticator code
              <input required type="text" inputMode="numeric" autoComplete="one-time-code"
                pattern="[0-9]{6,8}" maxLength={8} value={resetCode}
                onChange={(e) => setResetCode(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-3" />
            </label>
            <button type="submit" disabled={pending} className="rounded-lg bg-slate-900 px-4 py-3 font-semibold text-white disabled:opacity-50">Confirm reset</button>
            <button type="button" className="rounded-lg border px-4 py-3"
              onClick={() => { setResetTarget(null); setResetCode(""); }}>Cancel</button>
          </form>
        </section>
      )}
      {supportTarget && (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-5" aria-label="Start read-only support view">
          <h2 className="text-lg font-semibold text-amber-950">View as {supportTarget.name}</h2>
          <p className="mt-1 text-sm text-amber-900">
            Read-only for 15 minutes. HTTP mutations are blocked. Your administrator identity is retained and the support session is logged.
          </p>
          <p className="mt-2 text-xs text-amber-900">
            Only active subscriber workspaces can be opened in support mode. Your authenticator code is verified securely and is never stored in the browser.
          </p>
          <form className="mt-3 grid gap-3" onSubmit={(event) => {
            event.preventDefault();
            setResult(null); setError("");
            startTransition(async () => {
              try {
                const response = await fetch("/api/support-session/start", {
                  method: "POST",
                  credentials: "same-origin",
                  headers: { "Content-Type": "application/json" },
                  cache: "no-store",
                  body: JSON.stringify({ userId: supportTarget.id, reason, authenticationCode }),
                });
                const body: unknown = await response.json();
                if (!body || typeof body !== "object") throw new Error("Support request failed. Try again.");
                const outcome = body as { ok?: boolean; destination?: string; error?: string };
                if (!response.ok || !outcome.ok || !outcome.destination) {
                  throw new Error(typeof outcome.error === "string" ? outcome.error : "Could not start support view.");
                }
                // Full navigation applies the new, read-only support cookie on a
                // GET, not a Server Action POST / RSC render (React error #441).
                const allowedDestinations = ["/", "/organization/account", "/portal", "/driver-training"];
                if (!allowedDestinations.includes(outcome.destination)) {
                  throw new Error("Unexpected support destination.");
                }
                setAuthenticationCode("");
                window.location.assign(outcome.destination);
              } catch (e) {
                setAuthenticationCode("");
                setError(e instanceof Error ? e.message : "Could not start support view");
              }
            });
          }}>
            <label className="text-sm font-medium">Reason for support
              <textarea required minLength={12} maxLength={500} rows={3}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-3"
                value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="Describe the issue being investigated (minimum 12 characters)" />
            </label>
            <label className="text-sm font-medium">Your authenticator code
              <input required type="text" inputMode="numeric" autoComplete="one-time-code"
                pattern="[0-9]{6,8}" maxLength={8} value={authenticationCode}
                onChange={(e) => setAuthenticationCode(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-3" />
            </label>
            <div className="flex flex-wrap gap-2">
              <button disabled={pending} type="submit"
                className="rounded-lg bg-amber-950 px-4 py-2 font-semibold text-white disabled:opacity-50">
                {pending ? "Verifying..." : "Start read-only support view"}
              </button>
              <button type="button" className="rounded-lg border px-4 py-2"
                onClick={() => { setSupportTarget(null); setAuthenticationCode(""); setReason(""); }}>Cancel</button>
            </div>
          </form>
        </section>
      )}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-slate-50 text-left">
            <th className="p-3">Account</th><th className="p-3">Organization</th>
            <th className="p-3">Role</th><th className="p-3">Support actions</th>
          </tr></thead>
          <tbody>{accounts.map((account) => (
            <tr key={account.id} className="border-b">
              <td className="p-3"><div className="font-semibold">{account.name}</div>
                <div className="text-slate-500">{account.email}</div></td>
              <td className="p-3">{account.organizationName}</td>
              <td className="p-3">{account.role}{account.isActive ? "" : " (inactive)"}</td>
              <td className="p-3">
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={pending}
                    className="rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-50"
                    onClick={() => {
                      setResult(null); setError(""); setResetCode(""); setSupportTarget(null); setResetTarget(account);
                    }}>Reset password</button>
                  <button type="button" disabled={pending || !account.isActive || !account.supportAvailable}
                    className="rounded border border-amber-600 px-3 py-2 text-amber-900 disabled:opacity-50"
                    onClick={() => { setResult(null); setError(""); setReason(""); setAuthenticationCode(""); setResetTarget(null); setSupportTarget(account); }}>
                    View as user
                  </button>
                  {!account.supportAvailable && (
                    <span className="self-center text-xs text-amber-800">
                      Workspace not operational — activate it before using support view
                    </span>
                  )}
                </div>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
