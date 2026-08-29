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
};

interface TransportersListProps {
  rows: TransporterRow[];
}

type SortMode = "performance" | "fleet" | "activity" | "name";

function percent(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

function transporterPassRate(row: TransporterRow) {
  return percent(Number(row.passCount || 0), Number(row.totalInspections || 0));
}

export function TransportersList({ rows }: TransportersListProps) {
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("performance");

  const analytics = useMemo(() => {
    const totalFleet = rows.reduce((sum, row) => sum + Number(row.fleetSize || 0), 0);
    const activeFleet = rows.reduce((sum, row) => sum + Number(row.activeVehicles || 0), 0);
    const totalInspections = rows.reduce((sum, row) => sum + Number(row.totalInspections || 0), 0);
    const passCount = rows.reduce((sum, row) => sum + Number(row.passCount || 0), 0);
    const nonPassCount = Math.max(0, totalInspections - passCount);
    const passRate = percent(passCount, totalInspections);
    const activeRate = percent(activeFleet, totalFleet);
    const inspectionsPerVehicle = totalFleet > 0 ? totalInspections / totalFleet : 0;
    const inactiveVehicles = Math.max(0, totalFleet - activeFleet);

    const withInspection = rows.filter((row) => Number(row.totalInspections || 0) > 0);
    const ranked = [...withInspection].sort((a, b) => {
      const rateDiff = transporterPassRate(b) - transporterPassRate(a);
      if (rateDiff !== 0) return rateDiff;
      return Number(b.totalInspections || 0) - Number(a.totalInspections || 0);
    });
    const topPerformer = ranked[0] || null;
    const largestFleet = [...rows].sort((a, b) => Number(b.fleetSize || 0) - Number(a.fleetSize || 0))[0] || null;
    const attentionTransporters = rows.filter(
      (row) => Number(row.totalInspections || 0) >= 3 && transporterPassRate(row) < 80,
    );

    return {
      totalFleet,
      activeFleet,
      totalInspections,
      passCount,
      nonPassCount,
      passRate,
      activeRate,
      inspectionsPerVehicle,
      inactiveVehicles,
      topPerformer,
      largestFleet,
      attentionTransporters,
    };
  }, [rows]);

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
      if (sortMode === "fleet") return Number(b.fleetSize || 0) - Number(a.fleetSize || 0);
      if (sortMode === "activity") return Number(b.totalInspections || 0) - Number(a.totalInspections || 0);
      if (sortMode === "name") return a.companyName.localeCompare(b.companyName);
      const rateDiff = transporterPassRate(b) - transporterPassRate(a);
      return rateDiff || Number(b.totalInspections || 0) - Number(a.totalInspections || 0);
    });
  }, [rows, search, sortMode]);

  const performanceRows = useMemo(
    () =>
      [...rows]
        .filter((row) => Number(row.totalInspections || 0) > 0)
        .sort((a, b) => transporterPassRate(b) - transporterPassRate(a))
        .slice(0, 6),
    [rows],
  );

  const fleetRows = useMemo(
    () => [...rows].sort((a, b) => Number(b.fleetSize || 0) - Number(a.fleetSize || 0)).slice(0, 6),
    [rows],
  );
  const maxFleet = Math.max(1, ...fleetRows.map((row) => Number(row.fleetSize || 0)));

  const exportData = rows.map((row) => ({
    companyName: row.companyName,
    region: row.region || "",
    district: row.district || "",
    contactPerson: row.contactPerson || "",
    mobile: row.mobile || "",
    email: row.email || "",
    fleetSize: Number(row.fleetSize || 0),
    activeVehicles: Number(row.activeVehicles || 0),
    totalInspections: Number(row.totalInspections || 0),
    compliance: transporterPassRate(row),
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

  const outcomeGradient = `conic-gradient(#10b981 0 ${analytics.passRate}%, #f43f5e ${analytics.passRate}% 100%)`;
  const fleetGradient = `conic-gradient(#2563eb 0 ${analytics.activeRate}%, #cbd5e1 ${analytics.activeRate}% 100%)`;

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<BusFront className="h-5 w-5" />}
          label="Registered Fleet"
          value={analytics.totalFleet.toLocaleString()}
          supporting={`${analytics.activeFleet.toLocaleString()} active vehicles`}
          tone="blue"
        />
        <MetricCard
          icon={<Gauge className="h-5 w-5" />}
          label="Fleet Active Rate"
          value={`${analytics.activeRate}%`}
          supporting={`${analytics.inactiveVehicles.toLocaleString()} inactive / unavailable`}
          tone={analytics.activeRate >= 90 ? "emerald" : "amber"}
        />
        <MetricCard
          icon={<ShieldCheck className="h-5 w-5" />}
          label="Inspection Pass Rate"
          value={`${analytics.passRate}%`}
          supporting={`${analytics.passCount.toLocaleString()} of ${analytics.totalInspections.toLocaleString()} outcomes`}
          tone={analytics.passRate >= 85 ? "emerald" : analytics.passRate >= 70 ? "amber" : "red"}
        />
        <MetricCard
          icon={<Activity className="h-5 w-5" />}
          label="Inspection Activity"
          value={analytics.totalInspections.toLocaleString()}
          supporting={`${analytics.inspectionsPerVehicle.toFixed(1)} inspections per vehicle`}
          tone="violet"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
        <Card className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Operational health</h2>
              <p className="mt-1 text-sm text-slate-500">Fleet availability and recorded inspection outcomes across all transporters.</p>
            </div>
            <BarChart3 className="h-5 w-5 text-slate-400" />
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <DonutMetric
              gradient={outcomeGradient}
              value={`${analytics.passRate}%`}
              label="Pass rate"
              legend={[
                { label: "Pass", value: analytics.passCount, dot: "bg-emerald-500" },
                { label: "Non-pass", value: analytics.nonPassCount, dot: "bg-rose-500" },
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
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Management insight</h2>
              <p className="mt-1 text-sm text-slate-500">What the current transporter data implies operationally.</p>
            </div>
            <TrendingUp className="h-5 w-5 text-slate-400" />
          </div>

          <div className="mt-5 space-y-3">
            <InsightRow
              icon={<CheckCircle2 className="h-4 w-4" />}
              title="Inspection effectiveness"
              text={
                analytics.passRate >= 90
                  ? `A ${analytics.passRate}% pass rate indicates strong inspection readiness. Maintain preventive controls and use low-performing outliers for targeted coaching.`
                  : analytics.passRate >= 75
                    ? `The ${analytics.passRate}% pass rate is workable but leaves material rework. Focus maintenance attention on transporters below the network average.`
                    : `The ${analytics.passRate}% pass rate signals elevated rework risk. Prioritize defect prevention, maintenance follow-up and closer transporter review.`
              }
              tone={analytics.passRate >= 85 ? "emerald" : "amber"}
            />
            <InsightRow
              icon={<Gauge className="h-4 w-4" />}
              title="Fleet availability"
              text={
                analytics.activeRate >= 90
                  ? `${analytics.activeRate}% of registered vehicles are active, supporting strong capacity availability.`
                  : `${analytics.activeRate}% of the fleet is active. Review the ${analytics.inactiveVehicles} inactive or unavailable vehicles for avoidable capacity loss.`
              }
              tone={analytics.activeRate >= 90 ? "blue" : "amber"}
            />
            <InsightRow
              icon={<TriangleAlert className="h-4 w-4" />}
              title="Attention queue"
              text={
                analytics.attentionTransporters.length > 0
                  ? `${analytics.attentionTransporters.length} transporter${analytics.attentionTransporters.length === 1 ? "" : "s"} with at least 3 inspections are below an 80% pass rate and merit focused follow-up.`
                  : "No transporter with meaningful inspection volume is currently below the 80% attention threshold."
              }
              tone={analytics.attentionTransporters.length > 0 ? "red" : "emerald"}
            />
          </div>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Transporter performance</h2>
              <p className="mt-1 text-sm text-slate-500">Highest pass rates among transporters with recorded inspections.</p>
            </div>
            {analytics.topPerformer && <Badge tone="emerald">Top {transporterPassRate(analytics.topPerformer)}%</Badge>}
          </div>
          <div className="mt-5 space-y-4">
            {performanceRows.length === 0 ? (
              <p className="text-sm text-slate-500">No inspection outcomes are available yet.</p>
            ) : (
              performanceRows.map((row, index) => {
                const rate = transporterPassRate(row);
                return (
                  <div key={row.id}>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                      <Link href={`/transporters/${row.id}`} className="min-w-0 truncate font-medium text-slate-800 hover:text-slate-950 hover:underline">
                        {index + 1}. {row.companyName}
                      </Link>
                      <span className="shrink-0 font-semibold text-slate-900">{rate}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${rate >= 90 ? "bg-emerald-500" : rate >= 75 ? "bg-amber-500" : "bg-rose-500"}`}
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">{Number(row.totalInspections || 0)} inspections</p>
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
              <p className="mt-1 text-sm text-slate-500">Largest fleets and their contribution to network capacity.</p>
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
              <p className="mt-1 text-sm text-slate-500">Compare fleet activity and inspection performance, then open a transporter for details.</p>
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
                <option value="performance">Sort: Performance</option>
                <option value="fleet">Sort: Fleet size</option>
                <option value="activity">Sort: Inspection activity</option>
                <option value="name">Sort: Name</option>
              </select>
              <ExportMenu data={exportData} filename="transporters" title="Transporter Companies" label="Export" />
            </div>
          </div>
        </div>

        {filteredRows.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No transporters match your search.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredRows.map((row) => {
              const rate = transporterPassRate(row);
              const fleet = Number(row.fleetSize || 0);
              const active = Number(row.activeVehicles || 0);
              const activeRate = percent(active, fleet);
              return (
                <Link
                  key={row.id}
                  href={`/transporters/${row.id}`}
                  className="grid gap-4 px-4 py-4 transition hover:bg-slate-50 sm:px-5 lg:grid-cols-[minmax(220px,1.4fr)_120px_150px_170px] lg:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700 ring-1 ring-violet-100">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-950">{row.companyName}</p>
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

                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Fleet</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{fleet} <span className="font-normal text-slate-500">vehicles</span></p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Active fleet</p>
                      <span className="text-xs font-semibold text-slate-700">{activeRate}%</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-blue-600" style={{ width: `${activeRate}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">{active} active</p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Pass rate</p>
                      <span className="text-xs font-semibold text-slate-700">{row.totalInspections > 0 ? `${rate}%` : "—"}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${rate >= 90 ? "bg-emerald-500" : rate >= 75 ? "bg-amber-500" : "bg-rose-500"}`}
                        style={{ width: `${row.totalInspections > 0 ? rate : 0}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">{Number(row.totalInspections || 0)} inspections</p>
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
    <div className="flex items-center gap-5 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
      <div className="relative h-28 w-28 shrink-0 rounded-full" style={{ background: gradient }}>
        <div className="absolute inset-[12px] grid place-items-center rounded-full bg-white text-center shadow-sm">
          <div>
            <p className="text-xl font-bold text-slate-950">{value}</p>
            <p className="text-[10px] font-medium text-slate-500">{label}</p>
          </div>
        </div>
      </div>
      <div className="min-w-0 space-y-3">
        {legend.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-sm">
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
