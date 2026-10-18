import Link from "next/link";
import type { ReactNode } from "react";
import { Building2, Clock3, ShieldCheck, UsersRound } from "lucide-react";
import { PageHeader, Card, Badge } from "@/components/ui";
import { requirePlatformSuperAdmin } from "@/lib/require-auth";
import {
  getLatestOrganizationSubscription,
  listOnboardingRequests,
  listPlatformOrganizations,
  listSubscriptionPlans,
} from "@/lib/organization-control-plane";
import { OnboardingApprovalForm } from "./PlatformOrganizationActions";
import { changeOrganizationStatus } from "./actions";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PlatformOrganizationsPage() {
  await requirePlatformSuperAdmin();
  const [organizations, requests, plans] = await Promise.all([
    listPlatformOrganizations(),
    listOnboardingRequests(),
    listSubscriptionPlans(),
  ]);
  const subscriptionRows = await Promise.all(
    organizations.map(async (organization) => [organization.id, await getLatestOrganizationSubscription(organization.id)] as const),
  );
  const subscriptions = new Map(subscriptionRows);

  const pendingRequests = requests.filter((request) => request.status !== "converted" && request.status !== "rejected");

  return (
    <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8 xl:p-10">
      <Link href="/platform/oversight" className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
        Platform Oversight Centre →
      </Link>
      <PageHeader
        eyebrow="Platform Administration"
        title="Subscriber Companies"
        description="Approve organizations, assign subscription plans, monitor provisioning, and keep every subscriber isolated from other company workspaces."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Organizations" value={organizations.length} icon={<Building2 className="h-5 w-5" />} />
        <Metric label="Active" value={organizations.filter((o) => o.status === "active").length} icon={<ShieldCheck className="h-5 w-5" />} />
        <Metric label="Provisioning" value={organizations.filter((o) => o.status === "provisioning").length} icon={<Clock3 className="h-5 w-5" />} />
        <Metric label="Onboarding requests" value={pendingRequests.length} icon={<UsersRound className="h-5 w-5" />} />
      </div>

      <Card className="mb-6 p-5 sm:p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-950">Pending subscription requests</h2>
          <p className="mt-1 text-sm text-slate-500">Approval creates a provisioning-only workspace and an expiring Organization Owner invitation. Operational modules stay locked.</p>
        </div>

        {pendingRequests.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">No pending onboarding requests.</p>
        ) : (
          <div className="space-y-4">
            {pendingRequests.map((request) => (
              <div key={request.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="grid gap-4 lg:grid-cols-[1fr_360px] lg:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-950">{request.companyName}</h3>
                      <Badge tone="amber">{request.status}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{request.contactName} · {request.contactEmail}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {request.country} · {request.industry || "Industry not specified"} · {request.estimatedUsers || "—"} users · {request.estimatedVehicles ?? "—"} vehicles
                    </p>
                    <p className="mt-2 text-xs text-slate-400">Requested {formatDateTime(request.createdAt)}</p>
                  </div>
                  <OnboardingApprovalForm
                    requestId={request.id}
                    defaultPlanCode={request.desiredPlanCode || plans[0]?.code || "starter"}
                    plans={plans.map((plan) => ({ code: plan.code, name: plan.name }))}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5 sm:p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-950">Organization registry</h2>
          <p className="mt-1 text-sm text-slate-500">Subscription status and operational readiness are separate controls. A paid organization is not automatically permitted into operational data.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-2 pr-4">Organization</th>
                <th className="py-2 pr-4">Plan</th>
                <th className="py-2 pr-4">Subscription</th>
                <th className="py-2 pr-4">Workspace</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2">Control</th>
              </tr>
            </thead>
            <tbody>
              {organizations.map((organization) => {
                const row = subscriptions.get(organization.id);
                return (
                  <tr key={organization.id} className="border-b border-slate-100">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-slate-950">{organization.name}</p>
                      <p className="text-xs text-slate-500">{organization.slug} · {organization.email || "No contact email"}</p>
                    </td>
                    <td className="py-3 pr-4">{row?.plan.name || "—"}</td>
                    <td className="py-3 pr-4"><Badge tone={row?.subscription.status === "active" ? "emerald" : "amber"}>{row?.subscription.status || "none"}</Badge></td>
                    <td className="py-3 pr-4">
                      <Badge tone={organization.operationalAccessEnabled && organization.dataIsolationVerifiedAt ? "emerald" : "slate"}>
                        {organization.operationalAccessEnabled && organization.dataIsolationVerifiedAt ? "Operational" : "Provisioning locked"}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4"><Badge tone={organization.status === "active" ? "emerald" : organization.status === "suspended" ? "red" : "amber"}>{organization.status}</Badge></td>
                    <td className="py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/platform/organizations/${organization.id}`}
                          className="rounded-lg bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                        >
                          Manage
                        </Link>
                        <form action={changeOrganizationStatus} className="flex items-center gap-2">
                          <input type="hidden" name="organizationId" value={organization.id} />
                          <select name="status" defaultValue={organization.status} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs">
                            <option value="pending">Pending</option>
                            <option value="provisioning">Provisioning</option>
                            <option value="active">Active</option>
                            <option value="suspended">Suspended</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                          <button type="submit" className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Save</button>
                        </form>
                        {!organization.operationalAccessEnabled && organization.status !== "cancelled" && organization.status !== "suspended" && (
                          <Link
                            href={`/platform/organizations/${organization.id}`}
                            className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
                            title="Review the subscriber owner and administrator requirements before workspace activation"
                          >
                            Review activation
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p></div>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700">{icon}</span>
      </div>
    </Card>
  );
}
