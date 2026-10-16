import { and, count, eq, gte, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import { inspections, locations, users, vehicles } from "@/db/schema";
import { getLatestOrganizationSubscription } from "@/lib/organization-control-plane";

export type SubscriptionCapacityResource =
  | "users"
  | "stations"
  | "vehicles"
  | "monthly_inspections";

function monthWindow(at: Date) {
  const start = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
  const end = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1));
  return { start, end };
}

function isSubscriptionPeriodUsable(
  subscription: NonNullable<Awaited<ReturnType<typeof getLatestOrganizationSubscription>>>["subscription"],
  now: Date,
) {
  if (!["trialing", "active", "grace"].includes(subscription.status)) return false;
  if (subscription.status === "trialing" && subscription.trialEndsAt) {
    return new Date(subscription.trialEndsAt).getTime() >= now.getTime();
  }
  if (subscription.status === "grace" && subscription.graceEndsAt) {
    return new Date(subscription.graceEndsAt).getTime() >= now.getTime();
  }
  if (subscription.status === "active" && subscription.currentPeriodEnd) {
    return new Date(subscription.currentPeriodEnd).getTime() >= now.getTime();
  }
  return true;
}

export async function getOrganizationCapacitySnapshot(
  organizationId: string,
  at = new Date(),
) {
  const subscription = await getLatestOrganizationSubscription(organizationId);
  if (!subscription) throw new Error("No subscription is assigned to this organization");
  if (!isSubscriptionPeriodUsable(subscription.subscription, at)) {
    throw new Error("The organization subscription is not currently usable");
  }

  const { start, end } = monthWindow(at);
  const [[userCount], [stationCount], [vehicleCount], [inspectionCount]] = await Promise.all([
    db
      .select({ n: count() })
      .from(users)
      .where(and(eq(users.organizationId, organizationId), eq(users.isActive, true))),
    db
      .select({ n: count() })
      .from(locations)
      .where(and(eq(locations.organizationId, organizationId), ne(locations.status, "inactive"))),
    db
      .select({ n: count() })
      .from(vehicles)
      .where(and(eq(vehicles.organizationId, organizationId), ne(vehicles.status, "decommissioned"))),
    db
      .select({ n: count() })
      .from(inspections)
      .where(and(
        eq(inspections.organizationId, organizationId),
        gte(inspections.inspectionDate, start),
        lt(inspections.inspectionDate, end),
      )),
  ]);

  return {
    subscription,
    usage: {
      users: Number(userCount?.n || 0),
      stations: Number(stationCount?.n || 0),
      vehicles: Number(vehicleCount?.n || 0),
      monthlyInspections: Number(inspectionCount?.n || 0),
    },
    limits: {
      users: subscription.plan.maxUsers,
      stations: subscription.plan.maxStations,
      vehicles: subscription.plan.maxVehicles,
      monthlyInspections: subscription.plan.maxInspectionsPerMonth,
    },
    period: { start, end },
  };
}

export async function assertSubscriptionCapacityAvailable(
  organizationId: string,
  resource: SubscriptionCapacityResource,
  at = new Date(),
) {
  const snapshot = await getOrganizationCapacitySnapshot(organizationId, at);

  const current =
    resource === "users" ? snapshot.usage.users
      : resource === "stations" ? snapshot.usage.stations
        : resource === "vehicles" ? snapshot.usage.vehicles
          : snapshot.usage.monthlyInspections;

  const limit =
    resource === "users" ? snapshot.limits.users
      : resource === "stations" ? snapshot.limits.stations
        : resource === "vehicles" ? snapshot.limits.vehicles
          : snapshot.limits.monthlyInspections;

  if (current >= limit) {
    const label =
      resource === "users" ? "active user"
        : resource === "stations" ? "active station"
          : resource === "vehicles" ? "managed vehicle"
            : "monthly inspection";
    throw new Error(
      `Subscription limit reached: ${current.toLocaleString()} of ${limit.toLocaleString()} ${label}${limit === 1 ? "" : "s"} used. Upgrade the organization plan or reduce current usage before adding another.`,
    );
  }

  return snapshot;
}

export function extractSubscriptionCapacityError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  const marker = "SUBSCRIPTION_LIMIT:";
  const index = message.indexOf(marker);
  if (index < 0) return null;
  return message.slice(index + marker.length).trim().replace(/\s+CONTEXT:[\s\S]*$/i, "").trim();
}
