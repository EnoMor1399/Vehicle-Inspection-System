"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ArrowLeftRight, Building2, ChevronDown, ShieldCheck } from "lucide-react";

type OrganizationChoice = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

export function OrganizationSwitcher({
  organizations,
  activeOrganizationId,
}: {
  organizations: OrganizationChoice[];
  activeOrganizationId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const active = organizations.find((organization) => organization.id === activeOrganizationId);

  function switchOrganization(nextId: string) {
    // Only navigate to an ID supplied by the server-side Super Admin list.
    // This changes the read-only oversight page, not the authenticated user's tenant.
    if (!organizations.some((organization) => organization.id === nextId)) return;
    if (nextId === activeOrganizationId) return;
    startTransition(() => router.push(`/platform/oversight/${encodeURIComponent(nextId)}`));
  }

  return (
    <section
      aria-label="Active organization oversight scope"
      className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 sm:p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-indigo-700 shadow-sm">
            <Building2 className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-800">Active organization · read-only oversight</p>
            <p className="mt-1 break-words text-lg font-semibold text-slate-950">{active?.name ?? "Organization unavailable"}</p>
            {active && <p className="text-xs text-slate-600">{active.slug} · {active.status}</p>}
            <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-slate-700">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
              This scope only changes which organization the oversight page displays. It does not switch user sessions or grant cross-organization operational access.
            </p>
          </div>
        </div>
        <label className="flex w-full shrink-0 flex-col gap-1.5 text-sm font-semibold text-slate-800 sm:w-[320px]">
          <span className="flex items-center gap-2"><ArrowLeftRight className="h-4 w-4" /> Switch organization</span>
          <span className="relative">
            <select
              aria-label="Switch organization in oversight view"
              value={activeOrganizationId}
              disabled={isPending || organizations.length === 0}
              onChange={(event) => switchOrganization(event.target.value)}
              className="min-h-11 w-full appearance-none rounded-xl border border-indigo-200 bg-white py-2 pl-3 pr-10 text-sm font-medium text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:cursor-wait disabled:opacity-70"
            >
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name} · {organization.status}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          </span>
          <span aria-live="polite" className="min-h-4 text-xs font-normal text-slate-500">
            {isPending ? "Loading selected organization…" : "Organization data remains separately scoped."}
          </span>
        </label>
      </div>
    </section>
  );
}
