import Link from "next/link";
import { Boxes, CheckCircle2, LockKeyhole, ShieldCheck } from "lucide-react";
import { Badge, Card, PageHeader } from "@/components/ui";
import { requireAuth } from "@/lib/require-auth";
import {
  getOrganizationSubscriptionState,
  organizationModuleLabel,
  type OrganizationModule,
} from "@/lib/organization-access";

const KNOWN_MODULES = new Set<OrganizationModule>([
  "vehicle_inspection",
  "driver_training",
  "reports",
  "api",
]);

export const dynamic = "force-dynamic";

export default async function SubscriptionAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ module?: string }>;
}) {
  const user = await requireAuth();
  const query = await searchParams;
  const requestedModule = KNOWN_MODULES.has(query.module as OrganizationModule)
    ? query.module as OrganizationModule
    : null;
  const state = await getOrganizationSubscriptionState(user.organizationId);

  const includedModules = state.plan?.modules.filter((module): module is OrganizationModule =>
    KNOWN_MODULES.has(module as OrganizationModule),
  ) || [];

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-10">
      <PageHeader
        eyebrow="Subscription Access"
        title={requestedModule ? `${organizationModuleLabel(requestedModule)} is not included` : "Subscription module access"}
        description="Your organization can only use operational modules included in its current VIMS subscription plan."
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
        <Card className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-700">
              <LockKeyhole className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                {state.organization?.name || "Organization"} subscription
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Direct URLs, API calls and navigation are all protected by the same subscription entitlement checks. Having a user role does not override the organization plan.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Info label="Plan" value={state.plan?.name || "Not assigned"} />
            <Info label="Subscription status" value={state.subscription?.status || "Unavailable"} />
          </div>

          {requestedModule && (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-950">{organizationModuleLabel(requestedModule)}</p>
              <p className="mt-1 text-sm leading-6 text-amber-900">
                This module is not part of the current plan. Ask your Organization Owner or platform administrator to move the company to a plan that includes it.
              </p>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            {user.role === "organization_owner" && (
              <Link href="/organization/account" className="inline-flex min-h-11 items-center rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white">
                Open Organization Account
              </Link>
            )}
            <Link href="/guide" className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700">
              Open User Guide
            </Link>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700"><Boxes className="h-5 w-5" /></span>
            <div>
              <h2 className="font-semibold text-slate-950">Included modules</h2>
              <p className="text-xs text-slate-500">Current plan entitlements</p>
            </div>
          </div>

          {includedModules.length ? (
            <div className="space-y-2">
              {includedModules.map((module) => (
                <div key={module} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-3">
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    {organizationModuleLabel(module)}
                  </span>
                  <Badge tone="emerald">Included</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No operational modules are assigned to this subscription.</p>
          )}

          <div className="mt-5 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-900">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            Module checks apply in the interface, server actions and integration API.
          </div>
        </Card>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
