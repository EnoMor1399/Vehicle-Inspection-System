"use client";

import { useState, useTransition } from "react";
import { superAdminResetUserPassword } from "../organizations/super-admin-account-recovery";

type Account = { id: string; name: string; email: string; role: string; isActive: boolean; organizationName: string };

export function AccountRecoveryControls({ accounts }: { accounts: Account[] }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ accountEmail: string; temporaryPassword: string } | null>(null);
  const [error, setError] = useState("");
  return (
    <div className="space-y-4">
      {result && (
        <section role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="font-semibold">One-time temporary password for {result.accountEmail}</p>
          <p className="mt-2 break-all font-mono">{result.temporaryPassword}</p>
          <button type="button" className="mt-3 rounded border px-3 py-2" onClick={() => setResult(null)}>Clear from screen</button>
        </section>
      )}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-slate-50 text-left"><th className="p-3">Account</th><th className="p-3">Organization</th><th className="p-3">Role</th><th className="p-3">Support action</th></tr></thead>
          <tbody>{accounts.map((account) => (
            <tr key={account.id} className="border-b">
              <td className="p-3"><div className="font-semibold">{account.name}</div><div className="text-slate-500">{account.email}</div></td>
              <td className="p-3">{account.organizationName}</td>
              <td className="p-3">{account.role}</td>
              <td className="p-3"><button type="button" disabled={pending} className="rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-50" onClick={() => {
                if (!window.confirm(`Reset password and revoke all sessions for ${account.email}?`)) return;
                setResult(null); setError("");
                startTransition(async () => {
                  try { setResult(await superAdminResetUserPassword(account.id)); }
                  catch (e) { setError(e instanceof Error ? e.message : "Password reset failed"); }
                });
              }}>Reset password</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
