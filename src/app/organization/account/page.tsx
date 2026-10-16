import type { ReactNode } from "react";
import { CarFront, ClipboardCheck, CreditCard, MapPin, ShieldCheck, UsersRound } from "lucide-react";
import { PageHeader, Card, Badge } from "@/components/ui";
import { requireOrganizationAccountManager } from "@/lib/require-auth";
import {
  getOrganizationAccountSnapshot,
  listOrganizationInvitations,
} from "@/lib/organization-control-plane";
import { formatDateTime } from "@/lib/utils";
import { getOrganizationCapacitySnapshot } from "@/lib/subscription-capacity";
import { AdministratorInvitationForm, OrganizationProfileForm } from "./OrganizationAccountForms";

export const dynamic = "force-dynamic";

export default async function OrganizationAccountPage() {
  const user = await requireOrganizationAccountManager();
  const [snapshot, invitations, capacity] = await Promise.all([
    getOrganizationAccountSnapshot(user.organizationId),
    listOrganizationInvitations(user.organizationId),
    getOrganizationCapacitySnapshot(user.organizationId),
  ]);
  if (!snapshot.organization || !snapshot.subscription) {
    return <div className="p-8 text-sm text-red-700">Organization subscription data is unavailable.</div>;
  }

  const { organization, subscription, pendingInvitationCount } = snapshot;
  const plan = subscription.plan;
  const trainingEnabled = plan.modules.includes("driver_training");

  return (
    <div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8 xl:p-10">
      <PageHeader
        eyebrow="Organization Account"
        title={organization.name}
        description="Manage company identity, subscription capacity and administrator invitations without overlapping Vehicle Inspection and Driver Training operational responsibilities."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Summary icon={<CreditCard className="h-5 w-5" />} label="Plan" value={plan.name} hint={subscription.subscription.status} />
        <Summary icon={<UsersRound className="h-5 w-5" />} label="Active users" value={`${capacity.usage.users} / ${capacity.limits.users}`} hint={`${pendingInvitationCount} pending invitations`} />
        <Summary icon={<MapPin className="h-5 w-5" />} label="Active stations" value={`${capacity.usage.stations} / ${capacity.limits.stations}`} hint="Plan capacity" />
        <Summary icon={<ShieldCheck className="h-5 w-5" />} label="Workspace" value={organization.operationalAccessEnabled && organization.dataIsolationVerifiedAt ? "Ready" : "Provisioning"} hint={organization.onboardingStage.replaceAll("_", " ")} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-950">Organization profile & branding</h2>
          <p className="mt-1 mb-5 text-sm text-slate-500">These details identify your subscriber workspace and supply organization-specific branding.</p>
          <OrganizationProfileForm organization={organization} />
        </Card>

        <div className="space-y-6">
          <Card className="p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-950">Subscription</h2>
            <div className="mt-4 space-y-3 text-sm">
              <Row label="Status"><Badge tone={subscription.subscription.status === "active" || subscription.subscription.status === "trialing" ? "emerald" : "amber"}>{subscription.subscription.status}</Badge></Row>
              <Row label="Billing">{Number(subscription.subscription.amount) > 0 ? `${subscription.subscription.currency} ${Number(subscription.subscription.amount).toLocaleString()}` : "Custom agreement"}</Row>
              <Row label="Active users"><CapacityValue used={capacity.usage.users} limit={capacity.limits.users} /></Row>
              <Row label="Active stations"><CapacityValue used={capacity.usage.stations} limit={capacity.limits.stations} /></Row>
              <Row label="Managed vehicles"><CapacityValue used={capacity.usage.vehicles} limit={capacity.limits.vehicles} /></Row>
              <Row label="Inspections this month"><CapacityValue used={capacity.usage.monthlyInspections} limit={capacity.limits.monthlyInspections} /></Row>
              <Row label="Modules">{plan.modules.map((m) => m.replaceAll("_", " ")).join(", ")}</Row>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-950">Capacity overview</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">Limits are enforced server-side and at the database boundary. Decommissioned vehicles and inactive stations do not consume active capacity.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <CapacityTile icon={<UsersRound className="h-4 w-4" />} label="Users" used={capacity.usage.users} limit={capacity.limits.users} />
              <CapacityTile icon={<MapPin className="h-4 w-4" />} label="Stations" used={capacity.usage.stations} limit={capacity.limits.stations} />
              <CapacityTile icon={<CarFront className="h-4 w-4" />} label="Vehicles" used={capacity.usage.vehicles} limit={capacity.limits.vehicles} />
              <CapacityTile icon={<ClipboardCheck className="h-4 w-4" />} label="Monthly inspections" used={capacity.usage.monthlyInspections} limit={capacity.limits.monthlyInspections} />
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-950">Administration separation</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Organization Owner manages the subscription and company account only. Invite separate administrators for Vehicle Inspection and Driver Training & Assessment so operational responsibilities remain independent.
            </p>
          </Card>
        </div>
      </div>

      <Card className="mt-6 p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-950">Invite operational administrators</h2>
        <p className="mt-1 mb-5 text-sm text-slate-500">Invitations expire after seven days and respect the subscription user limit.</p>
        <AdministratorInvitationForm trainingEnabled={trainingEnabled} />

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr><th className="py-2 pr-4">Email</th><th className="py-2 pr-4">Role</th><th className="py-2 pr-4">Created</th><th className="py-2">Status</th></tr>
            </thead>
            <tbody>
              {invitations.map(({ invitation: invite, expired }) => (
                <tr key={invite.id} className="border-b border-slate-100">
                  <td className="py-3 pr-4">{invite.email}</td>
                  <td className="py-3 pr-4">{invite.role.replaceAll("_", " ")}</td>
                  <td className="py-3 pr-4 text-slate-500">{formatDateTime(invite.createdAt)}</td>
                  <td className="py-3">
                    <Badge tone={invite.acceptedAt ? "emerald" : invite.revokedAt || expired ? "red" : "amber"}>
                      {invite.acceptedAt ? "accepted" : invite.revokedAt ? "revoked" : expired ? "expired" : "pending"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Summary({ icon, label, value, hint }: { icon: ReactNode; label: string; value: string; hint: string }) {
  return <Card className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-xl font-semibold text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{hint}</p></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700">{icon}</span></div></Card>;
}
function Row({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-2 last:border-0"><span className="text-slate-500">{label}</span><span className="text-right font-medium text-slate-800">{children}</span></div>;
}

function CapacityValue({ used, limit }: { used: number; limit: number }) {
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100;
  return <span className={percent >= 100 ? "text-red-700" : percent >= 80 ? "text-amber-700" : "text-slate-800"}>{used.toLocaleString()} / {limit.toLocaleString()}</span>;
}

function CapacityTile({ icon, label, used, limit }: { icon: ReactNode; label: string; used: number; limit: number }) {
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100;
  const tone = percent >= 100 ? "bg-red-500" : percent >= 80 ? "bg-amber-500" : "bg-emerald-600";
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{icon}{label}</span>
        <span className="text-xs font-semibold text-slate-700">{percent}%</span>
      </div>
      <p className="mt-2 text-lg font-semibold text-slate-950">{used.toLocaleString()} <span className="text-sm font-normal text-slate-400">/ {limit.toLocaleString()}</span></p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
