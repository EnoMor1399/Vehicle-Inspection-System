import "server-only";

import { and, count, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLogs, documents, inspections, locations, organizations,
  organizationSubscriptions, securityEvents, subscriptionPlans,
  transporters, users, vehicles,
} from "@/db/schema";
import { trainingSessions } from "@/db/training-schema";
import { requirePlatformSuperAdmin } from "@/lib/require-auth";

// This is a strictly privileged control-plane read model. Operational pages
// continue enforcing their own per-user tenant and module boundaries; no
// request-supplied tenant is ever applied to a normal subscriber session.
const summaryTables = {
  users, vehicles, inspections, locations, transporters, documents,
  trainingSessions, securityEvents,
} as const;

export async function getPlatformOversightOverview() {
  await requirePlatformSuperAdmin();
  const now = new Date();
  const cutoff = new Date(now.getTime() - 30 * 86400_000);
  const [orgs, userCounts, vehicleCounts, inspectionCounts, stationCounts,
    transporterCounts, documentCounts, trainingCounts, securityCounts,
    auditCounts, subscriptions] = await Promise.all([
    db.select({
      id: organizations.id, name: organizations.name, slug: organizations.slug,
      status: organizations.status, email: organizations.email,
      operationalAccessEnabled: organizations.operationalAccessEnabled,
      dataIsolationVerifiedAt: organizations.dataIsolationVerifiedAt,
      createdAt: organizations.createdAt,
    }).from(organizations).orderBy(organizations.name),
    groupedCounts(summaryTables.users),
    groupedCounts(summaryTables.vehicles),
    groupedCounts(summaryTables.inspections),
    groupedCounts(summaryTables.locations),
    groupedCounts(summaryTables.transporters),
    groupedCounts(summaryTables.documents),
    groupedCounts(summaryTables.trainingSessions),
    db.select({ organizationId: securityEvents.organizationId, total: count() })
      .from(securityEvents).where(eq(securityEvents.resolved, false))
      .groupBy(securityEvents.organizationId),
    db.select({ organizationId: auditLogs.organizationId, total: count() })
      .from(auditLogs).where(gte(auditLogs.createdAt, cutoff))
      .groupBy(auditLogs.organizationId),
    db.select({
      organizationId: organizationSubscriptions.organizationId,
      status: organizationSubscriptions.status,
      plan: subscriptionPlans.name,
      createdAt: organizationSubscriptions.createdAt,
    }).from(organizationSubscriptions)
      .innerJoin(subscriptionPlans, eq(organizationSubscriptions.planId, subscriptionPlans.id))
      .orderBy(desc(organizationSubscriptions.createdAt)),
  ]);
  const numberMap = (rows: Array<{ organizationId: string; total: number }>) =>
    new Map(rows.map((r) => [r.organizationId, Number(r.total)]));
  const maps = {
    user: numberMap(userCounts), vehicle: numberMap(vehicleCounts),
    inspection: numberMap(inspectionCounts), station: numberMap(stationCounts),
    transporter: numberMap(transporterCounts), document: numberMap(documentCounts),
    training: numberMap(trainingCounts), security: numberMap(securityCounts),
    audit: numberMap(auditCounts),
  };
  const recentSubscription = new Map<string, { plan: string; status: string }>();
  for (const item of subscriptions) {
    if (!recentSubscription.has(item.organizationId))
      recentSubscription.set(item.organizationId, { plan: item.plan, status: item.status });
  }
  return orgs.map((o) => ({
    ...o,
    users: maps.user.get(o.id) ?? 0,
    vehicles: maps.vehicle.get(o.id) ?? 0,
    inspections: maps.inspection.get(o.id) ?? 0,
    stations: maps.station.get(o.id) ?? 0,
    transporters: maps.transporter.get(o.id) ?? 0,
    documents: maps.document.get(o.id) ?? 0,
    trainingSessions: maps.training.get(o.id) ?? 0,
    unresolvedSecurityEvents: maps.security.get(o.id) ?? 0,
    last30DayActions: maps.audit.get(o.id) ?? 0,
    subscription: recentSubscription.get(o.id) ?? null,
  }));
}

// All queries use explicit organization_id on the selected tenant, even for
// a Super Administrator. This prevents accidental cross-tenant joins/exports.
export async function getPlatformOrganizationOversight(organizationId: string) {
  await requirePlatformSuperAdmin();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(organizationId)) {
    return null;
  }
  const [org] = await db.select({
    id: organizations.id, name: organizations.name, slug: organizations.slug,
    email: organizations.email, phone: organizations.phone, status: organizations.status,
    operationalAccessEnabled: organizations.operationalAccessEnabled,
    dataIsolationVerifiedAt: organizations.dataIsolationVerifiedAt,
  }).from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  if (!org) return null;
  const [
    accounts, recentVehicles, recentInspections, recentAudit, recentSecurity,
    userTotal, vehiclesTotal, inspectionsTotal, stationsTotal,
    transportersTotal, documentsTotal, trainingTotal,
  ] = await Promise.all([
    db.select({
      id: users.id, name: users.name, email: users.email,
      role: users.role, isActive: users.isActive,
      twoFactorEnabled: users.twoFactorEnabled, lastLoginAt: users.lastLoginAt,
    }).from(users).where(eq(users.organizationId, org.id))
      .orderBy(users.name).limit(200),
    db.select({
      id: vehicles.id, registrationNumber: vehicles.registrationNumber,
      make: vehicles.make, model: vehicles.model, status: vehicles.status,
      createdAt: vehicles.createdAt,
    }).from(vehicles).where(eq(vehicles.organizationId, org.id))
      .orderBy(desc(vehicles.createdAt)).limit(15),
    db.select({
      id: inspections.id, inspectionNumber: inspections.inspectionNumber,
      vehicleId: inspections.vehicleId, overallResult: inspections.overallResult,
      workflowStatus: inspections.workflowStatus, inspectionDate: inspections.inspectionDate,
    }).from(inspections).where(eq(inspections.organizationId, org.id))
      .orderBy(desc(inspections.inspectionDate)).limit(15),
    db.select({
      id: auditLogs.id, userName: auditLogs.userName, action: auditLogs.action,
      entityType: auditLogs.entityType, summary: auditLogs.summary,
      createdAt: auditLogs.createdAt,
    }).from(auditLogs).where(eq(auditLogs.organizationId, org.id))
      .orderBy(desc(auditLogs.createdAt)).limit(20),
    db.select({
      id: securityEvents.id, eventType: securityEvents.eventType,
      severity: securityEvents.severity, description: securityEvents.description,
      resolved: securityEvents.resolved, createdAt: securityEvents.createdAt,
    }).from(securityEvents).where(eq(securityEvents.organizationId, org.id))
      .orderBy(desc(securityEvents.createdAt)).limit(12),
    scopedCount(users, org.id),
    scopedCount(vehicles, org.id),
    scopedCount(inspections, org.id),
    scopedCount(locations, org.id),
    scopedCount(transporters, org.id),
    scopedCount(documents, org.id),
    scopedCount(trainingSessions, org.id),
  ]);
  return {
    organization: org,
    counts: { users: userTotal, vehicles: vehiclesTotal, inspections: inspectionsTotal,
      stations: stationsTotal, transporters: transportersTotal,
      documents: documentsTotal, trainingSessions: trainingTotal },
    accounts, recentVehicles, recentInspections, recentAudit, recentSecurity,
  };
}

type CountableTable = typeof users | typeof vehicles | typeof inspections
  | typeof locations | typeof transporters | typeof documents
  | typeof trainingSessions | typeof securityEvents;
function groupedCounts(table: CountableTable) {
  return db.select({ organizationId: table.organizationId, total: count() })
    .from(table).groupBy(table.organizationId);
}
async function scopedCount(table: CountableTable, organizationId: string) {
  const [row] = await db.select({ total: count() }).from(table)
    .where(eq(table.organizationId, organizationId));
  return Number(row?.total || 0);
}
