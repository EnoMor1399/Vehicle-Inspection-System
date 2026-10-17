"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeRequiredPasswordChange } from "./actions";

export function ChangePasswordForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  return (
    <form className="space-y-5" onSubmit={(event) => {
      event.preventDefault();
      setError("");
      startTransition(async () => {
        try {
          const result = await completeRequiredPasswordChange({
            currentPassword, newPassword, confirmPassword,
          });
          if (!result.ok) {
            setError(result.error || "Password change could not be completed");
            return;
          }
          setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
          router.replace(result.destination || "/");
          router.refresh();
        } catch {
          setError("Password change could not be completed. Please sign in again.");
        }
      });
    }}>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <label className="block text-sm font-medium text-slate-700">
        Temporary password
        <input type="password" autoComplete="current-password" required maxLength={256}
          value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 p-3" />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        New password
        <input type="password" autoComplete="new-password" required minLength={12} maxLength={128}
          value={newPassword} onChange={(event) => setNewPassword(event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 p-3" />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Confirm new password
        <input type="password" autoComplete="new-password" required minLength={12} maxLength={128}
          value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 p-3" />
      </label>
      <p className="text-xs text-slate-500">
        Use at least 12 characters with upper- and lowercase letters, a number and a symbol.
        You must complete this step before accessing your workspace.
      </p>
      <button type="submit" disabled={pending}
        className="w-full rounded-lg bg-slate-900 p-3 font-semibold text-white disabled:opacity-50">
        {pending ? "Updating password..." : "Replace temporary password"}
      </button>
    </form>
  );
}
