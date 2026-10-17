import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, CheckCircle2, Clock3, CreditCard, ShieldCheck } from "lucide-react";
import { Card, Badge } from "@/components/ui";
import { requireAuth } from "@/lib/require-auth";
import {
  getOrganizationSubscriptionState,
  organizationAccessMessage,
} from "@/lib/organization-access";
import { canAccessDriverTraining, canAccessVehicleInspection } from "@/lib/system-access";
import { getPublishedPlatformContent } from "@/lib/platform-content";

export const dynamic = "force-dynamic";

export default async function WorkspaceSetupPage() {
  const user = await requireAuth();
  const [state, copy] = await Promise.all([getOrganizationSubscriptionState(user.organizationId), getPublishedPlatformContent()]);

  if (state.operationalAccess && user.role !== "organization_owner") {
    if (canAccessVehicleInspection(user)) redirect("/");
    if (canAccessDriverTraining(user)) redirect("/driver-training");
  }

  const organization = state.organization;
  const plan = state.plan;
  const subscription = state.subscription;

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-10">
      <div className="overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-xl sm:p-8">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15">
            <Building2 className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">Subscriber workspace</p>
            <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">{organization?.name || "Organization setup"}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{organizationAccessMessage(state.reason)}</p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <InfoCard
          icon={<CreditCard className="h-5 w-5" />}
          label="Subscription"
          value={plan?.name || "Not assigned"}
          detail={subscription ? `Status: ${subscription.status}` : "A subscription must be assigned before activation."}
          ok={state.subscriptionUsable}
        />
        <InfoCard
          icon={<ShieldCheck className="h-5 w-5" />}
          label="Tenant isolation"
          value={organization?.operationalAccessEnabled && organization.dataIsolationVerifiedAt ? "Verified" : "Provisioning"}
          detail={organization?.operationalAccessEnabled && organization.dataIsolationVerifiedAt
            ? "Operational access is enabled for this organization."
            : "Operational records stay locked until the organization data boundary is provisioned and verified."}
          ok={Boolean(organization?.operationalAccessEnabled && organization.dataIsolationVerifiedAt)}
        />
      </div>

      <Card className="mt-6 p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-950">{copy["workspace.setup_title"]}</h2>
        <div className="mt-4 space-y-3">
          <Step done={Boolean(organization)} title="Company profile created" />
          <Step done={Boolean(subscription)} title="Subscription assigned" />
          <Step done={user.role === "organization_owner" || Boolean(organization?.onboardingStage && organization.onboardingStage !== "administrator_invited")} title="Organization Owner account activated" />
          <Step done={Boolean(organization?.dataIsolationVerifiedAt)} title="Tenant data isolation verified" />
          <Step done={state.operationalAccess} title="Operational workspace enabled" />
        </div>
      </Card>

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
    </div>
  );
}

function InfoCard({
  icon,
  label,
  value,
  detail,
  ok,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  ok: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700">{icon}</span>
        <Badge tone={ok ? "emerald" : "amber"}>{ok ? "Ready" : "Pending"}</Badge>
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
    </Card>
  );
}

function Step({ done, title }: { done: boolean; title: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm">
      {done ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Clock3 className="h-5 w-5 text-amber-600" />}
      <span className={done ? "font-medium text-slate-800" : "text-slate-600"}>{title}</span>
    </div>
  );
}
