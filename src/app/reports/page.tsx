import type { ReactNode } from "react";
import { Card, Badge } from "@/components/ui";
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
import { eq, desc } from "drizzle-orm";
import { formatDate } from "@/lib/utils";
import {
  Activity,
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileBarChart,
  MapPinned,
  RefreshCcw,
  ShieldCheck,
  TriangleAlert,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { canViewReports } from "@/lib/auth";
import { requireInternalUser } from "@/lib/require-auth";
import { ReportsActions } from "./ReportsActions";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const user = await requireInternalUser();
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
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-blue-50/40 to-violet-50/50 p-4 sm:p-6 lg:p-10">
      <section className="relative mb-6 overflow-hidden rounded-[28px] bg-gradient-to-br from-blue-700 via-indigo-700 to-violet-700 px-5 py-6 text-white shadow-[0_22px_65px_rgba(79,70,229,0.28)] sm:px-7 sm:py-8 lg:px-9">
        <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-cyan-300/35 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-36 left-1/3 h-72 w-72 rounded-full bg-fuchsia-400/25 blur-3xl" />
        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <div className="max-w-3xl">
            <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200">
              <span className="h-px w-8 bg-cyan-300" />
              Intelligence centre
            </div>
            <h1 className="text-2xl font-semibold tracking-[-0.035em] sm:text-3xl lg:text-[34px]">Reports &amp; Analytics</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-[15px]">
              Monitor inspection outcomes, compliance performance and operational trends from one controlled reporting workspace.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-slate-300">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/8 px-3 py-1.5 ring-1 ring-inset ring-white/10">
                <Activity className="h-3.5 w-3.5 text-cyan-200" />
                Live database view
              </span>
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-cyan-200" />
                Role-controlled reporting scope
              </span>
            </div>
          </div>
          <div className="rounded-2xl bg-white p-3 text-slate-900 shadow-lg ring-1 ring-white/20">
            <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">Export report</p>
            <ReportsActions recentData={recent} stats={stats} />
          </div>
        </div>
      </section>

      <section aria-label="Key reporting metrics" className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ReportMetricCard
          label="Pass rate"
          value={stats.passRate + "%"}
          hint="Year-to-date outcome"
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="emerald"
          progress={stats.passRate}
        />
        <ReportMetricCard
          label="Monthly inspections"
          value={stats.monthlyInspections}
          hint="Completed this month"
          icon={<ClipboardCheck className="h-5 w-5" />}
          tone="blue"
        />
        <ReportMetricCard
          label="Pending re-inspections"
          value={stats.pendingReinspections}
          hint="Awaiting follow-up"
          icon={<RefreshCcw className="h-5 w-5" />}
          tone="orange"
        />
        <ReportMetricCard
          label="Compliance score"
          value={stats.complianceRate + "%"}
          hint="Fleet policy alignment"
          icon={<ShieldCheck className="h-5 w-5" />}
          tone="violet"
          progress={stats.complianceRate}
        />
      </section>

      <section className="mb-8">
        <SectionHeading
          eyebrow="Outcome intelligence"
          title="Inspection performance"
          description="A clear view of result movement over time and performance differences across inspection stations."
        />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(380px,0.75fr)]">
          <AnalyticsPanel
            icon={<Activity className="h-5 w-5" />}
            title="Annual outcome trend"
            description="Monthly pass, fail and conditional inspection outcomes"
            accent="emerald"
          >
            <TrendChart data={trend as any} />
          </AnalyticsPanel>
          <AnalyticsPanel
            icon={<Building2 className="h-5 w-5" />}
            title="Station comparison"
            description="Total inspection outcomes by operating station"
            accent="blue"
          >
            <StationChart data={stations as any} />
          </AnalyticsPanel>
        </div>
      </section>

      <section className="mb-8">
        <SectionHeading
          eyebrow="Operational analysis"
          title="Performance drivers"
          description="Compare transporters and inspectors, then identify the defects and regions requiring attention."
        />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <AnalyticsPanel
            icon={<BarChart3 className="h-5 w-5" />}
            title="Transporter performance"
            description="Leading transporters ranked by inspection outcome"
            accent="violet"
          >
            <TransporterChart data={transportersPerf as any} />
          </AnalyticsPanel>
          <AnalyticsPanel
            icon={<TriangleAlert className="h-5 w-5" />}
            title="Common defects"
            description="Most frequent inspection failure items"
            accent="rose"
          >
            <DefectsChart data={defects as any} />
          </AnalyticsPanel>
          <AnalyticsPanel
            icon={<UsersRound className="h-5 w-5" />}
            title="Inspector productivity"
            description="Completed inspection outcomes by inspector"
            accent="cyan"
          >
            <InspectorChart data={inspectors as any} />
          </AnalyticsPanel>
          <AnalyticsPanel
            icon={<MapPinned className="h-5 w-5" />}
            title="Regional compliance"
            description="Pass-rate distribution across operating regions"
            accent="amber"
          >
            <RegionHeatMap data={regions as any} />
          </AnalyticsPanel>
        </div>
      </section>

      <section className="mb-8">
        <SectionHeading
          eyebrow="Long-term view"
          title="Yearly performance comparison"
          description="Review annual inspection volume, pass rates and year-over-year movement."
        />
        <Card className="overflow-hidden p-5 sm:p-6">
          <YearlyComparisonChart data={yearlyData} showStats={true} />
        </Card>
      </section>

      <section>
        <SectionHeading
          eyebrow="Inspection register"
          title="Latest records"
          description="The most recent inspection records available within your reporting permissions."
        />
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-700">
                  <FileBarChart className="h-4.5 w-4.5" />
                </span>
                Recent inspection activity
              </h2>
              <p className="mt-1 text-xs text-slate-500">Prepared for PDF, Excel and CSV export</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge tone="slate">{recent.length} records</Badge>
              <Link href="/inspections" className="text-sm font-semibold text-blue-700 transition hover:text-indigo-800">View all inspections →</Link>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold">Number</th>
                  <th className="px-4 py-3 text-left font-semibold">Vehicle</th>
                  <th className="px-4 py-3 text-left font-semibold">Transporter</th>
                  <th className="px-4 py-3 text-left font-semibold">Station</th>
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recent.length > 0 ? recent.map((record) => (
                  <tr key={record.number} className="transition-colors hover:bg-slate-50/80">
                    <td className="px-6 py-3.5 font-mono text-xs font-semibold text-slate-700">{record.number}</td>
                    <td className="px-4 py-3.5 font-medium text-slate-900">{record.reg}</td>
                    <td className="px-4 py-3.5 text-slate-600">{record.transporter || "—"}</td>
                    <td className="px-4 py-3.5 text-slate-600">{record.station || "—"}</td>
                    <td className="px-4 py-3.5 text-slate-600">{formatDate(record.date)}</td>
                    <td className="px-4 py-3.5"><ResultBadge result={record.result} /></td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">No inspection records are available yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  );
}

type MetricTone = "emerald" | "blue" | "orange" | "violet";

function ReportMetricCard({
  label,
  value,
  hint,
  icon,
  tone,
  progress,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: ReactNode;
  tone: MetricTone;
  progress?: number;
}) {
  const toneStyles: Record<MetricTone, { icon: string; bar: string }> = {
    emerald: { icon: "bg-emerald-50 text-emerald-700 ring-emerald-200", bar: "bg-gradient-to-r from-emerald-500 to-teal-400" },
    blue: { icon: "bg-blue-50 text-blue-700 ring-blue-200", bar: "bg-gradient-to-r from-blue-600 to-cyan-400" },
    orange: { icon: "bg-orange-50 text-orange-700 ring-orange-200", bar: "bg-gradient-to-r from-amber-400 to-orange-500" },
    violet: { icon: "bg-violet-50 text-violet-700 ring-violet-200", bar: "bg-gradient-to-r from-violet-600 to-fuchsia-500" },
  };
  const styles = toneStyles[tone];
  const safeProgress = progress === undefined ? undefined : Math.max(0, Math.min(100, progress));

  return (
    <Card className="group relative overflow-hidden p-5">
      <span className={"absolute inset-x-0 top-0 h-[3px] " + styles.bar} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
          <p className="mt-2 text-[30px] font-semibold tracking-[-0.04em] text-slate-950">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{hint}</p>
        </div>
        <span className={"grid h-11 w-11 shrink-0 place-items-center rounded-xl ring-1 ring-inset " + styles.icon}>
          {icon}
        </span>
      </div>
      {safeProgress !== undefined ? (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-label={label + " " + safeProgress + "%"}>
          <div className={"h-full rounded-full " + styles.bar} style={{ width: safeProgress + "%" }} />
        </div>
      ) : (
        <div className="mt-4 h-1.5 rounded-full bg-slate-100">
          <div className={"h-full w-2/5 rounded-full " + styles.bar} />
        </div>
      )}
    </Card>
  );
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-700">{eyebrow}</p>
        <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-slate-950">{title}</h2>
      </div>
      <p className="max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}

type PanelAccent = "emerald" | "blue" | "violet" | "rose" | "cyan" | "amber";

function AnalyticsPanel({
  icon,
  title,
  description,
  accent,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  accent: PanelAccent;
  children: ReactNode;
}) {
  const accents: Record<PanelAccent, string> = {
    emerald: "bg-gradient-to-br from-emerald-50 to-teal-100 text-emerald-700 ring-emerald-200",
    blue: "bg-gradient-to-br from-blue-50 to-cyan-100 text-blue-700 ring-blue-200",
    violet: "bg-gradient-to-br from-violet-50 to-fuchsia-100 text-violet-700 ring-violet-200",
    rose: "bg-gradient-to-br from-rose-50 to-pink-100 text-rose-700 ring-rose-200",
    cyan: "bg-gradient-to-br from-cyan-50 to-sky-100 text-cyan-700 ring-cyan-200",
    amber: "bg-gradient-to-br from-amber-50 to-orange-100 text-amber-700 ring-amber-200",
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
        <span className={"grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ring-inset " + accents[accent]}>
          {icon}
        </span>
        <div>
          <h3 className="font-semibold text-slate-950">{title}</h3>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p>
        </div>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </Card>
  );
}

function ResultBadge({ result }: { result: string }) {
  const map: Record<string, { tone: "emerald" | "red" | "amber" | "slate"; label: string }> = {
    pass: { tone: "emerald", label: "Pass" },
    fail: { tone: "red", label: "Fail" },
    conditional_pass: { tone: "amber", label: "Conditional" },
    reinspection_required: { tone: "amber", label: "Re-inspect" },
  };
  const mapped = map[result] || { tone: "slate" as const, label: result };
  return <Badge tone={mapped.tone}>{mapped.label}</Badge>;
}
