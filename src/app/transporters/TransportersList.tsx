"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  BarChart3,
  Building2,
  BusFront,
  CheckCircle2,
  Gauge,
  Mail,
  Phone,
  Search,
  ShieldCheck,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import { Badge, Card, EmptyState } from "@/components/ui";
import { ExportMenu } from "@/components/ExportMenu";

type TransporterRow = {
  id: string;
  companyName: string;
  region?: string | null;
  district?: string | null;
  contactPerson?: string | null;
  mobile?: string | null;
  email?: string | null;
  insuranceExpiry?: string | Date | null;
  fleetSize: number;
  activeVehicles: number;
  totalInspections: number;
  passCount: number;
  preTripInspections?: number;
  clearedTrips?: number;
};

type TrendPoint = {
  month: string;
  label: string;
  technical: number;
  technicalPassed: number;
  preTrip: number;
  clearedTrips: number;
};

interface TransportersListProps {
  rows: TransporterRow[];
  trend?: TrendPoint[];
}

type SortMode = "score" | "performance" | "clearance" | "fleet" | "activity" | "name";

function percent(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

function transporterPassRate(row: TransporterRow) {
  return percent(Number(row.passCount || 0), Number(row.totalInspections || 0));
}

function transporterClearanceRate(row: TransporterRow) {
  return percent(Number(row.clearedTrips || 0), Number(row.preTripInspections || 0));
}

function operationalScore(row: TransporterRow) {
  const fleet = Number(row.fleetSize || 0);
  const activeRate = percent(Number(row.activeVehicles || 0), fleet);
  const technicalTotal = Number(row.totalInspections || 0);
  const preTripTotal = Number(row.preTripInspections || 0);
  const components: { value: number; weight: number }[] = [];

  if (fleet > 0) components.push({ value: activeRate, weight: 35 });
  if (technicalTotal > 0) components.push({ value: transporterPassRate(row), weight: 40 });
  if (preTripTotal > 0) components.push({ value: transporterClearanceRate(row), weight: 25 });

  const totalWeight = components.reduce((sum, item) => sum + item.weight, 0);
  if (!totalWeight) return 0;
  return Math.round(components.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight);
}

function scoreLabel(score: number) {
  if (score >= 90) return "Strong";
  if (score >= 75) return "Stable";
  if (score >= 60) return "Watch";
  return "High risk";
}

function scoreTone(score: number): "emerald" | "blue" | "amber" | "red" {
  if (score >= 90) return "emerald";
  if (score >= 75) return "blue";
  if (score >= 60) return "amber";
  return "red";
}

export function TransportersList({ rows, trend = [] }: TransportersListProps) {
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("score");

  const analytics = useMemo(() => {
    const totalFleet = rows.reduce((sum, row) => sum + Number(row.fleetSize || 0), 0);
    const activeFleet = rows.reduce((sum, row) => sum + Number(row.activeVehicles || 0), 0);
    const totalInspections = rows.reduce((sum, row) => sum + Number(row.totalInspections || 0), 0);
    const passCount = rows.reduce((sum, row) => sum + Number(row.passCount || 0), 0);
    const preTripInspections = rows.reduce((sum, row) => sum + Number(row.preTripInspections || 0), 0);
    const clearedTrips = rows.reduce((sum, row) => sum + Number(row.clearedTrips || 0), 0);
    const nonPassCount = Math.max(0, totalInspections - passCount);
    const unclearedTrips = Math.max(0, preTripInspections - clearedTrips);
    const passRate = percent(passCount, totalInspections);
    const clearanceRate = percent(clearedTrips, preTripInspections);
    const activeRate = percent(activeFleet, totalFleet);
    const inactiveVehicles = Math.max(0, totalFleet - activeFleet);
    const inspectionsPerVehicle = totalFleet > 0 ? (totalInspections + preTripInspections) / totalFleet : 0;

    const scoredRows = rows.map((row) => ({ row, score: operationalScore(row) }));
    const networkScore = scoredRows.length
      ? Math.round(scoredRows.reduce((sum, item) => sum + item.score, 0) / scoredRows.length)
      : 0;
    const attentionTransporters = scoredRows.filter(({ row, score }) => {
      const meaningfulActivity = Number(row.totalInspections || 0) + Number(row.preTripInspections || 0) >= 3;
      return meaningfulActivity && score < 75;
    });
    const topPerformer = [...scoredRows]
      .filter(({ row }) => Number(row.totalInspections || 0) + Number(row.preTripInspections || 0) > 0)
      .sort((a, b) => b.score - a.score)[0] || null;
    const largestFleet = [...rows].sort((a, b) => Number(b.fleetSize || 0) - Number(a.fleetSize || 0))[0] || null;

    return {
      totalFleet,
      activeFleet,
      totalInspections,
      passCount,
      nonPassCount,
      preTripInspections,
      clearedTrips,
      unclearedTrips,
      passRate,
      clearanceRate,
      activeRate,
      inactiveVehicles,
      inspectionsPerVehicle,
      networkScore,
      attentionTransporters,
      topPerformer,
      largestFleet,
    };
  }, [rows]);

  const regions = useMemo(() => {
    const map = new Map<string, { fleet: number; active: number; transporters: number; technical: number; passed: number; preTrip: number; cleared: number }>();
    for (const row of rows) {
      const key = row.region?.trim() || "Unspecified";
      const current = map.get(key) || { fleet: 0, active: 0, transporters: 0, technical: 0, passed: 0, preTrip: 0, cleared: 0 };
      current.fleet += Number(row.fleetSize || 0);
      current.active += Number(row.activeVehicles || 0);
      current.transporters += 1;
      current.technical += Number(row.totalInspections || 0);
      current.passed += Number(row.passCount || 0);
      current.preTrip += Number(row.preTripInspections || 0);
      current.cleared += Number(row.clearedTrips || 0);
      map.set(key, current);
    }
    return Array.from(map.entries())
      .map(([name, values]) => ({ name, ...values }))
      .sort((a, b) => b.fleet - a.fleet)
      .slice(0, 6);
  }, [rows]);
  const maxRegionFleet = Math.max(1, ...regions.map((region) => region.fleet));

  const performanceRows = useMemo(
    () =>
      [...rows]
        .filter((row) => Number(row.totalInspections || 0) + Number(row.preTripInspections || 0) > 0)
        .sort((a, b) => operationalScore(b) - operationalScore(a))
        .slice(0, 6),
    [rows],
  );

  const fleetRows = useMemo(
    () => [...rows].sort((a, b) => Number(b.fleetSize || 0) - Number(a.fleetSize || 0)).slice(0, 6),
    [rows],
  );
  const maxFleet = Math.max(1, ...fleetRows.map((row) => Number(row.fleetSize || 0)));

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = query
      ? rows.filter((row) =>
          [row.companyName, row.region, row.district, row.contactPerson]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(query),
        )
      : [...rows];

    return filtered.sort((a, b) => {
      if (sortMode === "score") return operationalScore(b) - operationalScore(a);
      if (sortMode === "fleet") return Number(b.fleetSize || 0) - Number(a.fleetSize || 0);
      if (sortMode === "activity") {
        return Number(b.totalInspections || 0) + Number(b.preTripInspections || 0) - Number(a.totalInspections || 0) - Number(a.preTripInspections || 0);
      }
      if (sortMode === "clearance") return transporterClearanceRate(b) - transporterClearanceRate(a);
      if (sortMode === "name") return a.companyName.localeCompare(b.companyName);
      const rateDiff = transporterPassRate(b) - transporterPassRate(a);
      return rateDiff || Number(b.totalInspections || 0) - Number(a.totalInspections || 0);
    });
  }, [rows, search, sortMode]);

  const trendSummary = useMemo(() => {
    const activeMonths = trend.filter((point) => point.technical + point.preTrip > 0);
    const latest = activeMonths.at(-1) || null;
    const previous = activeMonths.at(-2) || null;
    if (!latest) return { latest: null, change: null as number | null, latestPassRate: 0, latestClearanceRate: 0 };
    const latestActivity = latest.technical + latest.preTrip;
    const previousActivity = previous ? previous.technical + previous.preTrip : 0;
    const change = previous && previousActivity > 0 ? Math.round(((latestActivity - previousActivity) / previousActivity) * 100) : null;
    return {
      latest,
      change,
      latestPassRate: percent(latest.technicalPassed, latest.technical),
      latestClearanceRate: percent(latest.clearedTrips, latest.preTrip),
    };
  }, [trend]);

  const maxTrendActivity = Math.max(1, ...trend.map((point) => Math.max(point.technical, point.preTrip)));

  const exportData = rows.map((row) => ({
    companyName: row.companyName,
    region: row.region || "",
    district: row.district || "",
    contactPerson: row.contactPerson || "",
    mobile: row.mobile || "",
    email: row.email || "",
    fleetSize: Number(row.fleetSize || 0),
    activeVehicles: Number(row.activeVehicles || 0),
    technicalInspections: Number(row.totalInspections || 0),
    technicalPassRate: transporterPassRate(row),
    preTripInspections: Number(row.preTripInspections || 0),
    tripClearanceRate: transporterClearanceRate(row),
    operationalScore: operationalScore(row),
  }));

  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Building2 className="h-10 w-10" />}
          title="No transporters"
          description="Add the first transporter to begin fleet and compliance analysis."
        />
      </Card>
    );
  }

  const technicalGradient = `conic-gradient(#10b981 0 ${analytics.passRate}%, #f43f5e ${analytics.passRate}% 100%)`;
  const clearanceGradient = `conic-gradient(#8b5cf6 0 ${analytics.clearanceRate}%, #f59e0b ${analytics.clearanceRate}% 100%)`;
  const fleetGradient = `conic-gradient(#2563eb 0 ${analytics.activeRate}%, #cbd5e1 ${analytics.activeRate}% 100%)`;

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          icon={<BusFront className="h-5 w-5" />}
          label="Registered Fleet"
          value={analytics.totalFleet.toLocaleString()}
          supporting={`${analytics.activeFleet.toLocaleString()} active vehicles`}
          tone="blue"
        />
        <MetricCard
          icon={<ShieldCheck className="h-5 w-5" />}
          label="Technical Pass"
          value={`${analytics.passRate}%`}
          supporting={`${analytics.passCount.toLocaleString()} of ${analytics.totalInspections.toLocaleString()} inspections`}
          tone={analytics.passRate >= 85 ? "emerald" : analytics.passRate >= 70 ? "amber" : "red"}
        />
        <MetricCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Trip Clearance"
          value={analytics.preTripInspections > 0 ? `${analytics.clearanceRate}%` : "—"}
          supporting={`${analytics.clearedTrips.toLocaleString()} of ${analytics.preTripInspections.toLocaleString()} Pre-Trip checks`}
          tone={analytics.clearanceRate >= 90 ? "emerald" : analytics.clearanceRate >= 75 ? "amber" : "red"}
        />
        <MetricCard
          icon={<Activity className="h-5 w-5" />}
          label="Total Activity"
          value={(analytics.totalInspections + analytics.preTripInspections).toLocaleString()}
          supporting={`${analytics.inspectionsPerVehicle.toFixed(1)} checks per vehicle`}
          tone="violet"
        />
        <MetricCard
          icon={<Gauge className="h-5 w-5" />}
          label="Operational Score"
          value={`${analytics.networkScore}%`}
          supporting={`${scoreLabel(analytics.networkScore)} network condition`}
          tone={scoreTone(analytics.networkScore)}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <Card className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">12-month operating trend</h2>
              <p className="mt-1 text-sm text-slate-500">Technical inspections and Pre-Trip / Safe-To-Load activity over time.</p>
            </div>
            {trendSummary.change !== null && (
              <Badge tone={trendSummary.change >= 0 ? "blue" : "amber"}>
                {trendSummary.change >= 0 ? "+" : ""}{trendSummary.change}% activity
              </Badge>
            )}
          </div>

          {trend.length === 0 ? (
            <div className="mt-6 grid min-h-52 place-items-center rounded-2xl border border-dashed border-slate-200 text-sm text-slate-500">
              Trend data will appear as inspections are recorded.
            </div>
          ) : (
            <div className="mt-6">
              <div className="flex h-56 items-end gap-2 border-b border-slate-200 pb-3 sm:gap-3">
                {trend.map((point) => {
                  const technicalHeight = Math.max(point.technical > 0 ? 8 : 0, Math.round((point.technical / maxTrendActivity) * 170));
                  const preTripHeight = Math.max(point.preTrip > 0 ? 8 : 0, Math.round((point.preTrip / maxTrendActivity) * 170));
                  return (
                    <div key={point.month} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
                      <div className="flex h-[174px] items-end gap-1">
                        <div
                          className="w-2.5 rounded-t bg-blue-600 sm:w-3.5"
                          style={{ height: technicalHeight }}
                          title={`${point.label}: ${point.technical} technical inspections`}
                        />
                        <div
                          className="w-2.5 rounded-t bg-violet-500 sm:w-3.5"
                          style={{ height: preTripHeight }}
                          title={`${point.label}: ${point.preTrip} Pre-Trip inspections`}
                        />
                      </div>
                      <span className="max-w-full truncate text-[10px] font-medium text-slate-500">{point.label}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
                <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-blue-600" /> Technical</span>
                <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-violet-500" /> Pre-Trip / Safe-To-Load</span>
                {trendSummary.latest && (
                  <span className="ml-auto text-slate-500">
                    Latest: {trendSummary.latestPassRate}% technical pass · {trendSummary.latestClearanceRate}% trip clearance
                  </span>
                )}
              </div>
            </div>
          )}
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Management insight</h2>
              <p className="mt-1 text-sm text-slate-500">Current operational implications from fleet and inspection data.</p>
            </div>
            <TrendingUp className="h-5 w-5 text-slate-400" />
          </div>
          <div className="mt-5 space-y-3">
            <InsightRow
              icon={<Gauge className="h-4 w-4" />}
              title="Network condition"
              text={`The composite operational score is ${analytics.networkScore}%. It combines fleet availability, technical inspection readiness and trip-clearance performance using only metrics with recorded data.`}
              tone={scoreTone(analytics.networkScore)}
            />
            <InsightRow
              icon={<CheckCircle2 className="h-4 w-4" />}
              title="Trip readiness"
              text={
                analytics.preTripInspections === 0
                  ? "No Pre-Trip / Safe-To-Load activity is available yet, so trip-readiness performance is not influencing the score."
                  : analytics.clearanceRate >= 90
                    ? `${analytics.clearanceRate}% of Pre-Trip checks are cleared, indicating strong day-to-day trip readiness.`
                    : `${analytics.clearanceRate}% of Pre-Trip checks are cleared. Review uncleared trips and repeated defects to reduce operational delays.`
              }
              tone={analytics.preTripInspections === 0 ? "blue" : analytics.clearanceRate >= 90 ? "emerald" : "amber"}
            />
            <InsightRow
              icon={<TriangleAlert className="h-4 w-4" />}
              title="Attention queue"
              text={
                analytics.attentionTransporters.length > 0
                  ? `${analytics.attentionTransporters.length} transporter${analytics.attentionTransporters.length === 1 ? "" : "s"} with meaningful activity score below 75% and should receive targeted review.`
                  : "No transporter with meaningful activity currently falls below the 75% operational-score attention threshold."
              }
              tone={analytics.attentionTransporters.length > 0 ? "red" : "emerald"}
            />
          </div>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
        <Card className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Operational health</h2>
              <p className="mt-1 text-sm text-slate-500">Three core indicators of transportation efficiency and readiness.</p>
            </div>
            <BarChart3 className="h-5 w-5 text-slate-400" />
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <DonutMetric
              gradient={technicalGradient}
              value={`${analytics.passRate}%`}
              label="Technical pass"
              legend={[
                { label: "Pass", value: analytics.passCount, dot: "bg-emerald-500" },
                { label: "Non-pass", value: analytics.nonPassCount, dot: "bg-rose-500" },
              ]}
            />
            <DonutMetric
              gradient={clearanceGradient}
              value={analytics.preTripInspections > 0 ? `${analytics.clearanceRate}%` : "—"}
              label="Trip clearance"
              legend={[
                { label: "Cleared", value: analytics.clearedTrips, dot: "bg-violet-500" },
                { label: "Not cleared", value: analytics.unclearedTrips, dot: "bg-amber-500" },
              ]}
            />
            <DonutMetric
              gradient={fleetGradient}
              value={`${analytics.activeRate}%`}
              label="Fleet active"
              legend={[
                { label: "Active", value: analytics.activeFleet, dot: "bg-blue-600" },
                { label: "Inactive", value: analytics.inactiveVehicles, dot: "bg-slate-300" },
              ]}
            />
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Regional concentration</h2>
              <p className="mt-1 text-sm text-slate-500">Where fleet capacity is concentrated across transporter regions.</p>
            </div>
            <Badge tone="slate">Top {regions.length}</Badge>
          </div>
          <div className="mt-5 space-y-4">
            {regions.map((region) => {
              const width = Math.max(3, Math.round((region.fleet / maxRegionFleet) * 100));
              return (
                <div key={region.name}>
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{region.name}</p>
                      <p className="text-[11px] text-slate-500">{region.transporters} transporter{region.transporters === 1 ? "" : "s"} · {region.active}/{region.fleet} active</p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-slate-700">{region.fleet} vehicles</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-cyan-600" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Transporter performance</h2>
              <p className="mt-1 text-sm text-slate-500">Composite ranking across available fleet, technical and trip-clearance indicators.</p>
            </div>
            {analytics.topPerformer && <Badge tone="emerald">Top {analytics.topPerformer.score}%</Badge>}
          </div>
          <div className="mt-5 space-y-4">
            {performanceRows.length === 0 ? (
              <p className="text-sm text-slate-500">No inspection activity is available yet.</p>
            ) : (
              performanceRows.map((row, index) => {
                const score = operationalScore(row);
                return (
                  <div key={row.id}>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                      <Link href={`/transporters/${row.id}`} className="min-w-0 truncate font-medium text-slate-800 hover:text-slate-950 hover:underline">
                        {index + 1}. {row.companyName}
                      </Link>
                      <span className="shrink-0 font-semibold text-slate-900">{score}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${score >= 90 ? "bg-emerald-500" : score >= 75 ? "bg-blue-600" : score >= 60 ? "bg-amber-500" : "bg-rose-500"}`}
                        style={{ width: `${score}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Technical {row.totalInspections > 0 ? `${transporterPassRate(row)}%` : "—"} · Trip clearance {Number(row.preTripInspections || 0) > 0 ? `${transporterClearanceRate(row)}%` : "—"}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Fleet concentration</h2>
              <p className="mt-1 text-sm text-slate-500">Largest fleets and their contribution to available network capacity.</p>
            </div>
            {analytics.largestFleet && <Badge tone="blue">Largest {Number(analytics.largestFleet.fleetSize || 0)}</Badge>}
          </div>
          <div className="mt-5 space-y-4">
            {fleetRows.map((row) => {
              const fleet = Number(row.fleetSize || 0);
              const active = Number(row.activeVehicles || 0);
              const width = Math.max(3, Math.round((fleet / maxFleet) * 100));
              return (
                <div key={row.id}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                    <Link href={`/transporters/${row.id}`} className="min-w-0 truncate font-medium text-slate-800 hover:text-slate-950 hover:underline">
                      {row.companyName}
                    </Link>
                    <span className="shrink-0 text-xs font-semibold text-slate-700">{fleet} vehicles · {active} active</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-blue-600" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Transporter directory</h2>
              <p className="mt-1 text-sm text-slate-500">Search, compare operational readiness and open a transporter for detailed records.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative min-w-0 sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search transporter or region"
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none focus:border-slate-500 focus:ring-4 focus:ring-slate-100"
                />
              </label>
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
                className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-500 focus:ring-4 focus:ring-slate-100"
              >
                <option value="score">Sort: Operational score</option>
                <option value="performance">Sort: Technical pass</option>
                <option value="clearance">Sort: Trip clearance</option>
                <option value="fleet">Sort: Fleet size</option>
                <option value="activity">Sort: Total activity</option>
                <option value="name">Sort: Name</option>
              </select>
              <ExportMenu data={exportData} filename="transporters" title="Transporter Performance" label="Export" />
            </div>
          </div>
        </div>

        {filteredRows.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No transporters match your search.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredRows.map((row) => {
              const score = operationalScore(row);
              const technicalRate = transporterPassRate(row);
              const clearanceRate = transporterClearanceRate(row);
              const fleet = Number(row.fleetSize || 0);
              const active = Number(row.activeVehicles || 0);
              const activeRate = percent(active, fleet);
              return (
                <Link
                  key={row.id}
                  href={`/transporters/${row.id}`}
                  className="grid gap-4 px-4 py-4 transition hover:bg-slate-50 sm:px-5 xl:grid-cols-[minmax(230px,1.45fr)_110px_145px_145px_145px] xl:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700 ring-1 ring-violet-100">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-semibold text-slate-950">{row.companyName}</p>
                          <Badge tone={scoreTone(score)}>{score}%</Badge>
                        </div>
                        <p className="truncate text-xs text-slate-500">{row.region || "Region not set"}{row.district ? ` · ${row.district}` : ""}</p>
                      </div>
                    </div>
                    {(row.mobile || row.email) && (
                      <div className="mt-2 ml-13 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                        {row.mobile && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{row.mobile}</span>}
                        {row.email && <span className="inline-flex min-w-0 items-center gap-1"><Mail className="h-3 w-3" /><span className="truncate">{row.email}</span></span>}
                      </div>
                    )}
                  </div>

                  <MiniMetric label="Fleet" value={`${fleet}`} helper={`${active} active`} progress={activeRate} barClass="bg-blue-600" />
                  <MiniMetric
                    label="Technical"
                    value={row.totalInspections > 0 ? `${technicalRate}%` : "—"}
                    helper={`${Number(row.totalInspections || 0)} inspections`}
                    progress={row.totalInspections > 0 ? technicalRate : 0}
                    barClass={technicalRate >= 90 ? "bg-emerald-500" : technicalRate >= 75 ? "bg-amber-500" : "bg-rose-500"}
                  />
                  <MiniMetric
                    label="Trip clearance"
                    value={Number(row.preTripInspections || 0) > 0 ? `${clearanceRate}%` : "—"}
                    helper={`${Number(row.preTripInspections || 0)} Pre-Trip`}
                    progress={Number(row.preTripInspections || 0) > 0 ? clearanceRate : 0}
                    barClass={clearanceRate >= 90 ? "bg-violet-500" : clearanceRate >= 75 ? "bg-amber-500" : "bg-rose-500"}
                  />
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Condition</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{scoreLabel(score)}</p>
                    <p className="mt-1 text-[11px] text-slate-500">Composite score</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  supporting,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  supporting: string;
  tone: "blue" | "emerald" | "amber" | "red" | "violet";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    red: "bg-rose-50 text-rose-700 ring-rose-100",
    violet: "bg-violet-50 text-violet-700 ring-violet-100",
  };
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{supporting}</p>
        </div>
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ${tones[tone]}`}>{icon}</div>
      </div>
    </Card>
  );
}

function DonutMetric({
  gradient,
  value,
  label,
  legend,
}: {
  gradient: string;
  value: string;
  label: string;
  legend: { label: string; value: number; dot: string }[];
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
      <div className="mx-auto relative h-24 w-24 rounded-full" style={{ background: gradient }}>
        <div className="absolute inset-[11px] grid place-items-center rounded-full bg-white text-center shadow-sm">
          <div>
            <p className="text-lg font-bold text-slate-950">{value}</p>
            <p className="text-[9px] font-medium text-slate-500">{label}</p>
          </div>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {legend.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-xs">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.dot}`} />
            <span className="text-slate-600">{item.label}</span>
            <span className="ml-auto font-semibold text-slate-900">{item.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InsightRow({
  icon,
  title,
  text,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  tone: "blue" | "emerald" | "amber" | "red";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-rose-50 text-rose-700",
  };
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-100 p-3.5">
      <div className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tones[tone]}`}>{icon}</div>
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-600">{text}</p>
      </div>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  helper,
  progress,
  barClass,
}: {
  label: string;
  value: string;
  helper: string;
  progress: number;
  barClass: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <span className="text-xs font-semibold text-slate-700">{value}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-slate-500">{helper}</p>
    </div>
  );
}
