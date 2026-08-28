"use client";

import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, AreaChart, Area,
} from "recharts";

const COLORS = ["#0f766e", "#334155", "#d97706", "#4f46e5", "#be123c", "#0369a1", "#7c3aed"];

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
  // Format month labels (YYYY-MM -> Month Year)
  const formatMonth = (month: string) => {
    const [year, m] = month.split("-");
    return `${MONTH_NAMES[parseInt(m) - 1]} ${year.slice(2)}`;
  };

  return (
    <div className="space-y-4">
      {/* Chart */}
      <ResponsiveContainer width="100%" height={330}>
        <AreaChart data={data} margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
          <defs>
            {/* Vibrant Pass Gradient */}
            <linearGradient id="passGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0f766e" stopOpacity={0.8} />
              <stop offset="50%" stopColor="#2dd4bf" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#99f6e4" stopOpacity={0.1} />
            </linearGradient>
            
            {/* Vibrant Fail Gradient */}
            <linearGradient id="failGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#dc5a5a" stopOpacity={0.8} />
              <stop offset="50%" stopColor="#f08a8a" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#fecaca" stopOpacity={0.1} />
            </linearGradient>
            
            {/* Conditional Gradient */}
            <linearGradient id="conditionalGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d97706" stopOpacity={0.6} />
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
          
          <Legend 
            wrapperStyle={{ paddingTop: "20px" }}
            iconType="circle"
            iconSize={10}
          />
          
          <Area 
            type="monotone" 
            dataKey="pass" 
            stroke="#0f766e" 
            strokeWidth={2.5}
            fill="url(#passGradient)" 
            name="Pass"
            dot={{ fill: "#0f766e", r: 4, strokeWidth: 2, stroke: "#fff" }}
            activeDot={{ r: 6, fill: "#0f766e", stroke: "#fff", strokeWidth: 2 }}
          />
          
          <Area 
            type="monotone" 
            dataKey="fail" 
            stroke="#dc5a5a" 
            strokeWidth={2.5}
            fill="url(#failGradient)" 
            name="Fail"
            dot={{ fill: "#dc5a5a", r: 4, strokeWidth: 2, stroke: "#fff" }}
            activeDot={{ r: 6, fill: "#dc5a5a", stroke: "#fff", strokeWidth: 2 }}
          />
          
          <Area 
            type="monotone" 
            dataKey="conditional" 
            stroke="#d97706" 
            strokeWidth={2.5}
            fill="url(#conditionalGradient)" 
            name="Conditional"
            strokeDasharray="5 5"
            dot={{ fill: "#d97706", r: 3, strokeWidth: 2, stroke: "#fff" }}
            activeDot={{ r: 5, fill: "#d97706", stroke: "#fff", strokeWidth: 2 }}
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
        <Bar dataKey="pass" stackId="outcome" fill="#0f766e" name="Pass" radius={[4, 0, 0, 4]} />
        <Bar dataKey="fail" stackId="outcome" fill="#dc5a5a" name="Fail" radius={[0, 4, 4, 0]} />
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
        <Bar dataKey="pass" fill="#0f766e" name="Pass" radius={[0, 4, 4, 0]} />
        <Bar dataKey="fail" fill="#dc5a5a" name="Fail" radius={[0, 4, 4, 0]} />
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
        <Bar dataKey="failures" fill="#be123c" radius={[0, 5, 5, 0]} />
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

export function RegionHeatMap({ data }: { data: { region: string; vehicles: number; inspections: number; passRate: number }[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {data.map((region) => {
        const passRate = Math.max(0, Math.min(100, region.passRate || 0));
        const tone = passRate >= 80
          ? "bg-teal-50 text-teal-700 ring-teal-100"
          : passRate >= 60
            ? "bg-amber-50 text-amber-700 ring-amber-100"
            : "bg-rose-50 text-rose-700 ring-rose-100";
        const bar = passRate >= 80 ? "bg-teal-600" : passRate >= 60 ? "bg-amber-500" : "bg-rose-600";

        return (
          <div key={region.region} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{region.region}</p>
                <p className="mt-1 text-xs text-slate-500">{region.vehicles} vehicles · {region.inspections} inspections</p>
              </div>
              <span className={"rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset " + tone}>
                {passRate}%
              </span>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-label={region.region + " pass rate " + passRate + "%"}>
              <div className={"h-full rounded-full " + bar} style={{ width: passRate + "%" }} />
            </div>
          </div>
        );
      })}
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
        <Bar dataKey="pass" fill="#0f766e" name="Pass" radius={[4, 4, 0, 0]} />
        <Bar dataKey="fail" fill="#dc5a5a" name="Fail" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
