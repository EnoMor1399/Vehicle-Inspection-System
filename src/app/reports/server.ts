"use server";

import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { inspections, locations, transporters, vehicles } from "@/db/schema";
import { canViewReports } from "@/lib/auth";
import { validateReportDateRange } from "@/lib/report-period";
import { requireInternalUser } from "@/lib/require-auth";

const MAX_EXPORT_ROWS = 10_000;

export async function getReportExportData(input: {
  startDate?: string | null;
  endDate?: string | null;
}) {
  const user = await requireInternalUser();
  if (!canViewReports(user)) throw new Error("You do not have permission to export reports");

  const range = validateReportDateRange(input);
  const conditions = [eq(inspections.organizationId, user.organizationId)];
  if (range.start) conditions.push(gte(inspections.inspectionDate, range.start));
  if (range.endExclusive) conditions.push(lt(inspections.inspectionDate, range.endExclusive));
  const whereClause = and(...conditions);

  const [summaryRows, detailRows] = await Promise.all([
    db
      .select({
        totalInspections: sql<number>`count(*)::int`,
        vehiclesInspected: sql<number>`count(distinct ${inspections.vehicleId})::int`,
        transportersRepresented: sql<number>`count(distinct ${vehicles.transporterId})::int`,
        passCount: sql<number>`count(*) filter (where ${inspections.overallResult} = 'pass')::int`,
        failCount: sql<number>`count(*) filter (where ${inspections.overallResult} = 'fail')::int`,
        conditionalCount: sql<number>`count(*) filter (where ${inspections.overallResult} in ('conditional_pass', 'reinspection_required'))::int`,
      })
      .from(inspections)
      .leftJoin(vehicles, eq(vehicles.id, inspections.vehicleId))
      .where(whereClause),
    db
      .select({
        inspectionNumber: inspections.inspectionNumber,
        registrationNumber: vehicles.registrationNumber,
        transporter: transporters.companyName,
        station: locations.name,
        inspectionDate: inspections.inspectionDate,
        inspector: inspections.inspectorName,
        result: inspections.overallResult,
      })
      .from(inspections)
      .leftJoin(vehicles, eq(vehicles.id, inspections.vehicleId))
      .leftJoin(transporters, eq(transporters.id, vehicles.transporterId))
      .leftJoin(locations, eq(locations.id, inspections.locationId))
      .where(whereClause)
      .orderBy(desc(inspections.inspectionDate))
      .limit(MAX_EXPORT_ROWS + 1),
  ]);

  const summary = summaryRows[0] || {
    totalInspections: 0,
    vehiclesInspected: 0,
    transportersRepresented: 0,
    passCount: 0,
    failCount: 0,
    conditionalCount: 0,
  };
  const total = Number(summary.totalInspections || 0);
  const passCount = Number(summary.passCount || 0);
  const failCount = Number(summary.failCount || 0);
  const conditionalCount = Number(summary.conditionalCount || 0);
  const truncated = detailRows.length > MAX_EXPORT_ROWS;

  return {
    startDate: range.startDate,
    endDate: range.endDate,
    generatedAt: new Date().toISOString(),
    truncated,
    rowLimit: MAX_EXPORT_ROWS,
    stats: {
      vehiclesInspected: Number(summary.vehiclesInspected || 0),
      transportersRepresented: Number(summary.transportersRepresented || 0),
      totalInspections: total,
      passCount,
      failCount,
      conditionalCount,
      passRate: total ? Math.round((passCount / total) * 1000) / 10 : 0,
      failRate: total ? Math.round((failCount / total) * 1000) / 10 : 0,
      complianceRate: total ? Math.round(((passCount + conditionalCount) / total) * 1000) / 10 : 0,
    },
    rows: detailRows.slice(0, MAX_EXPORT_ROWS).map((row) => ({
      "Inspection #": row.inspectionNumber,
      "Vehicle Registration": row.registrationNumber || "—",
      "Transporter": row.transporter || "—",
      "Station": row.station || "—",
      "Inspection Date": row.inspectionDate.toISOString().slice(0, 10),
      "Inspector": row.inspector || "—",
      "Result": row.result === "conditional_pass"
        ? "Conditional Pass"
        : row.result === "reinspection_required"
          ? "Re-inspection Required"
          : row.result.charAt(0).toUpperCase() + row.result.slice(1),
    })),
  };
}
