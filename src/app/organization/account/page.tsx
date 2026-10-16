import { Building2, CreditCard, ShieldCheck, UsersRound } from "lucide-react";
import { PageHeader, Card, Badge } from "@/components/ui";
import { requireOrganizationAccountManager } from "@/lib/require-auth";
import {
  getOrganizationAccountSnapshot,
  listOrganizationInvitations,
} from "@/lib/organization-control-plane";
import { formatDateTime } from "@/lib/utils";
import { AdministratorInvitationForm, OrganizationProfileForm } from "./OrganizationAccountForms";

export const dynamic = "force-dynamic";

export default async function OrganizationAccountPage() {
  const user = await requireOrganizationAccountManager();
  const [snapshot, invitations] = await Promise.all([
    getOrganizationAccountSnapshot(user.organizationId),
    listOrganizationInvitations(user.organizationId),
  ]);
  if (!snapshot.organization || !snapshot.subscription) {
    return <div className="p-8 text-sm text-red-700">Organization subscription data is unavailable.</div>;
  }

  const { organization, subscription, userCount, pendingInvitationCount } = snapshot;
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
        <Summary icon={<UsersRound className="h-5 w-5" />} label="Users" value={`${userCount} / ${plan.maxUsers}`} hint={`${pendingInvitationCount} pending invitations`} />
        <Summary icon={<Building2 className="h-5 w-5" />} label="Stations" value={String(plan.maxStations)} hint="Subscription capacity" />
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
              <Row label="User limit">{plan.maxUsers.toLocaleString()}</Row>
              <Row label="Vehicle limit">{plan.maxVehicles.toLocaleString()}</Row>
              <Row label="Monthly inspections">{plan.maxInspectionsPerMonth.toLocaleString()}</Row>
              <Row label="Modules">{plan.modules.map((m) => m.replaceAll("_", " ")).join(", ")}</Row>
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
              {invitations.map((invite) => (
                <tr key={invite.id} className="border-b border-slate-100">
                  <td className="py-3 pr-4">{invite.email}</td>
                  <td className="py-3 pr-4">{invite.role.replaceAll("_", " ")}</td>
                  <td className="py-3 pr-4 text-slate-500">{formatDateTime(invite.createdAt)}</td>
                  <td className="py-3">
                    <Badge tone={invite.acceptedAt ? "emerald" : invite.revokedAt || new Date(invite.expiresAt) < new Date() ? "red" : "amber"}>
                      {invite.acceptedAt ? "accepted" : invite.revokedAt ? "revoked" : new Date(invite.expiresAt) < new Date() ? "expired" : "pending"}
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

function Summary({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return <Card className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-xl font-semibold text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{hint}</p></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700">{icon}</span></div></Card>;
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-2 last:border-0"><span className="text-slate-500">{label}</span><span className="text-right font-medium text-slate-800">{children}</span></div>;
}
