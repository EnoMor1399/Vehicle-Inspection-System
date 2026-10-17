"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { superAdminResetUserPassword } from "../organizations/super-admin-account-recovery";
import { beginUserSupportView } from "./support-actions";

type Account = {
  id: string; name: string; email: string; role: string;
  isActive: boolean; organizationName: string;
};

export function AccountRecoveryControls({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ accountEmail: string; temporaryPassword: string } | null>(null);
  const [supportTarget, setSupportTarget] = useState<Account | null>(null);
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
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {supportTarget && (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-5" aria-label="Start read-only support view">
          <h2 className="text-lg font-semibold text-amber-950">View as {supportTarget.name}</h2>
          <p className="mt-1 text-sm text-amber-900">
            Read-only for 15 minutes. All changes are blocked. Your administrator identity is retained and all access is recorded.
          </p>
          <form className="mt-3 grid gap-3" onSubmit={(event) => {
            event.preventDefault();
            setResult(null); setError("");
            startTransition(async () => {
              try {
                const response = await beginUserSupportView({
                  userId: supportTarget.id, reason, authenticationCode,
                });
                setAuthenticationCode("");
                router.push(response.destination);
                router.refresh();
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
                      if (!window.confirm(`Reset password and revoke all sessions for ${account.email}?`)) return;
                      setResult(null); setError("");
                      startTransition(async () => {
                        try { setResult(await superAdminResetUserPassword(account.id)); }
                        catch (e) { setError(e instanceof Error ? e.message : "Password reset failed"); }
                      });
                    }}>Reset password</button>
                  <button type="button" disabled={pending || !account.isActive}
                    className="rounded border border-amber-600 px-3 py-2 text-amber-900 disabled:opacity-50"
                    onClick={() => { setResult(null); setError(""); setReason(""); setAuthenticationCode(""); setSupportTarget(account); }}>
                    View as user
                  </button>
                </div>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
