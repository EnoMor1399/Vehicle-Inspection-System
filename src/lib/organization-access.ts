import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  organizations,
  organizationSubscriptions,
  subscriptionPlans,
  type users,
} from "@/db/schema";

export const RSL_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000101";

export type OrganizationUser = Pick<typeof users.$inferSelect, "id" | "role" | "organizationId">;

export type OrganizationModule =
  | "vehicle_inspection"
  | "driver_training"
  | "reports"
  | "api";

export type SubscriptionAccessState = {
  organization: typeof organizations.$inferSelect | null;
  subscription: typeof organizationSubscriptions.$inferSelect | null;
  plan: typeof subscriptionPlans.$inferSelect | null;
  subscriptionUsable: boolean;
  operationalAccess: boolean;
  reason:
    | "ok"
    | "organization_missing"
    | "organization_inactive"
    | "subscription_missing"
    | "subscription_inactive"
    | "subscription_expired"
    | "workspace_provisioning";
};

const USABLE_SUBSCRIPTION_STATUSES = new Set(["trialing", "active", "grace"]);

export function isPlatformSuperAdmin(user: { role: string }) {
  return user.role === "super_admin";
}

export function periodAllowsAccess(
  subscription: typeof organizationSubscriptions.$inferSelect,
  now = new Date(),
) {
  if (subscription.status === "trialing") {
    return Boolean(subscription.trialEndsAt)
      && Number.isFinite(new Date(subscription.trialEndsAt!).getTime())
      && new Date(subscription.trialEndsAt!).getTime() >= now.getTime();
  }

  if (subscription.status === "grace") {
    return Boolean(subscription.graceEndsAt)
      && Number.isFinite(new Date(subscription.graceEndsAt!).getTime())
      && new Date(subscription.graceEndsAt!).getTime() >= now.getTime();
  }

  if (subscription.currentPeriodEnd && subscription.status === "active") {
    return new Date(subscription.currentPeriodEnd).getTime() >= now.getTime();
  }

  return true;
}

export async function getOrganizationSubscriptionState(
  organizationId: string,
  now = new Date(),
): Promise<SubscriptionAccessState> {
  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!organization) {
    return {
      organization: null,
      subscription: null,
      plan: null,
      subscriptionUsable: false,
      operationalAccess: false,
      reason: "organization_missing",
    };
  }

  const [row] = await db
    .select({
      subscription: organizationSubscriptions,
      plan: subscriptionPlans,
    })
    .from(organizationSubscriptions)
    .innerJoin(subscriptionPlans, eq(subscriptionPlans.id, organizationSubscriptions.planId))
    .where(eq(organizationSubscriptions.organizationId, organizationId))
    .orderBy(desc(organizationSubscriptions.createdAt))
    .limit(1);

  if (!row) {
    return {
      organization,
      subscription: null,
      plan: null,
      subscriptionUsable: false,
      operationalAccess: false,
      reason: "subscription_missing",
    };
  }

  const organizationActive = organization.status === "active";
  const statusUsable = USABLE_SUBSCRIPTION_STATUSES.has(row.subscription.status);
  const periodUsable = periodAllowsAccess(row.subscription, now);
  const subscriptionUsable = statusUsable && periodUsable;

  let reason: SubscriptionAccessState["reason"] = "ok";
  if (!organizationActive) reason = "organization_inactive";
  else if (!statusUsable) reason = "subscription_inactive";
  else if (!periodUsable) reason = "subscription_expired";
  else if (!organization.operationalAccessEnabled || !organization.dataIsolationVerifiedAt) {
    reason = "workspace_provisioning";
  }

  return {
    organization,
    subscription: row.subscription,
    plan: row.plan,
    subscriptionUsable,
    operationalAccess:
      organizationActive
      && subscriptionUsable
      && organization.operationalAccessEnabled
      && Boolean(organization.dataIsolationVerifiedAt),
    reason,
  };
}

export function hasOrganizationModule(
  state: Pick<SubscriptionAccessState, "plan">,
  module: OrganizationModule,
) {
  return Boolean(state.plan?.modules.includes(module));
}

export function organizationModuleLabel(module: OrganizationModule) {
  switch (module) {
    case "vehicle_inspection":
      return "Vehicle Inspection";
    case "driver_training":
      return "Driver Training & Assessment";
    case "reports":
      return "Reports & Analytics";
    case "api":
      return "API & Integrations";
  }
}

export async function getOrganizationBySlug(slug: string) {
  const [organization] = await db
    .select()
    .from(organizations)
    .where(and(eq(organizations.slug, slug), eq(organizations.status, "active")))
    .limit(1);
  return organization || null;
}

export function organizationAccessMessage(reason: SubscriptionAccessState["reason"]) {
  switch (reason) {
    case "organization_missing":
      return "Your organization workspace could not be found.";
    case "organization_inactive":
      return "Your organization workspace is not active. Contact the platform administrator.";
    case "subscription_missing":
      return "No subscription is assigned to this organization.";
    case "subscription_inactive":
      return "This organization subscription is not active.";
    case "subscription_expired":
      return "This organization subscription period has ended.";
    case "workspace_provisioning":
      return "Your organization workspace is being provisioned and isolated before operational access is enabled.";
    default:
      return "Your organization workspace is ready.";
  }
}
