import { PageHeader, StatCard, Card, Badge } from "@/components/ui";
import {
  Car, Truck, ClipboardCheck, CheckCircle2, XCircle, AlertTriangle,
  Calendar, Activity, Shield, Bell, TrendingUp, CalendarCheck,
} from "lucide-react";
import { requireAuth } from "@/lib/require-auth";
import { db } from "@/db";
import { dailyInspections, vehicles } from "@/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import {
  computeDashboardStats, getMonthlyTrend, getStationStats,
  getTransporterPerformance, getCommonDefects, getCategoryDistribution,
  getRegionalStats, getInspectorPerformance, getYearlyComparison,
} from "@/lib/analytics";
import {
  TrendChart, StationChart, TransporterChart, DefectsChart,
  CategoryPie, RegionHeatMap, InspectorChart,
} from "@/components/Charts";
import { YearlyComparisonChart } from "@/components/YearlyComparisonChart";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireAuth();
  const today = new Date().toISOString().slice(0, 10);
  const [
    stats, trend, stations, transporters, defects, categories, regions, inspectors, yearlyData, todaysDaily,
  ] = await Promise.all([
    computeDashboardStats(),
    getMonthlyTrend(),
    getStationStats(),
    getTransporterPerformance(),
    getCommonDefects(),
    getCategoryDistribution(),
    getRegionalStats(),
    getInspectorPerformance(),
    getYearlyComparison(),
    db
      .select({
        id: dailyInspections.id,
        inspectionDate: dailyInspections.inspectionDate,
        status: dailyInspections.status,
        driverName: dailyInspections.driverName,
        clearedForTrip: dailyInspections.clearedForTrip,
        passedItems: dailyInspections.passedItems,
        totalItems: dailyInspections.totalItems,
        regNumber: vehicles.registrationNumber,
      })
      .from(dailyInspections)
      .innerJoin(vehicles, eq(vehicles.id, dailyInspections.vehicleId))
      .where(eq(dailyInspections.inspectionDate, today))
      .orderBy(desc(dailyInspections.completedAt))
      .limit(5),
  ]);

  return (
    <div className="p-4 sm:p-6 lg:p-10">
      <PageHeader
        eyebrow="Operations Overview"
        title="Executive Dashboard"
        description="Real-time KPIs across vehicles, transporters, inspection stations, and compliance metrics."
        action={
          <Link href="/reports">
            <span className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors">
              <TrendingUp className="h-4 w-4" /> 
              <span className="hidden sm:inline">Advanced Reports</span>
              <span className="sm:hidden">Reports</span>
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        }
      />

      {/* KPI Cards — 2 rows */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <StatCard label="Total Vehicles" value={stats.totalVehicles} tone="blue" icon={<Car className="h-4 w-4 sm:h-5 sm:w-5" />} />
        <StatCard label="Transporters" value={stats.totalTransporters} tone="violet" icon={<Truck className="h-4 w-4 sm:h-5 sm:w-5" />} />
        <StatCard label="Active" value={stats.activeVehicles} hint={`${stats.suspendedVehicles} suspended`} tone="emerald" icon={<Activity className="h-4 w-4 sm:h-5 sm:w-5" />} />
        <StatCard label="Today" value={stats.todayInspections} hint={`${stats.monthlyInspections} this month`} tone="slate" icon={<Calendar className="h-4 w-4 sm:h-5 sm:w-5" />} />
        <StatCard label="Pass Rate" value={`${stats.passRate}%`} hint={`${stats.passCount} passed`} tone="emerald" icon={<CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />} />
        <StatCard label="Fail Rate" value={`${stats.failRate}%`} hint={`${stats.failCount} failed`} tone="red" icon={<XCircle className="h-4 w-4 sm:h-5 sm:w-5" />} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mt-3 sm:mt-4">
        <StatCard label="Total Inspections" value={stats.totalInspections} tone="slate" icon={<ClipboardCheck className="h-4 w-4 sm:h-5 sm:w-5" />} />
        <StatCard label="Daily Pre-Trip" value={todaysDaily.length} hint="completed today" tone="blue" icon={<CalendarCheck className="h-4 w-4 sm:h-5 sm:w-5" />} />
        <StatCard label="Re-inspections" value={stats.pendingReinspections} tone="amber" icon={<AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />} />
        <StatCard label="Due Soon" value={stats.dueInspections} hint="within 60 days" tone="blue" icon={<Calendar className="h-4 w-4 sm:h-5 sm:w-5" />} />
        <StatCard label="Expiring" value={stats.expiringCertificates} hint="within 30 days" tone="amber" icon={<Bell className="h-4 w-4 sm:h-5 sm:w-5" />} />
        <StatCard label="Conditional" value={stats.conditionalCount} tone="amber" icon={<AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />} />
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-4 sm:mt-6">
        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-semibold text-slate-950 truncate">Pass vs Fail — 12-Month Trend</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Monthly inspection outcomes</p>
            </div>
          </div>
          <TrendChart data={trend as any} />
        </Card>

        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-semibold text-slate-950 truncate">Station Comparison</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Inspection performance by station</p>
            </div>
          </div>
          <StationChart data={stations as any} />
        </Card>

        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-semibold text-slate-950 truncate">Transporter Performance</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Top transporters by volume</p>
            </div>
          </div>
          <TransporterChart data={transporters as any} />
        </Card>

        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-semibold text-slate-950 truncate">Common Defects</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Top 10 most-failed items</p>
            </div>
          </div>
          <DefectsChart data={defects as any} />
        </Card>

        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-semibold text-slate-950 truncate">Vehicle Categories</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Distribution of vehicles</p>
            </div>
          </div>
          <CategoryPie data={categories as any} />
        </Card>

        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-semibold text-slate-950 truncate">Inspector Productivity</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Top 5 inspectors</p>
            </div>
          </div>
          <InspectorChart data={inspectors as any} />
        </Card>
      </div>

      {/* Yearly Comparison Trend Chart */}
      <Card className="p-6 mt-6">
        <YearlyComparisonChart data={yearlyData} showStats={true} />
      </Card>

      <Card className="p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Regional Compliance Heat Map</h2>
            <p className="text-sm text-slate-500">Pass rate intensity per region</p>
          </div>
          <Badge tone="emerald">{regions.length} regions</Badge>
        </div>
        <RegionHeatMap data={regions as any} />
      </Card>

      <Card className="p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 flex items-center gap-2">
              <CalendarCheck className="h-5 w-5" /> Today&apos;s Pre-Trip Inspections
            </h2>
            <p className="text-sm text-slate-500">
              Daily inspections that must be completed before each vehicle leaves the yard
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="blue">{todaysDaily.length} today</Badge>
            <Link href="/daily-inspections" className="text-sm text-amber-700 font-medium">View all →</Link>
          </div>
        </div>
        {todaysDaily.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg">
            <CalendarCheck className="h-8 w-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm text-slate-600 mb-3">No pre-trip inspections recorded today</p>
            <Link href="/daily-inspections/new" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">
              Start Today&apos;s Inspection
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {todaysDaily.map((d) => (
              <Link key={d.id} href={`/daily-inspections/${d.id}`} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-slate-100 grid place-items-center">
                    <Truck className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{d.regNumber}</p>
                    <p className="text-xs text-slate-500">Driver: {d.driverName} · {d.passedItems}/{d.totalItems} passed</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {d.status === "passed" && <Badge tone="emerald"><CheckCircle2 className="h-3.5 w-3.5" /> Pass</Badge>}
                  {d.status === "failed" && <Badge tone="red"><XCircle className="h-3.5 w-3.5" /> Fail</Badge>}
                  {d.status === "defect_noted" && <Badge tone="amber"><AlertTriangle className="h-3.5 w-3.5" /> Defect</Badge>}
                  {d.clearedForTrip ? (
                    <span className="text-xs text-emerald-700 font-medium">✓ Cleared</span>
                  ) : (
                    <span className="text-xs text-red-700 font-medium">✗ Grounded</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
