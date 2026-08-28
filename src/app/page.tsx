import { PageHeader, StatCard, Card, Badge } from "@/components/ui";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  Calendar,
  CalendarCheck,
  Car,
  CheckCircle2,
  ClipboardCheck,
  Plus,
  TrendingUp,
  Truck,
  XCircle,
} from "lucide-react";
import { requireInternalUser } from "@/lib/require-auth";
import { db } from "@/db";
import { dailyInspections, vehicles } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import {
  computeDashboardStats,
  getMonthlyTrend,
  getStationStats,
  getTransporterPerformance,
  getCommonDefects,
  getCategoryDistribution,
  getRegionalStats,
  getInspectorPerformance,
  getYearlyComparison,
} from "@/lib/analytics";
import {
  TrendChart,
  StationChart,
  TransporterChart,
  DefectsChart,
  CategoryPie,
  RegionHeatMap,
  InspectorChart,
} from "@/components/Charts";
import { YearlyComparisonChart } from "@/components/YearlyComparisonChart";
import Link from "next/link";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireInternalUser();
  const today = new Date().toISOString().slice(0, 10);
  const [
    stats,
    trend,
    stations,
    transporters,
    defects,
    categories,
    regions,
    inspectors,
    yearlyData,
    todaysDaily,
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
    <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8 xl:p-10">
      <PageHeader
        eyebrow="Operations command centre"
        title="Executive Dashboard"
        description="A focused view of fleet activity, inspection outcomes, compliance risk, and operational workload."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/inspections/new"
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--brand-color)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-95"
            >
              <Plus className="h-4 w-4" /> New Inspection
            </Link>
            <Link
              href="/reports"
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
            >
              <TrendingUp className="h-4 w-4" /> Reports <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        }
      />

      <section aria-labelledby="overview-metrics">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 id="overview-metrics" className="text-sm font-semibold text-slate-900">Core operating metrics</h2>
            <p className="mt-0.5 text-xs text-slate-500">Current fleet and inspection performance</p>
          </div>
          <Badge tone="slate">{stats.totalInspections} inspections recorded</Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Total Vehicles" value={stats.totalVehicles} tone="blue" icon={<Car className="h-5 w-5" />} />
          <StatCard label="Active Fleet" value={stats.activeVehicles} hint={`${stats.suspendedVehicles} suspended`} tone="emerald" icon={<Activity className="h-5 w-5" />} />
          <StatCard label="Inspections Today" value={stats.todayInspections} hint={`${stats.monthlyInspections} this month`} tone="slate" icon={<Calendar className="h-5 w-5" />} />
          <StatCard label="Pass Rate" value={`${stats.passRate}%`} hint={`${stats.passCount} passed`} tone="emerald" icon={<CheckCircle2 className="h-5 w-5" />} />
          <StatCard label="Fail Rate" value={`${stats.failRate}%`} hint={`${stats.failCount} failed`} tone="red" icon={<XCircle className="h-5 w-5" />} />
          <StatCard label="Transporters" value={stats.totalTransporters} tone="violet" icon={<Truck className="h-5 w-5" />} />
        </div>
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
            <SectionTitle
              title="Inspection outcome trend"
              description="Pass and fail performance over the last 12 months"
              action={<Link href="/reports" className="text-xs font-semibold text-slate-600 hover:text-slate-950">Open analytics →</Link>}
            />
          </div>
          <div className="p-4 sm:p-6">
            <TrendChart data={trend as any} />
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
            <SectionTitle title="Operational attention" description="Items requiring follow-up" />
          </div>
          <div className="divide-y divide-slate-100 px-5 sm:px-6">
            <AttentionRow icon={<AlertTriangle className="h-4 w-4" />} label="Re-inspections pending" value={stats.pendingReinspections} tone="amber" />
            <AttentionRow icon={<Calendar className="h-4 w-4" />} label="Inspections due within 60 days" value={stats.dueInspections} tone="blue" />
            <AttentionRow icon={<Bell className="h-4 w-4" />} label="Certificates expiring within 30 days" value={stats.expiringCertificates} tone="amber" />
            <AttentionRow icon={<AlertTriangle className="h-4 w-4" />} label="Conditional outcomes" value={stats.conditionalCount} tone="amber" />
            <AttentionRow icon={<CalendarCheck className="h-4 w-4" />} label="Pre-trip inspections today" value={todaysDaily.length} tone="emerald" />
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-slate-200 bg-slate-50/70 p-4">
            <QuickAction href="/daily-inspections/new" label="Start pre-trip" icon={<CalendarCheck className="h-4 w-4" />} />
            <QuickAction href="/vehicles" label="Vehicle register" icon={<Car className="h-4 w-4" />} />
          </div>
        </Card>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card className="p-4 sm:p-6">
          <SectionTitle title="Station performance" description="Inspection performance by station" />
          <div className="mt-4"><StationChart data={stations as any} /></div>
        </Card>
        <Card className="p-4 sm:p-6">
          <SectionTitle title="Transporter performance" description="Highest-volume transporters and outcomes" />
          <div className="mt-4"><TransporterChart data={transporters as any} /></div>
        </Card>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card className="p-4 sm:p-6">
          <SectionTitle title="Common defects" description="Most frequently failed inspection items" />
          <div className="mt-4"><DefectsChart data={defects as any} /></div>
        </Card>
        <Card className="p-4 sm:p-6">
          <SectionTitle title="Vehicle categories" description="Fleet distribution by category" />
          <div className="mt-4"><CategoryPie data={categories as any} /></div>
        </Card>
        <Card className="p-4 sm:p-6">
          <SectionTitle title="Inspector productivity" description="Leading inspectors by completed volume" />
          <div className="mt-4"><InspectorChart data={inspectors as any} /></div>
        </Card>
      </section>

      <Card className="mt-5 p-4 sm:p-6">
        <YearlyComparisonChart data={yearlyData} showStats={true} />
      </Card>

      <Card className="mt-5 p-4 sm:p-6">
        <SectionTitle
          title="Regional compliance"
          description="Pass-rate intensity across recorded regions"
          action={<Badge tone="emerald">{regions.length} regions</Badge>}
        />
        <div className="mt-4"><RegionHeatMap data={regions as any} /></div>
      </Card>

      <Card className="mt-5 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <SectionTitle
            title="Today’s pre-trip inspections"
            description="Daily checks recorded before vehicles leave the yard"
          />
          <div className="flex items-center gap-2">
            <Badge tone="blue">{todaysDaily.length} today</Badge>
            <Link href="/daily-inspections" className="text-xs font-semibold text-slate-600 hover:text-slate-950">View all →</Link>
          </div>
        </div>

        {todaysDaily.length === 0 ? (
          <div className="px-5 py-10 text-center sm:px-6">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-500">
              <CalendarCheck className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-900">No pre-trip inspections recorded today</p>
            <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">Start a daily inspection before the next vehicle is released for a trip.</p>
            <Link
              href="/daily-inspections/new"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" /> Start pre-trip inspection
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {todaysDaily.map((d) => (
              <Link
                key={d.id}
                href={`/daily-inspections/${d.id}`}
                className="flex flex-col gap-3 px-5 py-4 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between sm:px-6"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">{d.regNumber}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">Driver: {d.driverName} · {d.passedItems}/{d.totalItems} passed</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {d.status === "passed" && <Badge tone="emerald"><CheckCircle2 className="h-3.5 w-3.5" /> Pass</Badge>}
                  {d.status === "failed" && <Badge tone="red"><XCircle className="h-3.5 w-3.5" /> Fail</Badge>}
                  {d.status === "defect_noted" && <Badge tone="amber"><AlertTriangle className="h-3.5 w-3.5" /> Defect</Badge>}
                  <span className={`text-xs font-semibold ${d.clearedForTrip ? "text-emerald-700" : "text-red-700"}`}>
                    {d.clearedForTrip ? "Cleared for trip" : "Grounded"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function SectionTitle({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold tracking-tight text-slate-950 sm:text-base">{title}</h2>
        {description && <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function AttentionRow({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone: "amber" | "blue" | "emerald";
}) {
  const tones = {
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
  };

  return (
    <div className="flex items-center gap-3 py-3.5">
      <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tones[tone]}`}>{icon}</div>
      <p className="min-w-0 flex-1 text-sm text-slate-600">{label}</p>
      <span className="text-base font-semibold tabular-nums text-slate-950">{value}</span>
    </div>
  );
}

function QuickAction({ href, label, icon }: { href: string; label: string; icon: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
    >
      {icon}
      {label}
    </Link>
  );
}
