import { and, count, desc, eq, gte, isNull, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  inspections,
  locations,
  organizations,
  organizationInvitations,
  organizationSubscriptions,
  subscriptionPlans,
  users,
  vehicles,
} from "@/db/schema";

export const RSL_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000101";

export type OrganizationUser = Pick<typeof users.$inferSelect, "id" | "role" | "organizationId">;

export type SubscriptionModule = "vehicle_inspection" | "driver_training" | "reports" | "api";
export type SubscriptionQuota = "users" | "stations" | "vehicles" | "inspections_monthly";

export type OrganizationUsage = {
  users: number;
  pendingInvitations: number;
  stations: number;
  vehicles: number;
  inspectionsThisMonth: number;
};


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

export function planHasModule(
  plan: Pick<typeof subscriptionPlans.$inferSelect, "modules" | "features"> | null | undefined,
  module: SubscriptionModule,
) {
  if (!plan) return false;
  if (plan.modules.includes(module)) return true;

  const features = plan.features && typeof plan.features === "object" ? plan.features : {};
  if (module === "api") return features.api_access === true;
  if (module === "driver_training") return features.driver_training === true;
  return false;
}

export function organizationHasModule(
  state: Pick<SubscriptionAccessState, "organization" | "plan" | "subscriptionUsable">,
  module: SubscriptionModule,
) {
  if (!state.organization || !state.plan || !state.subscriptionUsable) return false;
  if (!planHasModule(state.plan, module)) return false;

  const organizationEnabled = state.organization.enabledModules.includes(module);
  if (organizationEnabled) return true;

  // Professional plans created before API became a first-class module use the
  // api_access feature flag as their entitlement source.
  return module === "api" && state.plan.features?.api_access === true;
}

export function subscriptionModuleLabel(module: SubscriptionModule) {
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

export async function assertOrganizationModuleAccess(
  organizationId: string,
  module: SubscriptionModule,
) {
  const state = await getOrganizationSubscriptionState(organizationId);
  if (!state.operationalAccess) {
    throw new Error("Organization workspace is not operational");
  }
  if (!organizationHasModule(state, module)) {
    throw new Error(`${subscriptionModuleLabel(module)} is not included in the current subscription plan`);
  }
  return state;
}

export async function getOrganizationUsage(
  organizationId: string,
  now = new Date(),
): Promise<OrganizationUsage> {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const [
    [userCount],
    pendingInvitations,
    [stationCount],
    [vehicleCount],
    [inspectionCount],
  ] = await Promise.all([
    db.select({ n: count() }).from(users).where(eq(users.organizationId, organizationId)),
    db
      .select({ id: organizationInvitations.id })
      .from(organizationInvitations)
      .where(and(
        eq(organizationInvitations.organizationId, organizationId),
        isNull(organizationInvitations.acceptedAt),
        isNull(organizationInvitations.revokedAt),
        gte(organizationInvitations.expiresAt, now),
      )),
    db.select({ n: count() }).from(locations).where(eq(locations.organizationId, organizationId)),
    db
      .select({ n: count() })
      .from(vehicles)
      .where(and(
        eq(vehicles.organizationId, organizationId),
        ne(vehicles.status, "decommissioned"),
      )),
    db
      .select({ n: count() })
      .from(inspections)
      .where(and(
        eq(inspections.organizationId, organizationId),
        gte(inspections.inspectionDate, monthStart),
        lt(inspections.inspectionDate, nextMonth),
      )),
  ]);

  return {
    users: Number(userCount?.n || 0),
    pendingInvitations: pendingInvitations.length,
    stations: Number(stationCount?.n || 0),
    vehicles: Number(vehicleCount?.n || 0),
    inspectionsThisMonth: Number(inspectionCount?.n || 0),
  };
}

export async function assertOrganizationQuota(
  organizationId: string,
  quota: SubscriptionQuota,
) {
  const state = await getOrganizationSubscriptionState(organizationId);
  if (!state.operationalAccess || !state.plan) {
    throw new Error("Organization workspace is not operational");
  }

  const usage = await getOrganizationUsage(organizationId);
  const limits: Record<SubscriptionQuota, number> = {
    users: state.plan.maxUsers,
    stations: state.plan.maxStations,
    vehicles: state.plan.maxVehicles,
    inspections_monthly: state.plan.maxInspectionsPerMonth,
  };
  const current: Record<SubscriptionQuota, number> = {
    users: usage.users + usage.pendingInvitations,
    stations: usage.stations,
    vehicles: usage.vehicles,
    inspections_monthly: usage.inspectionsThisMonth,
  };

  if (current[quota] >= limits[quota]) {
    const labels: Record<SubscriptionQuota, string> = {
      users: "user seats",
      stations: "inspection stations",
      vehicles: "active vehicles",
      inspections_monthly: "monthly inspections",
    };
    throw new Error(
      `Subscription limit reached for ${labels[quota]} (${current[quota]}/${limits[quota]}). Upgrade the organization plan to continue.`,
    );
  }

  return { state, usage, limit: limits[quota], current: current[quota] };
}

function periodAllowsAccess(
  subscription: typeof organizationSubscriptions.$inferSelect,
  now = new Date(),
) {
  if (subscription.status === "trialing" && subscription.trialEndsAt) {
    return new Date(subscription.trialEndsAt).getTime() >= now.getTime();
  }

  if (subscription.status === "grace" && subscription.graceEndsAt) {
    return new Date(subscription.graceEndsAt).getTime() >= now.getTime();
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
