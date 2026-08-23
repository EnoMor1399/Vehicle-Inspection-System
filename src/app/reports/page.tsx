import { PageHeader, Card, Badge } from "@/components/ui";
import {
  computeDashboardStats, getMonthlyTrend, getStationStats,
  getTransporterPerformance, getCommonDefects, getRegionalStats, getInspectorPerformance,
  getYearlyComparison,
} from "@/lib/analytics";
import {
  TrendChart, StationChart, TransporterChart, DefectsChart, RegionHeatMap, InspectorChart,
} from "@/components/Charts";
import { YearlyComparisonChart } from "@/components/YearlyComparisonChart";
import { db } from "@/db";
import { inspections, vehicles, transporters, locations } from "@/db/schema";
import { sql, eq, desc } from "drizzle-orm";
import { formatDate } from "@/lib/utils";
import { FileBarChart } from "lucide-react";
import Link from "next/link";
import { getCurrentUser, canViewReports, ROLE_LABEL } from "@/lib/auth";
import { ReportsActions } from "./ReportsActions";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!canViewReports(user)) {
    return (
      <div className="p-10"><Card className="p-8"><p className="text-slate-700">You do not have permission to view reports.</p></Card></div>
    );
  }

  const [stats, trend, stations, transportersPerf, defects, regions, inspectors, yearlyData, recent] = await Promise.all([
    computeDashboardStats(),
    getMonthlyTrend(),
    getStationStats(),
    getTransporterPerformance(),
    getCommonDefects(),
    getRegionalStats(),
    getInspectorPerformance(),
    getYearlyComparison(),
    db
      .select({
        number: inspections.inspectionNumber,
        reg: vehicles.registrationNumber,
        transporter: transporters.companyName,
        date: inspections.inspectionDate,
        result: inspections.overallResult,
        station: locations.name,
      })
      .from(inspections)
      .leftJoin(vehicles, eq(vehicles.id, inspections.vehicleId))
      .leftJoin(transporters, eq(transporters.id, vehicles.transporterId))
      .leftJoin(locations, eq(locations.id, inspections.locationId))
      .orderBy(desc(inspections.inspectionDate))
      .limit(10),
  ]);

  return (
    <div className="p-6 lg:p-10">
      <PageHeader
        eyebrow="Analytics & Reporting"
        title="Reports & Analytics"
        description="Interactive dashboards, exportable reports, and scheduled summaries. Drill down into any KPI or export to PDF/Excel/CSV."
        action={
          <ReportsActions recentData={recent} stats={stats} />
        }
      />

      <div className="rounded-xl bg-white ring-1 ring-slate-200 p-4 mb-6">
        <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">Report Filters</p>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 text-sm">
          <Filter label="Period" value="This Year" />
          <Filter label="Region" value="All Regions" />
          <Filter label="Station" value="All Stations" />
          <Filter label="Transporter" value="All" />
          <Filter label="Inspector" value="All" />
          <Filter label="Result" value="All Results" />
          <Filter label="Vehicle" value="All Categories" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4"><p className="text-xs text-slate-500">Pass Rate (YTD)</p><p className="text-3xl font-semibold text-emerald-600 mt-1">{stats.passRate}%</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500">Monthly Inspections</p><p className="text-3xl font-semibold text-slate-900 mt-1">{stats.monthlyInspections}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500">Re-inspections Pending</p><p className="text-3xl font-semibold text-amber-600 mt-1">{stats.pendingReinspections}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500">Compliance Score</p><p className="text-3xl font-semibold text-emerald-600 mt-1">{stats.complianceRate}%</p></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-950 mb-1">Annual Trend</h2>
          <p className="text-sm text-slate-500 mb-4">12-month pass/fail/conditional</p>
          <TrendChart data={trend as any} />
        </Card>
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-950 mb-1">Station Comparison</h2>
          <p className="text-sm text-slate-500 mb-4">Inspection outcomes by station</p>
          <StationChart data={stations as any} />
        </Card>
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-950 mb-1">Transporter Performance</h2>
          <p className="text-sm text-slate-500 mb-4">Ranked by pass rate</p>
          <TransporterChart data={transportersPerf as any} />
        </Card>
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-950 mb-1">Common Defects</h2>
          <p className="text-sm text-slate-500 mb-4">Top failure items</p>
          <DefectsChart data={defects as any} />
        </Card>
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-950 mb-1">Inspector Productivity</h2>
          <p className="text-sm text-slate-500 mb-4">Top inspectors</p>
          <InspectorChart data={inspectors as any} />
        </Card>
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-950 mb-1">Regional Heat Map</h2>
          <p className="text-sm text-slate-500 mb-4">Compliance by region</p>
          <RegionHeatMap data={regions as any} />
        </Card>
      </div>

      <Card className="p-6 mt-6">
        <YearlyComparisonChart data={yearlyData} showStats={true} />
      </Card>

      <Card className="p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 flex items-center gap-2"><FileBarChart className="h-5 w-5" /> Latest Inspection Records</h2>
            <p className="text-sm text-slate-500">Ready for PDF / Excel / CSV export</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="slate">{recent.length} records</Badge>
            <Link href="/inspections" className="text-sm text-amber-700 font-medium">View all →</Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-2 pr-4 text-left">Number</th>
                <th className="py-2 pr-4 text-left">Vehicle</th>
                <th className="py-2 pr-4 text-left">Transporter</th>
                <th className="py-2 pr-4 text-left">Station</th>
                <th className="py-2 pr-4 text-left">Date</th>
                <th className="py-2 pr-4 text-left">Result</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.number} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-4 font-mono text-slate-700">{r.number}</td>
                  <td className="py-2 pr-4">{r.reg}</td>
                  <td className="py-2 pr-4 text-slate-600">{r.transporter || "—"}</td>
                  <td className="py-2 pr-4 text-slate-600">{r.station || "—"}</td>
                  <td className="py-2 pr-4 text-slate-600">{formatDate(r.date)}</td>
                  <td className="py-2 pr-4"><ResultBadge result={r.result} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Filter({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <select className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none">
        <option>{value}</option>
      </select>
    </div>
  );
}

function ResultBadge({ result }: { result: string }) {
  const map: Record<string, { tone: "emerald" | "red" | "amber" | "slate"; label: string }> = {
    pass: { tone: "emerald", label: "Pass" }, fail: { tone: "red", label: "Fail" }, conditional_pass: { tone: "amber", label: "Conditional" }, reinspection_required: { tone: "amber", label: "Re-inspect" },
  };
  const m = map[result] || { tone: "slate" as const, label: result };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}
