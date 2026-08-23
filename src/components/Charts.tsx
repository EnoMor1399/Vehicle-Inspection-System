"use client";

import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, AreaChart, Area,
} from "recharts";

const COLORS = ["#0f172a", "#f59e0b", "#ef4444", "#10b981", "#6366f1", "#8b5cf6", "#ec4899"];

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
  // Calculate summary stats
  const totalPass = data.reduce((sum, d) => sum + d.pass, 0);
  const totalFail = data.reduce((sum, d) => sum + d.fail, 0);
  const totalConditional = data.reduce((sum, d) => sum + d.conditional, 0);
  const totalInspections = totalPass + totalFail + totalConditional;
  const passRate = totalInspections > 0 ? ((totalPass / totalInspections) * 100).toFixed(1) : "0";

  // Format month labels (YYYY-MM -> Month Year)
  const formatMonth = (month: string) => {
    const [year, m] = month.split("-");
    return `${MONTH_NAMES[parseInt(m) - 1]} ${year.slice(2)}`;
  };

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-3 border border-emerald-200">
          <p className="text-xs text-emerald-700 font-medium mb-1">Total Passed</p>
          <p className="text-2xl font-bold text-emerald-600">{totalPass}</p>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-3 border border-red-200">
          <p className="text-xs text-red-700 font-medium mb-1">Total Failed</p>
          <p className="text-2xl font-bold text-red-600">{totalFail}</p>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-3 border border-amber-200">
          <p className="text-xs text-amber-700 font-medium mb-1">Conditional</p>
          <p className="text-2xl font-bold text-amber-600">{totalConditional}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
          <p className="text-xs text-blue-700 font-medium mb-1">Pass Rate</p>
          <p className="text-2xl font-bold text-blue-600">{passRate}%</p>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={data} margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
          <defs>
            {/* Vibrant Pass Gradient */}
            <linearGradient id="passGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
              <stop offset="50%" stopColor="#34d399" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#6ee7b7" stopOpacity={0.1} />
            </linearGradient>
            
            {/* Vibrant Fail Gradient */}
            <linearGradient id="failGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.8} />
              <stop offset="50%" stopColor="#f87171" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#fca5a5" stopOpacity={0.1} />
            </linearGradient>
            
            {/* Conditional Gradient */}
            <linearGradient id="conditionalGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.6} />
              <stop offset="100%" stopColor="#fbbf24" stopOpacity={0.2} />
            </linearGradient>

            {/* Glow filters */}
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
          
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
            stroke="#10b981" 
            strokeWidth={3}
            fill="url(#passGradient)" 
            name="Pass"
            dot={{ fill: "#10b981", r: 4, strokeWidth: 2, stroke: "#fff" }}
            activeDot={{ r: 6, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }}
            filter="url(#glow)"
          />
          
          <Area 
            type="monotone" 
            dataKey="fail" 
            stroke="#ef4444" 
            strokeWidth={3}
            fill="url(#failGradient)" 
            name="Fail"
            dot={{ fill: "#ef4444", r: 4, strokeWidth: 2, stroke: "#fff" }}
            activeDot={{ r: 6, fill: "#ef4444", stroke: "#fff", strokeWidth: 2 }}
            filter="url(#glow)"
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
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 20, bottom: 40, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="station" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        <Bar dataKey="pass" stackId="a" fill="#10b981" name="Pass" />
        <Bar dataKey="fail" stackId="a" fill="#ef4444" name="Fail" />
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
        <Bar dataKey="pass" fill="#10b981" name="Pass" />
        <Bar dataKey="fail" fill="#ef4444" name="Fail" />
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
        <Bar dataKey="failures" fill="#ef4444" />
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {data.map((r) => {
        const intensity = Math.min(1, (r.passRate || 0) / 100);
        const bg = `rgba(16, 185, 129, ${0.15 + intensity * 0.6})`;
        return (
          <div key={r.region} className="rounded-xl p-4 text-white" style={{ background: bg }}>
            <p className="text-sm font-semibold truncate">{r.region}</p>
            <p className="text-2xl font-bold mt-1">{r.passRate}%</p>
            <p className="text-xs opacity-80">{r.vehicles} vehicles · {r.inspections} inspections</p>
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
        <Bar dataKey="pass" fill="#10b981" name="Pass" />
        <Bar dataKey="fail" fill="#ef4444" name="Fail" />
      </BarChart>
    </ResponsiveContainer>
  );
}
