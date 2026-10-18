import "server-only";

import { and, count, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLogs, dailyInspections, importJobs, inspectionAppointments, inspections,
  securityEvents, users, vehicles,
} from "@/db/schema";
import { requirePlatformSuperAdmin } from "@/lib/require-auth";
import { isValidOrganizationId } from "@/lib/organization-id";
import type { ScopedSection } from "@/lib/platform-oversight-navigation";

export const SCOPED_MODULE_PAGE_SIZE = 40;
export type ScopedModuleRecord = {
  id: string;
  name: string;
  reference: string;
  type: string;
  status: string;
  detail: string;
  date: string;
};

const formatDate = (date: Date | string | null) =>
  date ? (typeof date === "string" ? date : date.toISOString().slice(0, 10)) : "Not recorded";

const RISK_RESULTS = ["fail", "reinspection_required", "conditional_pass"] as const;

export async function listPlatformScopedModuleRecords(
  organizationId: string,
  section: ScopedSection,
  requestedPage: number,
): Promise<{ records: ScopedModuleRecord[]; total: number; page: number; totalPages: number } | null> {
  await requirePlatformSuperAdmin();
  if (!isValidOrganizationId(organizationId)) return null;
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0
    ? Math.min(requestedPage, 10_000)
    : 1;
  const offset = (page - 1) * SCOPED_MODULE_PAGE_SIZE;
  let records: ScopedModuleRecord[] = [];
  let total = 0;

  // Joined vehicle records must belong to the exact same tenant as the
  // inspection record. The request never impersonates the organization.
  if (section === "inspections" || section === "compliance" || section === "maintenance-risk") {
    const riskOnly = section !== "inspections";
    const filter = and(
      eq(inspections.organizationId, organizationId),
      eq(vehicles.organizationId, organizationId),
      ...(riskOnly ? [inArray(inspections.overallResult, [...RISK_RESULTS])] : []),
    );
    const [rows, totals] = await Promise.all([
      db.select({
        id: inspections.id,
        inspectionNumber: inspections.inspectionNumber,
        inspectionDate: inspections.inspectionDate,
        result: inspections.overallResult,
        workflowStatus: inspections.workflowStatus,
        reg: vehicles.registrationNumber,
        make: vehicles.make,
        model: vehicles.model,
      }).from(inspections)
        .innerJoin(vehicles, eq(inspections.vehicleId, vehicles.id))
        .where(filter).orderBy(desc(inspections.inspectionDate), desc(inspections.id))
        .limit(SCOPED_MODULE_PAGE_SIZE).offset(offset),
      db.select({ total: count() }).from(inspections)
        .innerJoin(vehicles, eq(inspections.vehicleId, vehicles.id))
        .where(filter),
    ]);
    total = Number(totals[0]?.total ?? 0);
    records = rows.map((v) => ({
      id: v.id, name: `${v.reg} · ${v.make} ${v.model || ""}`,
      reference: v.inspectionNumber, type: "Vehicle inspection",
      status: v.result.replaceAll("_", " "),
      detail: v.workflowStatus.replaceAll("_", " "),
      date: formatDate(v.inspectionDate),
    }));
  } else if (section === "daily-inspections") {
    const filter = and(
      eq(dailyInspections.organizationId, organizationId),
      eq(vehicles.organizationId, organizationId),
    );
    const [rows, totals] = await Promise.all([
      db.select({
        id: dailyInspections.id,
        date: dailyInspections.inspectionDate,
        status: dailyInspections.status,
        cleared: dailyInspections.clearedForTrip,
        driver: dailyInspections.driverName,
        reg: vehicles.registrationNumber,
      }).from(dailyInspections)
        .innerJoin(vehicles, eq(dailyInspections.vehicleId, vehicles.id))
        .where(filter).orderBy(desc(dailyInspections.inspectionDate), desc(dailyInspections.id))
        .limit(SCOPED_MODULE_PAGE_SIZE).offset(offset),
      db.select({ total: count() }).from(dailyInspections)
        .innerJoin(vehicles, eq(dailyInspections.vehicleId, vehicles.id)).where(filter),
    ]);
    total = Number(totals[0]?.total ?? 0);
    records = rows.map(v => ({
      id: v.id, name: v.reg, reference: v.id, type: "Pre-trip inspection",
      status: v.status.replaceAll("_", " "),
      detail: `${v.cleared ? "Cleared for trip" : "Not cleared"} · Driver: ${v.driver || "Not recorded"}`,
      date: formatDate(v.date),
    }));
  } else if (section === "scheduling") {
    const filter = and(
      eq(inspectionAppointments.organizationId, organizationId),
      eq(vehicles.organizationId, organizationId),
    );
    const [rows, totals] = await Promise.all([
      db.select({
        id: inspectionAppointments.id,
        reference: inspectionAppointments.appointmentNumber,
        date: inspectionAppointments.scheduledAt,
        status: inspectionAppointments.status,
        type: inspectionAppointments.appointmentType,
        priority: inspectionAppointments.priority,
        reg: vehicles.registrationNumber,
      }).from(inspectionAppointments)
        .innerJoin(vehicles, eq(inspectionAppointments.vehicleId, vehicles.id))
        .where(filter).orderBy(desc(inspectionAppointments.scheduledAt), desc(inspectionAppointments.id))
        .limit(SCOPED_MODULE_PAGE_SIZE).offset(offset),
      db.select({ total: count() }).from(inspectionAppointments)
        .innerJoin(vehicles, eq(inspectionAppointments.vehicleId, vehicles.id)).where(filter),
    ]);
    total = Number(totals[0]?.total ?? 0);
    records = rows.map(v => ({
      id: v.id, name: v.reg, reference: v.reference, type: v.type,
      status: v.status.replaceAll("_", " "),
      detail: `Priority: ${v.priority}`, date: formatDate(v.date),
    }));
  } else if (section === "users") {
    const [rows, totals] = await Promise.all([
      db.select({
        id: users.id, name: users.name, email: users.email,
        role: users.role, active: users.isActive, lastLoginAt: users.lastLoginAt,
      }).from(users).where(eq(users.organizationId, organizationId))
        .orderBy(users.name, users.id).limit(SCOPED_MODULE_PAGE_SIZE).offset(offset),
      db.select({ total: count() }).from(users).where(eq(users.organizationId, organizationId)),
    ]);
    total = Number(totals[0]?.total ?? 0);
    records = rows.map(v => ({
      id: v.id, name: v.name, reference: v.email, type: v.role.replaceAll("_", " "),
      status: v.active ? "Active" : "Inactive",
      detail: "Account oversight only", date: formatDate(v.lastLoginAt),
    }));
  } else if (section === "audit") {
    const [rows, totals] = await Promise.all([
      db.select({
        id: auditLogs.id, action: auditLogs.action, type: auditLogs.entityType,
        label: auditLogs.entityLabel, summary: auditLogs.summary,
        userName: auditLogs.userName, at: auditLogs.createdAt,
      }).from(auditLogs).where(eq(auditLogs.organizationId, organizationId))
        .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
        .limit(SCOPED_MODULE_PAGE_SIZE).offset(offset),
      db.select({ total: count() }).from(auditLogs).where(eq(auditLogs.organizationId, organizationId)),
    ]);
    total = Number(totals[0]?.total ?? 0);
    records = rows.map(v => ({
      id: v.id, name: v.label || v.type, reference: v.id, type: v.type,
      status: v.action.replaceAll("_", " "), detail: v.summary || v.userName || "Audit event",
      date: formatDate(v.at),
    }));
  } else if (section === "notifications") {
    const [rows, totals] = await Promise.all([
      db.select({
        id: securityEvents.id, eventType: securityEvents.eventType,
        severity: securityEvents.severity, resolved: securityEvents.resolved,
        description: securityEvents.description, at: securityEvents.createdAt,
      }).from(securityEvents).where(eq(securityEvents.organizationId, organizationId))
        .orderBy(desc(securityEvents.createdAt), desc(securityEvents.id))
        .limit(SCOPED_MODULE_PAGE_SIZE).offset(offset),
      db.select({ total: count() }).from(securityEvents)
        .where(eq(securityEvents.organizationId, organizationId)),
    ]);
    total = Number(totals[0]?.total ?? 0);
    records = rows.map(v => ({
      id: v.id, name: v.eventType.replaceAll("_", " "), reference: v.id,
      type: v.severity, status: v.resolved ? "Resolved" : "Open",
      detail: v.description || "Security alert", date: formatDate(v.at),
    }));
  } else if (section === "import-export") {
    const [rows, totals] = await Promise.all([
      db.select({
        id: importJobs.id, fileName: importJobs.fileName,
        entityType: importJobs.entityType, status: importJobs.status,
        importedRows: importJobs.importedRows, at: importJobs.createdAt,
      }).from(importJobs).where(eq(importJobs.organizationId, organizationId))
        .orderBy(desc(importJobs.createdAt), desc(importJobs.id))
        .limit(SCOPED_MODULE_PAGE_SIZE).offset(offset),
      db.select({ total: count() }).from(importJobs)
        .where(eq(importJobs.organizationId, organizationId)),
    ]);
    total = Number(totals[0]?.total ?? 0);
    records = rows.map(v => ({
      id: v.id, name: v.fileName, reference: v.id, type: v.entityType,
      status: v.status.replaceAll("_", " "), detail: `${v.importedRows} imported rows`,
      date: formatDate(v.at),
    }));
  }

  const totalPages = Math.max(1, Math.ceil(total / SCOPED_MODULE_PAGE_SIZE));
  return { records, total, page, totalPages };
}
