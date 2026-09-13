import { db } from "@/db";
import { inspections, vehicles, transporters } from "@/db/schema";
import { sql } from "drizzle-orm";
import { calculateFleetReadiness } from "@/lib/metrics";

export interface DashboardStats {
  totalVehicles: number;
  totalTransporters: number;
  activeVehicles: number;
  suspendedVehicles: number;
  failedVehicles: number;
  readyVehicles: number;
  eligibleVehicles: number;
  fleetReadinessRate: number;
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
  /** Backward-compatible alias for fleetReadinessRate. */
  complianceRate: number;
}

interface DashboardAggregateRow {
  total_vehicles: number;
  active_vehicles: number;
  passed_vehicles: number;
  suspended_vehicles: number;
  failed_vehicles: number;
  decommissioned_vehicles: number;
  insurance_expiring: number;
  roadworthy_expiring: number;
  road_fund_expiring: number;
  total_transporters: number;
  total_inspections: number;
  pass_count: number;
  fail_count: number;
  conditional_count: number;
  monthly_inspections: number;
  today_inspections: number;
  pending_reinspections: number;
  due_inspections: number;
}

export async function computeDashboardStats(): Promise<DashboardStats> {
  // Keep the dashboard snapshot internally consistent and use one database
  // round trip. This matters because the reports page executes several other
  // analytics queries concurrently and the serverless pool is intentionally
  // small.
  const result = await db.execute<DashboardAggregateRow & Record<string, unknown>>(sql`
    with vehicle_stats as (
      select
        count(*)::int as total_vehicles,
        count(*) filter (where ${vehicles.status} = 'active')::int as active_vehicles,
        count(*) filter (where ${vehicles.status} = 'passed')::int as passed_vehicles,
        count(*) filter (where ${vehicles.status} = 'suspended')::int as suspended_vehicles,
        count(*) filter (where ${vehicles.status} = 'failed')::int as failed_vehicles,
        count(*) filter (where ${vehicles.status} = 'decommissioned')::int as decommissioned_vehicles,
        count(*) filter (
          where ${vehicles.insuranceExpiry}
            between CURRENT_DATE and CURRENT_DATE + interval '30 days'
        )::int as insurance_expiring,
        count(*) filter (
          where ${vehicles.roadworthyExpiry}
            between CURRENT_DATE and CURRENT_DATE + interval '30 days'
        )::int as roadworthy_expiring,
        count(*) filter (
          where ${vehicles.roadFundExpiry}
            between CURRENT_DATE and CURRENT_DATE + interval '30 days'
        )::int as road_fund_expiring
      from ${vehicles}
    ),
    transporter_stats as (
      select count(*)::int as total_transporters
      from ${transporters}
      where ${transporters.deletedAt} is null
    ),
    inspection_stats as (
      select
        count(*)::int as total_inspections,
        count(*) filter (where ${inspections.overallResult} = 'pass')::int as pass_count,
        count(*) filter (where ${inspections.overallResult} = 'fail')::int as fail_count,
        count(*) filter (
          where ${inspections.overallResult} in ('conditional_pass', 'reinspection_required')
        )::int as conditional_count,
        count(*) filter (
          where ${inspections.inspectionDate} >= date_trunc('month', CURRENT_DATE)
        )::int as monthly_inspections,
        count(*) filter (
          where ${inspections.inspectionDate} >= CURRENT_DATE
        )::int as today_inspections,
        count(*) filter (
          where ${inspections.reinspectionDate} is not null
            and ${inspections.reinspectionDate} >= CURRENT_DATE
        )::int as pending_reinspections
      from ${inspections}
    ),
    due_stats as (
      select count(*)::int as due_inspections
      from (
        select
          ${inspections.vehicleId} as vehicle_id,
          max(${inspections.nextInspectionDate}) as due_date
        from ${inspections}
        group by ${inspections.vehicleId}
      ) latest
      where latest.due_date
        between CURRENT_DATE and CURRENT_DATE + interval '60 days'
    )
    select
      v.total_vehicles,
      v.active_vehicles,
      v.passed_vehicles,
      v.suspended_vehicles,
      v.failed_vehicles,
      v.decommissioned_vehicles,
      v.insurance_expiring,
      v.roadworthy_expiring,
      v.road_fund_expiring,
      t.total_transporters,
      i.total_inspections,
      i.pass_count,
      i.fail_count,
      i.conditional_count,
      i.monthly_inspections,
      i.today_inspections,
      i.pending_reinspections,
      d.due_inspections
    from vehicle_stats v
    cross join transporter_stats t
    cross join inspection_stats i
    cross join due_stats d
  `);

  const stats = result.rows[0];
  if (!stats) {
    throw new Error("Dashboard aggregate query returned no row");
  }

  const total = stats.total_inspections || 0;
  const passRate = total ? Math.round((stats.pass_count / total) * 100) : 0;
  const failRate = total ? Math.round((stats.fail_count / total) * 100) : 0;
  const readiness = calculateFleetReadiness({
    total: stats.total_vehicles,
    active: stats.active_vehicles,
    passed: stats.passed_vehicles,
    decommissioned: stats.decommissioned_vehicles,
  });

  return {
    totalVehicles: stats.total_vehicles,
    totalTransporters: stats.total_transporters,
    activeVehicles: stats.active_vehicles,
    suspendedVehicles: stats.suspended_vehicles,
    failedVehicles: stats.failed_vehicles,
    readyVehicles: readiness.readyVehicles,
    eligibleVehicles: readiness.eligibleVehicles,
    fleetReadinessRate: readiness.fleetReadinessRate,
    totalInspections: total,
    monthlyInspections: stats.monthly_inspections,
    todayInspections: stats.today_inspections,
    passCount: stats.pass_count,
    failCount: stats.fail_count,
    conditionalCount: stats.conditional_count,
    pendingReinspections: stats.pending_reinspections,
    expiringCertificates:
      stats.insurance_expiring + stats.roadworthy_expiring + stats.road_fund_expiring,
    dueInspections: stats.due_inspections,
    passRate,
    failRate,
    complianceRate: readiness.fleetReadinessRate,
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
  const rows = await db.execute<{
    station: string;
    inspections: number;
    pass: number;
    fail: number;
    pass_rate: string | number | null;
  }>(sql`
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

  return rows.rows.map((row) => ({
    station: row.station,
    inspections: Number(row.inspections || 0),
    pass: Number(row.pass || 0),
    fail: Number(row.fail || 0),
    passRate: Number(row.pass_rate || 0),
  }));
}

// Transporter performance
export async function getTransporterPerformance() {
  const rows = await db.execute<{
    transporter: string;
    fleet: number;
    inspections: number;
    pass: number;
    fail: number;
    pass_rate: string | number | null;
  }>(sql`
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

  return rows.rows.map((row) => ({
    transporter: row.transporter,
    fleet: Number(row.fleet || 0),
    inspections: Number(row.inspections || 0),
    pass: Number(row.pass || 0),
    fail: Number(row.fail || 0),
    passRate: Number(row.pass_rate || 0),
  }));
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

// Regional comparison. Region is the transporter operating region recorded on the transporter profile.
export async function getRegionalStats() {
  const rows = await db.execute<{
    region: string;
    vehicles: number;
    inspections: number;
    pass: number;
    fail: number;
    conditional: number;
    pass_rate: string | number | null;
  }>(sql`
    select
      coalesce(nullif(trim(t.region), ''), 'Unassigned') as region,
      count(distinct v.id)::int as vehicles,
      count(i.id)::int as inspections,
      count(i.id) filter (where i.overall_result = 'pass')::int as pass,
      count(i.id) filter (where i.overall_result = 'fail')::int as fail,
      count(i.id) filter (where i.overall_result in ('conditional_pass','reinspection_required'))::int as conditional,
      case when count(i.id) > 0
        then round((count(i.id) filter (where i.overall_result = 'pass')::numeric / count(i.id)::numeric) * 100, 1)
        else null
      end as pass_rate
    from vehicles v
    left join transporters t on t.id = v.transporter_id and t.deleted_at is null
    left join inspections i on i.vehicle_id = v.id
    group by coalesce(nullif(trim(t.region), ''), 'Unassigned')
    order by vehicles desc, region asc
  `);

  return rows.rows.map((row) => ({
    region: row.region,
    vehicles: Number(row.vehicles || 0),
    inspections: Number(row.inspections || 0),
    pass: Number(row.pass || 0),
    fail: Number(row.fail || 0),
    conditional: Number(row.conditional || 0),
    passRate: row.pass_rate === null ? null : Number(row.pass_rate),
  }));
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
