"use client";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  BusFront,
  CheckCircle2,
  Gauge,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge, Card } from "@/components/ui";

type TrendPoint = {
  month: string;
  label: string;
  technical: number;
  technicalPassed: number;
  preTrip: number;
  clearedTrips: number;
};

type VehiclePoint = {
  id: string;
  registrationNumber: string;
  status: string;
  technical: number;
  technicalPassRate: number;
  preTrip: number;
  clearanceRate: number;
  readinessScore: number;
  hasActivity: boolean;
};

type Props = {
  metrics: {
    fleetSize: number;
    availableVehicles: number;
    unavailableVehicles: number;
    technicalInspections: number;
    technicalPassed: number;
    preTripInspections: number;
    clearedPreTrips: number;
    expiringDocuments: number;
    expiredDocuments: number;
    operationalScore: number;
  };
  trend: TrendPoint[];
  vehicles: VehiclePoint[];
};

function percent(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
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

export function TransporterPortalAnalytics({ metrics, trend, vehicles }: Props) {
  const fleetRate = percent(metrics.availableVehicles, metrics.fleetSize);
  const technicalRate = percent(metrics.technicalPassed, metrics.technicalInspections);
  const clearanceRate = percent(metrics.clearedPreTrips, metrics.preTripInspections);

  const monthly = trend.map((point) => ({
    ...point,
    activity: point.technical + point.preTrip,
    technicalPassRate: percent(point.technicalPassed, point.technical),
    clearanceRate: percent(point.clearedTrips, point.preTrip),
  }));
  const activeMonths = monthly.filter((point) => point.activity > 0);
  const latest = activeMonths.at(-1) || null;
  const previous = activeMonths.at(-2) || null;
  const activityChange = latest && previous && previous.activity > 0
    ? Math.round(((latest.activity - previous.activity) / previous.activity) * 100)
    : null;

  const chartVehicles = vehicles
    .filter((vehicle) => vehicle.hasActivity)
    .sort((a, b) => b.readinessScore - a.readinessScore)
    .slice(0, 10);
  const watchVehicles = vehicles.filter((vehicle) => vehicle.hasActivity && vehicle.readinessScore < 75);
  const noActivityVehicles = vehicles.filter((vehicle) => !vehicle.hasActivity);
  const groundedVehicles = vehicles.filter((vehicle) => ["failed", "suspended", "decommissioned"].includes(vehicle.status));

  const fleetPie = [
    { name: "Available", value: metrics.availableVehicles, color: "#10b981" },
    { name: "Unavailable", value: metrics.unavailableVehicles, color: "#f43f5e" },
  ].filter((item) => item.value > 0);

  const constraints = [
    { label: "Fleet availability", value: fleetRate, available: metrics.fleetSize > 0 },
    { label: "Technical readiness", value: technicalRate, available: metrics.technicalInspections > 0 },
    { label: "Trip clearance", value: clearanceRate, available: metrics.preTripInspections > 0 },
  ].filter((item) => item.available).sort((a, b) => a.value - b.value);
  const constraint = constraints[0] || null;

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          icon={<Gauge className="h-5 w-5" />}
          label="Operational Score"
          value={`${metrics.operationalScore}%`}
          helper={`${scoreLabel(metrics.operationalScore)} overall condition`}
          tone={scoreTone(metrics.operationalScore)}
        />
        <KpiCard
          icon={<BusFront className="h-5 w-5" />}
          label="Fleet Availability"
          value={`${fleetRate}%`}
          helper={`${metrics.availableVehicles} of ${metrics.fleetSize} vehicles available`}
          tone={fleetRate >= 90 ? "emerald" : fleetRate >= 75 ? "amber" : "red"}
        />
        <KpiCard
          icon={<ShieldCheck className="h-5 w-5" />}
          label="Technical Pass"
          value={metrics.technicalInspections > 0 ? `${technicalRate}%` : "—"}
          helper={`${metrics.technicalPassed} of ${metrics.technicalInspections} inspections passed`}
          tone={technicalRate >= 85 ? "emerald" : technicalRate >= 70 ? "amber" : "red"}
        />
        <KpiCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Trip Clearance"
          value={metrics.preTripInspections > 0 ? `${clearanceRate}%` : "—"}
          helper={`${metrics.clearedPreTrips} of ${metrics.preTripInspections} Pre-Trip checks cleared`}
          tone={clearanceRate >= 90 ? "emerald" : clearanceRate >= 75 ? "amber" : "red"}
        />
        <KpiCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Document Exposure"
          value={`${metrics.expiredDocuments + metrics.expiringDocuments}`}
          helper={`${metrics.expiredDocuments} expired · ${metrics.expiringDocuments} due ≤60 days`}
          tone={metrics.expiredDocuments > 0 ? "red" : metrics.expiringDocuments > 0 ? "amber" : "emerald"}
        />
      </section>

      <section className="grid gap-5 2xl:grid-cols-[1.4fr_.6fr]">
        <Card className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">12-month operating trend</h2>
              <p className="mt-1 text-sm text-slate-500">Inspection workload and readiness quality for this transporter only.</p>
            </div>
            {activityChange !== null && (
              <Badge tone={activityChange >= 0 ? "blue" : "amber"}>
                {activityChange >= 0 ? "+" : ""}{activityChange}% activity
              </Badge>
            )}
          </div>

          <div className="mt-5 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthly} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="count" tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} axisLine={false} tickLine={false} />
                <YAxis yAxisId="rate" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fill: "#94a3b8" }} unit="%" axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0", fontSize: 12 }} />
                <Bar yAxisId="count" dataKey="technical" name="Technical inspections" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={20} />
                <Bar yAxisId="count" dataKey="preTrip" name="Pre-Trip checks" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={20} />
                <Line yAxisId="rate" type="monotone" dataKey="technicalPassRate" name="Technical pass %" stroke="#059669" strokeWidth={2.5} dot={{ r: 2.5 }} connectNulls />
                <Line yAxisId="rate" type="monotone" dataKey="clearanceRate" name="Trip clearance %" stroke="#d97706" strokeWidth={2.5} dot={{ r: 2.5 }} connectNulls />
                <ReferenceLine yAxisId="rate" y={85} stroke="#94a3b8" strokeDasharray="4 4" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500">
            <span>Dashed line = 85% management benchmark.</span>
            {latest && (
              <span className="ml-auto font-medium text-slate-700">
                Latest: {latest.activity} checks · {latest.technicalPassRate}% technical · {latest.clearanceRate}% clearance
              </span>
            )}
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Operational interpretation</h2>
              <p className="mt-1 text-sm text-slate-500">What the current records imply for fleet efficiency.</p>
            </div>
            <Activity className="h-5 w-5 text-slate-400" />
          </div>
          <div className="mt-5 space-y-3">
            <Insight
              tone={metrics.operationalScore >= 85 ? "emerald" : metrics.operationalScore >= 70 ? "amber" : "red"}
              title="Overall condition"
              text={`The transporter operational score is ${metrics.operationalScore}%. ${metrics.operationalScore >= 85 ? "Current fleet availability and inspection outcomes indicate a strong operating position." : metrics.operationalScore >= 70 ? "Operations are generally stable, but targeted corrective work can reduce avoidable downtime." : "Recorded readiness indicators show material operational risk and require focused corrective action."}`}
            />
            <Insight
              tone={constraint && constraint.value < 75 ? "red" : "blue"}
              title="Primary efficiency constraint"
              text={constraint ? `${constraint.label} is the weakest recorded dimension at ${constraint.value}%. This is the most direct area to improve if the goal is better vehicle utilization and fewer trip disruptions.` : "More inspection activity is required before VIMS can identify a reliable operational constraint."}
            />
            <Insight
              tone={watchVehicles.length > 0 || groundedVehicles.length > 0 ? "red" : "emerald"}
              title="Vehicle attention queue"
              text={watchVehicles.length > 0 || groundedVehicles.length > 0 ? `${watchVehicles.length} vehicle(s) with inspection history score below 75% and ${groundedVehicles.length} currently failed/suspended/decommissioned vehicle(s) should receive priority review.` : "No vehicle with recorded inspection activity currently falls below the 75% readiness threshold."}
            />
            <Insight
              tone={metrics.expiredDocuments > 0 ? "red" : metrics.expiringDocuments > 0 ? "amber" : "emerald"}
              title="Compliance continuity"
              text={metrics.expiredDocuments > 0 ? `${metrics.expiredDocuments} tracked fleet document(s) are already expired. Even technically fit vehicles may face operational interruption until these records are renewed.` : metrics.expiringDocuments > 0 ? `${metrics.expiringDocuments} tracked document(s) expire within 60 days. Early renewal will reduce avoidable fleet downtime.` : "No tracked vehicle documents are expired or due within 60 days."}
            />
          </div>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
        <Card className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Vehicle readiness ranking</h2>
              <p className="mt-1 text-sm text-slate-500">Composite readiness from vehicle status, technical results and Pre-Trip clearance.</p>
            </div>
            <BarChart3 className="h-5 w-5 text-slate-400" />
          </div>
          {chartVehicles.length > 0 ? (
            <div className="mt-5 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartVehicles} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 10, fill: "#64748b" }} />
                  <YAxis dataKey="registrationNumber" type="category" width={78} tick={{ fontSize: 10, fill: "#475569" }} />
                  <Tooltip formatter={(value) => [`${value}%`, "Readiness score"]} />
                  <ReferenceLine x={75} stroke="#f59e0b" strokeDasharray="4 4" />
                  <Bar dataKey="readinessScore" name="Readiness score" fill="#2563eb" radius={[0, 5, 5, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-5 grid min-h-60 place-items-center rounded-2xl border border-dashed border-slate-200 px-6 text-center text-sm text-slate-500">
              Vehicle readiness rankings will appear when technical or Pre-Trip inspection activity is available.
            </div>
          )}
          {noActivityVehicles.length > 0 && (
            <p className="mt-3 text-xs text-slate-500">{noActivityVehicles.length} vehicle(s) are excluded from readiness ranking because they have no recorded technical or Pre-Trip activity.</p>
          )}
        </Card>

        <Card className="p-5 sm:p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Fleet availability profile</h2>
            <p className="mt-1 text-sm text-slate-500">Available capacity versus vehicles currently unavailable for normal operations.</p>
          </div>
          <div className="mt-5 grid items-center gap-5 sm:grid-cols-[190px_1fr]">
            <div className="h-[190px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={fleetPie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={78} paddingAngle={3}>
                    {fleetPie.map((item) => <Cell key={item.name} fill={item.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              <AvailabilityRow label="Available" value={metrics.availableVehicles} total={metrics.fleetSize} tone="emerald" />
              <AvailabilityRow label="Unavailable" value={metrics.unavailableVehicles} total={metrics.fleetSize} tone="red" />
              <div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                Available capacity includes vehicles recorded as <strong>active</strong> or <strong>passed</strong>. Failed, suspended, decommissioned and other non-available states reduce usable fleet capacity.
              </div>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  helper,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  helper: string;
  tone: "blue" | "emerald" | "amber" | "red" | "violet";
}) {
  const styles = {
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    red: "bg-rose-50 text-rose-700 ring-rose-100",
    violet: "bg-violet-50 text-violet-700 ring-violet-100",
  };
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p>
        </div>
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ${styles[tone]}`}>{icon}</div>
      </div>
    </Card>
  );
}

function Insight({ tone, title, text }: { tone: "blue" | "emerald" | "amber" | "red"; title: string; text: string }) {
  const icon = tone === "emerald"
    ? <TrendingUp className="h-4 w-4" />
    : tone === "red"
      ? <TrendingDown className="h-4 w-4" />
      : <AlertTriangle className="h-4 w-4" />;
  const styles = {
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-rose-50 text-rose-700",
  };
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-100 p-3.5">
      <div className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${styles[tone]}`}>{icon}</div>
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-600">{text}</p>
      </div>
    </div>
  );
}

function AvailabilityRow({ label, value, total, tone }: { label: string; value: number; total: number; tone: "emerald" | "red" }) {
  const rate = percent(value, total);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="font-semibold text-slate-950">{value} · {rate}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone === "emerald" ? "bg-emerald-500" : "bg-rose-500"}`} style={{ width: `${rate}%` }} />
      </div>
    </div>
  );
}