"use client";

import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, AreaChart, Area,
} from "recharts";

const COLORS = ["#10b981", "#2563eb", "#f59e0b", "#8b5cf6", "#f43f5e", "#06b6d4", "#ec4899"];

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatMonthLabel(month: string) {
  const [year, m] = month.split("-");
  return `${MONTH_NAMES[parseInt(m) - 1]} ${year.slice(2)}`;
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const total = payload.reduce((sum: number, p: any) => sum + (p.value || 0), 0);
    return (
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-4 min-w-[200px]">
        <p className="text-sm font-bold text-slate-900 mb-3 pb-2 border-b border-slate-200">{formatMonthLabel(label)}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between mb-2 last:mb-0">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ background: entry.color }} />
              <span className="text-sm text-slate-700">{entry.name}</span>
            </div>
            <span className="text-sm font-semibold text-slate-900">{entry.value}</span>
          </div>
        ))}
        <div className="mt-3 pt-2 border-t border-slate-200 flex justify-between">
          <span className="text-xs text-slate-500">Total</span>
          <span className="text-sm font-bold text-slate-900">{total}</span>
        </div>
      </div>
    );
  }
  return null;
}

export function TrendChart({ data }: { data: { month: string; pass: number; fail: number; conditional: number }[] }) {
  const formatMonth = (month: string) => {
    const [year, m] = month.split("-");
    return `${MONTH_NAMES[parseInt(m) - 1]} ${year.slice(2)}`;
  };

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={330}>
        <AreaChart data={data} margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
          <defs>
            <linearGradient id="passGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
              <stop offset="50%" stopColor="#34d399" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#a7f3d0" stopOpacity={0.1} />
            </linearGradient>
            <linearGradient id="failGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.8} />
              <stop offset="50%" stopColor="#fb7185" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#fecdd3" stopOpacity={0.1} />
            </linearGradient>
            <linearGradient id="conditionalGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.6} />
              <stop offset="100%" stopColor="#fbbf24" stopOpacity={0.2} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" opacity={0.8} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickFormatter={formatMonth}
            axisLine={{ stroke: "#cbd5e1" }}
            tickLine={{ stroke: "#cbd5e1" }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={{ stroke: "#cbd5e1" }}
            tickLine={{ stroke: "#cbd5e1" }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#cbd5e1", strokeWidth: 1 }} />
          <Legend wrapperStyle={{ paddingTop: "20px" }} iconType="circle" iconSize={10} />
          <Area
            type="monotone"
            dataKey="pass"
            stroke="#10b981"
            strokeWidth={2.5}
            fill="url(#passGradient)"
            name="Pass"
            dot={{ fill: "#10b981", r: 4, strokeWidth: 2, stroke: "#fff" }}
            activeDot={{ r: 6, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }}
          />
          <Area
            type="monotone"
            dataKey="fail"
            stroke="#f43f5e"
            strokeWidth={2.5}
            fill="url(#failGradient)"
            name="Fail"
            dot={{ fill: "#f43f5e", r: 4, strokeWidth: 2, stroke: "#fff" }}
            activeDot={{ r: 6, fill: "#f43f5e", stroke: "#fff", strokeWidth: 2 }}
          />
          <Area
            type="monotone"
            dataKey="conditional"
            stroke="#f59e0b"
            strokeWidth={2.5}
            fill="url(#conditionalGradient)"
            name="Conditional"
            strokeDasharray="5 5"
            dot={{ fill: "#f59e0b", r: 3, strokeWidth: 2, stroke: "#fff" }}
            activeDot={{ r: 5, fill: "#f59e0b", stroke: "#fff", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StationChart({ data }: { data: { station: string; pass: number; fail: number; passRate: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={330}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 28 }}>
        <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="station"
          width={118}
          tick={{ fontSize: 10, fill: "#475569" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip cursor={{ fill: "#f8fafc" }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: "14px", fontSize: "12px" }} />
        <Bar dataKey="pass" stackId="outcome" fill="#10b981" name="Pass" radius={[4, 0, 0, 4]} />
        <Bar dataKey="fail" stackId="outcome" fill="#f43f5e" name="Fail" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TransporterChart({ data }: { data: { transporter: string; pass: number; fail: number; passRate: number }[] }) {
  const top = data.slice(0, 6);
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={top} layout="vertical" margin={{ top: 10, right: 20, bottom: 0, left: 100 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis type="number" tick={{ fontSize: 12 }} />
        <YAxis type="category" dataKey="transporter" tick={{ fontSize: 11 }} width={95} />
        <Tooltip />
        <Legend />
        <Bar dataKey="pass" fill="#10b981" name="Pass" radius={[0, 4, 4, 0]} />
        <Bar dataKey="fail" fill="#f43f5e" name="Fail" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DefectsChart({ data }: { data: { item: string; failures: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ top: 10, right: 20, bottom: 0, left: 150 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis type="number" tick={{ fontSize: 12 }} />
        <YAxis type="category" dataKey="item" tick={{ fontSize: 11 }} width={145} />
        <Tooltip />
        <Bar dataKey="failures" fill="#e11d48" radius={[0, 5, 5, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CategoryPie({ data }: { data: { category: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="category" cx="50%" cy="50%" outerRadius={95} label={(e: any) => `${e.category} (${e.count})`}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

type RegionalComplianceRow = {
  region: string;
  vehicles: number;
  inspections: number;
  passRate: number | null;
  pass?: number;
  fail?: number;
  conditional?: number;
};

export function RegionHeatMap({ data }: { data: RegionalComplianceRow[] }) {
  const totalVehicles = data.reduce((sum, region) => sum + Number(region.vehicles || 0), 0);
  const unassignedVehicles = data.find((region) => region.region === "Unassigned")?.vehicles || 0;
  const regionCoverage = totalVehicles > 0
    ? Math.round(((totalVehicles - unassignedVehicles) / totalVehicles) * 100)
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Region reflects the <strong className="font-semibold text-slate-800">transporter operating region</strong> stored on each transporter profile.
        </p>
        <span className={`shrink-0 rounded-full px-2.5 py-1 font-semibold ${unassignedVehicles > 0 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
          {regionCoverage}% fleet region coverage
        </span>
      </div>

      {unassignedVehicles > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
          <strong>{unassignedVehicles} vehicle{unassignedVehicles === 1 ? "" : "s"}</strong> currently fall under <strong>Unassigned</strong> because their linked transporter profile has no operating region. Their inspection results are still included, but regional interpretation remains incomplete until those transporter records are updated.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {data.map((region) => {
          const hasInspectionData = region.inspections > 0 && region.passRate !== null;
          const passRate = hasInspectionData ? Math.max(0, Math.min(100, Number(region.passRate))) : 0;
          const tone = !hasInspectionData
            ? "bg-white/80 text-slate-600 ring-slate-300"
            : passRate >= 80
              ? "bg-white/80 text-emerald-700 ring-emerald-300"
              : passRate >= 60
                ? "bg-white/80 text-orange-700 ring-orange-300"
                : "bg-white/80 text-rose-700 ring-rose-300";
          const surface = !hasInspectionData
            ? "border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100/80"
            : passRate >= 80
              ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-100/80"
              : passRate >= 60
                ? "border-orange-200 bg-gradient-to-br from-amber-50 to-orange-100/80"
                : "border-rose-200 bg-gradient-to-br from-rose-50 to-pink-100/80";
          const bar = !hasInspectionData
            ? "bg-slate-300"
            : passRate >= 80
              ? "bg-gradient-to-r from-emerald-500 to-teal-400"
              : passRate >= 60
                ? "bg-gradient-to-r from-amber-400 to-orange-500"
                : "bg-gradient-to-r from-rose-500 to-pink-500";

          const resultDetails = hasInspectionData
            ? [
                `${Number(region.pass || 0)} pass`,
                `${Number(region.fail || 0)} fail`,
                Number(region.conditional || 0) > 0 ? `${Number(region.conditional || 0)} conditional` : null,
              ].filter(Boolean).join(" · ")
            : "No technical inspection results recorded";

          return (
            <div key={region.region} className={"rounded-xl border p-4 shadow-sm " + surface}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{region.region}</p>
                  <p className="mt-1 text-xs text-slate-600">{region.vehicles} vehicles · {region.inspections} inspections</p>
                  <p className="mt-1 text-[11px] text-slate-500">{resultDetails}</p>
                </div>
                <span className={"rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm ring-1 ring-inset " + tone}>
                  {hasInspectionData ? `${passRate}%` : "No data"}
                </span>
              </div>
              <div
                className="mt-4 h-2 overflow-hidden rounded-full bg-white/80 shadow-inner"
                aria-label={hasInspectionData ? `${region.region} pass rate ${passRate}%` : `${region.region} has no inspection data`}
              >
                <div className={"h-full rounded-full " + bar} style={{ width: hasInspectionData ? `${passRate}%` : "0%" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function InspectorChart({ data }: { data: { inspector: string; inspections: number; pass: number; fail: number }[] }) {
  const top = data.slice(0, 5);
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={top} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="inspector" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        <Bar dataKey="pass" fill="#10b981" name="Pass" radius={[4, 4, 0, 0]} />
        <Bar dataKey="fail" fill="#f43f5e" name="Fail" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
