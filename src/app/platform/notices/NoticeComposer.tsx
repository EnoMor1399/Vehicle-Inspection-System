"use client";

import { useActionState } from "react";
import { createChangeNotice, type NoticeActionState } from "./actions";

const initial: NoticeActionState = { ok: false, message: "" };

export function NoticeComposer({ organizations }: { organizations: Array<{ id: string; name: string }> }) {
  const [state, action, pending] = useActionState(createChangeNotice, initial);
  return (
    <form action={action} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Create update notice">
      <h2 className="text-lg font-semibold text-slate-950">Compose update notification</h2>
      <p className="text-sm text-slate-600">Explain what changes, why it matters and what users must do. Schedule in UTC; notices become visible automatically without an email service.</p>
      {state.message && <p role="status" className={`rounded-lg px-3 py-2 text-sm ${state.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-800"}`}>{state.message}</p>}
      <label className="block text-sm font-semibold">Headline
        <input name="title" required minLength={8} maxLength={160} className="mt-1 w-full rounded-lg border p-2.5" placeholder="Scheduled security update to VIMS" />
      </label>
      <label className="block text-sm font-semibold">What is changing?
        <textarea name="summary" required minLength={20} maxLength={1200} rows={2} className="mt-1 w-full rounded-lg border p-2.5" placeholder="State what will be updated and which services are affected." />
      </label>
      <label className="block text-sm font-semibold">Why is it important?
        <textarea name="impact" required minLength={12} maxLength={1200} rows={2} className="mt-1 w-full rounded-lg border p-2.5" placeholder="Mention expected downtime, changed workflow, or security impact." />
      </label>
      <label className="block text-sm font-semibold">What should users do?
        <textarea name="actionRequired" required minLength={8} maxLength={1200} rows={2} className="mt-1 w-full rounded-lg border p-2.5" placeholder="E.g. Save ongoing work before the maintenance window." />
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm font-semibold">Priority
          <select name="severity" defaultValue="info" className="mt-1 w-full rounded-lg border p-2.5">
            <option value="info">Informational</option>
            <option value="important">Important change</option>
            <option value="critical">Critical action required</option>
          </select>
        </label>
        <label className="block text-sm font-semibold">Audience
          <select name="organizationId" className="mt-1 w-full rounded-lg border p-2.5">
            <option value="">All subscriber organisations</option>
            {organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
          </select>
        </label>
        <label className="block text-sm font-semibold">Deliver at (UTC, blank = now)
          <input name="publishAt" type="datetime-local" className="mt-1 w-full rounded-lg border p-2.5" />
        </label>
        <label className="block text-sm font-semibold">Change effective at (UTC)
          <input name="effectiveAt" type="datetime-local" required className="mt-1 w-full rounded-lg border p-2.5" />
        </label>
        <label className="block text-sm font-semibold">Hide after (UTC, optional)
          <input name="expiresAt" type="datetime-local" className="mt-1 w-full rounded-lg border p-2.5" />
        </label>
        <label className="block text-sm font-semibold">Optional internal action link
          <input name="actionUrl" maxLength={300} className="mt-1 w-full rounded-lg border p-2.5" placeholder="/guide" />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button disabled={pending} type="submit" name="status" value="draft" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50">Save draft</button>
        <button disabled={pending} type="submit" name="status" value="published" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Publish / schedule</button>
      </div>
    </form>
  );
}
