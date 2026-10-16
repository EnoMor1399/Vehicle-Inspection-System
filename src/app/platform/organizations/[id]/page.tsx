import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Boxes,
  Building2,
  CarFront,
  ClipboardCheck,
  MapPin,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { Badge, Card, PageHeader } from "@/components/ui";
import { requirePlatformSuperAdmin } from "@/lib/require-auth";
import {
  getPlatformOrganizationSubscriptionDetail,
  listSubscriptionPlans,
} from "@/lib/organization-control-plane";
import { activateSubscriberWorkspace, changeOrganizationStatus } from "../actions";
import { SubscriptionLifecycleForm } from "./SubscriptionLifecycleForm";

export const dynamic = "force-dynamic";

export default async function PlatformOrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePlatformSuperAdmin();
  const { id } = await params;
  const [detail, plans] = await Promise.all([
    getPlatformOrganizationSubscriptionDetail(id),
    listSubscriptionPlans(),
  ]);

  if (!detail.organization) notFound();
  const organization = detail.organization;
  const current = detail.subscription;

  return (
    <div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8 xl:p-10">
      <Link
        href="/platform/organizations"
        className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950"
      >
        <ArrowLeft className="h-4 w-4" />
        Subscriber Companies
      </Link>

      <PageHeader
        eyebrow="Platform Subscription Management"
        title={organization.name}
        description="Manage plan entitlements, subscription lifecycle, capacity and workspace activation for this subscriber."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<UsersRound className="h-5 w-5" />} label="Active users" value={detail.usage.users} limit={current?.plan.maxUsers} />
        <Metric icon={<MapPin className="h-5 w-5" />} label="Active stations" value={detail.usage.stations} limit={current?.plan.maxStations} />
        <Metric icon={<CarFront className="h-5 w-5" />} label="Managed vehicles" value={detail.usage.vehicles} limit={current?.plan.maxVehicles} />
        <Metric icon={<ClipboardCheck className="h-5 w-5" />} label="Inspections this month" value={detail.usage.monthlyInspections} limit={current?.plan.maxInspectionsPerMonth} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-950">Subscription lifecycle</h2>
          <p className="mt-1 mb-5 text-sm leading-6 text-slate-500">
            Change plan, lifecycle status, billing amount and subscription dates. Capacity safety checks run before any downgrade.
          </p>

          {current ? (
            <SubscriptionLifecycleForm
              organizationId={organization.id}
              plans={plans.map((plan) => ({
                code: plan.code,
                name: plan.name,
                maxUsers: plan.maxUsers,
                maxStations: plan.maxStations,
                maxVehicles: plan.maxVehicles,
                maxInspectionsPerMonth: plan.maxInspectionsPerMonth,
                modules: plan.modules,
              }))}
              current={{
                planCode: current.plan.code,
                status: current.subscription.status,
                amount: String(current.subscription.amount),
                currency: current.subscription.currency,
                currentPeriodEnd: current.subscription.currentPeriodEnd?.toISOString() || null,
                trialEndsAt: current.subscription.trialEndsAt?.toISOString() || null,
                graceEndsAt: current.subscription.graceEndsAt?.toISOString() || null,
                cancelAtPeriodEnd: current.subscription.cancelAtPeriodEnd,
                notes: current.subscription.notes,
              }}
            />
          ) : (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              This organization does not have a subscription record.
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700">
                <Building2 className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="font-semibold text-slate-950">Organization state</h2>
                <p className="mt-1 text-sm text-slate-500">{organization.slug}</p>
              </div>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <Row label="Organization status">
                <Badge tone={organization.status === "active" ? "emerald" : organization.status === "suspended" ? "red" : "amber"}>
                  {organization.status}
                </Badge>
              </Row>
              <Row label="Workspace">
                <Badge tone={organization.operationalAccessEnabled && organization.dataIsolationVerifiedAt ? "emerald" : "slate"}>
                  {organization.operationalAccessEnabled && organization.dataIsolationVerifiedAt ? "Operational" : "Provisioning"}
                </Badge>
              </Row>
              <Row label="Subscription">{current?.plan.name || "None"}</Row>
              <Row label="Subscription status">{current?.subscription.status || "None"}</Row>
            </div>

            <form action={changeOrganizationStatus} className="mt-5 flex gap-2">
              <input type="hidden" name="organizationId" value={organization.id} />
              <select name="status" defaultValue={organization.status} className="min-h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm">
                <option value="pending">Pending</option>
                <option value="provisioning">Provisioning</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <button className="rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Save
              </button>
            </form>

            {!organization.operationalAccessEnabled && organization.status !== "cancelled" && organization.status !== "suspended" && (
              <form action={activateSubscriberWorkspace} className="mt-3">
                <input type="hidden" name="organizationId" value={organization.id} />
                <button className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 text-sm font-semibold text-white hover:bg-emerald-800">
                  <ShieldCheck className="h-4 w-4" />
                  Verify & activate workspace
                </button>
              </form>
            )}
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700">
                <Boxes className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-semibold text-slate-950">Current plan modules</h2>
                <p className="text-xs text-slate-500">Enforced across UI, routes and API</p>
              </div>
            </div>

            {current?.plan.modules.length ? (
              <div className="flex flex-wrap gap-2">
                {current.plan.modules.map((module) => (
                  <Badge key={module} tone="blue">{module.replaceAll("_", " ")}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No operational modules assigned.</p>
            )}
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="font-semibold text-slate-950">Downgrade protection</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              A smaller plan cannot be applied while the organization exceeds its user, station, vehicle or monthly inspection allowance. Data is never deleted automatically during a downgrade.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  limit,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  limit?: number;
}) {
  const percent = limit && limit > 0 ? Math.min(100, Math.round((value / limit) * 100)) : 0;
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
          <p className="mt-1 text-xl font-semibold text-slate-950">
            {value.toLocaleString()}
            {typeof limit === "number" && <span className="text-sm font-normal text-slate-400"> / {limit.toLocaleString()}</span>}
          </p>
          {typeof limit === "number" && <p className="mt-1 text-xs text-slate-500">{percent}% of plan capacity</p>}
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700">{icon}</span>
      </div>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-2 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{children}</span>
    </div>
  );
}
