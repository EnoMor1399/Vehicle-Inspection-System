import { db } from "@/db";
import { inspections, vehicles, transporters } from "@/db/schema";
import { eq, and, sql, gte, lte, desc } from "drizzle-orm";

export interface DashboardStats {
  totalVehicles: number;
  totalTransporters: number;
  activeVehicles: number;
  suspendedVehicles: number;
  failedVehicles: number;
  totalInspections: number;
  monthlyInspections: number;
  todayInspections: number;
  passCount: number;
  failCount: number;
  conditionalCount: number;
  pendingReinspections: number;
  expiringCertificates: number;
  dueInspections: number;
  passRate: number;
  failRate: number;
  complianceRate: number;
}

export async function computeDashboardStats(): Promise<DashboardStats> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const in30 = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
  const in60 = new Date(now.getTime() + 60 * 24 * 3600 * 1000);

  const [vehicleStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${vehicles.status} = 'active')::int`,
      suspended: sql<number>`count(*) filter (where ${vehicles.status} = 'suspended')::int`,
      failed: sql<number>`count(*) filter (where ${vehicles.status} = 'failed')::int`,
    })
    .from(vehicles);

  const [transporterStats] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(transporters)
    .where(sql`${transporters.deletedAt} is null`);

  const [inspectionStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      pass: sql<number>`count(*) filter (where ${inspections.overallResult} = 'pass')::int`,
      fail: sql<number>`count(*) filter (where ${inspections.overallResult} = 'fail')::int`,
      conditional: sql<number>`count(*) filter (where ${inspections.overallResult} in ('conditional_pass','reinspection_required'))::int`,
      month: sql<number>`count(*) filter (where ${inspections.inspectionDate} >= ${startOfMonth})::int`,
      today: sql<number>`count(*) filter (where ${inspections.inspectionDate} >= ${startOfDay})::int`,
      pendingReinsp: sql<number>`count(*) filter (where ${inspections.reinspectionDate} is not null and ${inspections.reinspectionDate} >= CURRENT_DATE)::int`,
    })
    .from(inspections);

  const [expiryStats] = await db
    .select({
      insurance: sql<number>`count(*) filter (where ${vehicles.insuranceExpiry} between CURRENT_DATE and ${in30})::int`,
      roadworthy: sql<number>`count(*) filter (where ${vehicles.roadworthyExpiry} between CURRENT_DATE and ${in30})::int`,
      roadFund: sql<number>`count(*) filter (where ${vehicles.roadFundExpiry} between CURRENT_DATE and ${in30})::int`,
    })
    .from(vehicles);

  const [dueStats] = await db
    .select({ count: sql<number>`count(distinct ${vehicles.id})::int` })
    .from(vehicles)
    .leftJoin(inspections, eq(inspections.vehicleId, vehicles.id))
    .where(
      sql`(
        select max(${inspections.nextInspectionDate})
        from ${inspections}
        where ${inspections.vehicleId} = ${vehicles.id}
      ) between CURRENT_DATE and ${in60}`
    );

  const total = inspectionStats.total || 0;
  const passRate = total ? Math.round((inspectionStats.pass / total) * 100) : 0;
  const failRate = total ? Math.round((inspectionStats.fail / total) * 100) : 0;
  const complianceRate = vehicleStats.total
    ? Math.round(((vehicleStats.active + vehicleStats.total - vehicleStats.failed - vehicleStats.suspended) / vehicleStats.total) * 100)
    : 0;

  return {
    totalVehicles: vehicleStats.total,
    totalTransporters: transporterStats.total,
    activeVehicles: vehicleStats.active,
    suspendedVehicles: vehicleStats.suspended,
    failedVehicles: vehicleStats.failed,
    totalInspections: total,
    monthlyInspections: inspectionStats.month,
    todayInspections: inspectionStats.today,
    passCount: inspectionStats.pass,
    failCount: inspectionStats.fail,
    conditionalCount: inspectionStats.conditional,
    pendingReinspections: inspectionStats.pendingReinsp,
    expiringCertificates: expiryStats.insurance + expiryStats.roadworthy + expiryStats.roadFund,
    dueInspections: dueStats.count,
    passRate,
    failRate,
    complianceRate: Math.min(100, complianceRate),
  };
}

// Trend data: pass/fail/conditional by month for the last 12 months
export interface YearlyData {
  year: number;
  pass: number;
  fail: number;
  conditional: number;
  total: number;
  passRate: number;
  failRate: number;
  yoyGrowth: number | null;
  avgBrakeEfficiency: number;
  avgOpacity: number;
}

export async function getYearlyComparison(): Promise<YearlyData[]> {
  const rows = await db.execute<{
    year: string;
    pass: number;
    fail: number;
    conditional: number;
    total: number;
    avg_brake: string | null;
    avg_opacity: string | null;
  }>(sql`
    select
      to_char(date_trunc('year', ${inspections.inspectionDate}), 'YYYY') as year,
      count(*) filter (where ${inspections.overallResult} = 'pass')::int as pass,
      count(*) filter (where ${inspections.overallResult} = 'fail')::int as fail,
      count(*) filter (where ${inspections.overallResult} in ('conditional_pass','reinspection_required'))::int as conditional,
      count(*)::int as total,
      round(avg(nullif(${inspections.serviceBrakeEfficiency}::numeric, 0)), 2) as avg_brake,
      round(avg(nullif(${inspections.opacityTest}::numeric, 0)), 2) as avg_opacity
    from ${inspections}
    where ${inspections.inspectionDate} >= CURRENT_DATE - interval '10 years'
    group by date_trunc('year', ${inspections.inspectionDate})
    order by year asc
  `);

  const data: YearlyData[] = rows.rows.map((r, idx) => {
    const total = r.total || 1;
    const passRate = Math.round((r.pass / total) * 1000) / 10;
    const failRate = Math.round((r.fail / total) * 1000) / 10;
    const prevTotal = idx > 0 ? rows.rows[idx - 1].total : null;
    const yoyGrowth = prevTotal && prevTotal > 0
      ? Math.round(((r.total - prevTotal) / prevTotal) * 1000) / 10
      : null;
    return {
      year: parseInt(r.year),
      pass: r.pass,
      fail: r.fail,
      conditional: r.conditional,
      total: r.total,
      passRate,
      failRate,
      yoyGrowth,
      avgBrakeEfficiency: parseFloat(r.avg_brake || "0"),
      avgOpacity: parseFloat(r.avg_opacity || "0"),
    };
  });

  return data;
}

export async function getMonthlyTrend() {
  const rows = await db.execute<{ month: string; pass: number; fail: number; conditional: number }>(sql`
    select
      to_char(date_trunc('month', ${inspections.inspectionDate}), 'YYYY-MM') as month,
      count(*) filter (where ${inspections.overallResult} = 'pass')::int as pass,
      count(*) filter (where ${inspections.overallResult} = 'fail')::int as fail,
      count(*) filter (where ${inspections.overallResult} in ('conditional_pass','reinspection_required'))::int as conditional
    from ${inspections}
    where ${inspections.inspectionDate} >= CURRENT_DATE - interval '12 months'
    group by date_trunc('month', ${inspections.inspectionDate})
    order by month asc
  `);
  return rows.rows;
}

// Station comparison
export async function getStationStats() {
  const rows = await db.execute<{ station: string; inspections: number; pass: number; fail: number; passRate: number }>(sql`
    select
      coalesce(l.name, 'Unknown') as station,
      count(*)::int as inspections,
      count(*) filter (where ${inspections.overallResult} = 'pass')::int as pass,
      count(*) filter (where ${inspections.overallResult} = 'fail')::int as fail,
      case when count(*) > 0
        then round((count(*) filter (where ${inspections.overallResult} = 'pass')::numeric / count(*)::numeric) * 100, 1)
        else 0
      end as pass_rate
    from ${inspections}
    left join locations l on l.id = ${inspections.locationId}
    group by l.name
    order by inspections desc
  `);
  return rows.rows;
}

// Transporter performance
export async function getTransporterPerformance() {
  const rows = await db.execute<{ transporter: string; fleet: number; inspections: number; pass: number; fail: number; passRate: number }>(sql`
    select
      t.company_name as transporter,
      count(distinct v.id)::int as fleet,
      count(i.id)::int as inspections,
      count(*) filter (where i.overall_result = 'pass')::int as pass,
      count(*) filter (where i.overall_result = 'fail')::int as fail,
      case when count(i.id) > 0
        then round((count(*) filter (where i.overall_result = 'pass')::numeric / count(i.id)::numeric) * 100, 1)
        else 0
      end as pass_rate
    from transporters t
    left join vehicles v on v.transporter_id = t.id
    left join inspections i on i.vehicle_id = v.id
    where t.deleted_at is null
    group by t.id, t.company_name
    order by inspections desc
  `);
  return rows.rows;
}

// Common defects (from section_data JSONB)
export async function getCommonDefects() {
  const rows = await db.execute<{ section: string; item: string; failures: number }>(sql`
    select
      sec->>'section' as section,
      item->>'name' as item,
      count(*)::int as failures
    from ${inspections},
    jsonb_array_elements(${inspections.sectionData}) as sec,
    jsonb_array_elements(sec->'items') as item
    where item->>'result' = 'fail'
    group by sec->>'section', item->>'name'
    order by failures desc
    limit 10
  `);
  return rows.rows;
}

// Vehicle categories distribution
export async function getCategoryDistribution() {
  const rows = await db.execute<{ category: string; count: number }>(sql`
    select coalesce(category, 'Unspecified') as category, count(*)::int as count
    from ${vehicles}
    group by category
    order by count desc
  `);
  return rows.rows;
}

// Regional comparison
export async function getRegionalStats() {
  const rows = await db.execute<{ region: string; vehicles: number; inspections: number; passRate: number }>(sql`
    select
      coalesce(t.region, 'Unassigned') as region,
      count(distinct v.id)::int as vehicles,
      count(i.id)::int as inspections,
      case when count(i.id) > 0
        then round((count(*) filter (where i.overall_result = 'pass')::numeric / count(i.id)::numeric) * 100, 1)
        else 0
      end as pass_rate
    from vehicles v
    left join transporters t on t.id = v.transporter_id
    left join inspections i on i.vehicle_id = v.id
    group by t.region
    order by vehicles desc
  `);
  return rows.rows;
}

// Inspector performance
export async function getInspectorPerformance() {
  const rows = await db.execute<{ inspector: string; inspections: number; pass: number; fail: number; avgDuration: number }>(sql`
    select
      coalesce(${inspections.inspectorName}, 'Unknown') as inspector,
      count(*)::int as inspections,
      count(*) filter (where ${inspections.overallResult} = 'pass')::int as pass,
      count(*) filter (where ${inspections.overallResult} = 'fail')::int as fail,
      0::int as avg_duration
    from ${inspections}
    where ${inspections.inspectorName} is not null
    group by ${inspections.inspectorName}
    order by inspections desc
  `);
  return rows.rows;
}
