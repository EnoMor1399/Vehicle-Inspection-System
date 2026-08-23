"use client";

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, Award, AlertTriangle, CheckCircle2, XCircle, Calendar, BarChart3 } from "lucide-react";
import { useState } from "react";
import type { YearlyData } from "@/lib/analytics";

interface YearlyComparisonChartProps {
  data: YearlyData[];
  showStats?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const yearData = payload[0]?.payload;
    if (!yearData) return null;

    return (
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-5 min-w-[280px]">
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-200">
          <div>
            <p className="text-lg font-bold text-slate-900">{label}</p>
            <p className="text-xs text-slate-500">Annual Performance Summary</p>
          </div>
          <div className={`px-2 py-1 rounded-full text-xs font-semibold ${
            yearData.passRate >= 80 ? "bg-emerald-100 text-emerald-700" :
            yearData.passRate >= 60 ? "bg-amber-100 text-amber-700" :
            "bg-red-100 text-red-700"
          }`}>
            {yearData.passRate}% Pass
          </div>
        </div>

        <div className="space-y-2 mb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-sm text-slate-700">Passed</span>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold text-slate-900">{yearData.pass}</span>
              <span className="text-xs text-slate-500 ml-1">({yearData.passRate}%)</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-sm text-slate-700">Failed</span>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold text-slate-900">{yearData.fail}</span>
              <span className="text-xs text-slate-500 ml-1">({yearData.failRate}%)</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-sm text-slate-700">Conditional</span>
            </div>
            <span className="text-sm font-bold text-slate-900">{yearData.conditional}</span>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-200 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600">Total Inspections</span>
            <span className="font-semibold text-slate-900">{yearData.total}</span>
          </div>
          {yearData.yoyGrowth !== null && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">YoY Growth</span>
              <span className={`font-semibold flex items-center gap-1 ${
                yearData.yoyGrowth >= 0 ? "text-emerald-600" : "text-red-600"
              }`}>
                {yearData.yoyGrowth >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {yearData.yoyGrowth > 0 ? "+" : ""}{yearData.yoyGrowth}%
              </span>
            </div>
          )}
          {yearData.avgBrakeEfficiency > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">Avg Brake Efficiency</span>
              <span className="font-semibold text-slate-900">{yearData.avgBrakeEfficiency}%</span>
            </div>
          )}
        </div>
      </div>
    );
  };

export function YearlyComparisonChart({ data, showStats = true }: YearlyComparisonChartProps) {
  const [activeYear, setActiveYear] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-80 text-slate-500">
        <div className="text-center">
          <Calendar className="h-12 w-12 mx-auto mb-3 text-slate-400" />
          <p className="font-medium">No yearly data available</p>
          <p className="text-sm mt-1">Complete inspections to see yearly trends</p>
        </div>
      </div>
    );
  }

  const currentYear = new Date().getFullYear();
  const latestYear = data[data.length - 1];
  const earliestYear = data[0];

  const totalPass = data.reduce((sum, d) => sum + d.pass, 0);
  const totalFail = data.reduce((sum, d) => sum + d.fail, 0);
  const totalInspections = data.reduce((sum, d) => sum + d.total, 0);
  const avgPassRate = totalInspections > 0 ? Math.round((totalPass / totalInspections) * 1000) / 10 : 0;

  const passRateTrend = latestYear.passRate - earliestYear.passRate;
  const inspectionGrowth = earliestYear.total > 0
    ? Math.round(((latestYear.total - earliestYear.total) / earliestYear.total) * 100)
    : 0;

  const CustomBar = (props: any) => {
    const { x, y, width, height, fill, year } = props;
    const isActive = activeYear === year;
    const isCurrentYear = year === currentYear;

    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill={fill}
          opacity={isActive ? 1 : 0.85}
          rx={4}
          ry={4}
          onMouseEnter={() => setActiveYear(year)}
          onMouseLeave={() => setActiveYear(null)}
          style={{ cursor: "pointer", transition: "opacity 0.2s" }}
        />
        {isCurrentYear && (
          <circle
            cx={x + width / 2}
            cy={y - 8}
            r={4}
            fill="#f59e0b"
            stroke="#fff"
            strokeWidth={2}
          />
        )}
      </g>
    );
  };

  return (
    <div className="space-y-6">
      {/* Summary Statistics */}
      {showStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4 border border-emerald-200">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <p className="text-xs text-emerald-700 font-medium">Total Passed</p>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{totalPass.toLocaleString()}</p>
            <p className="text-xs text-emerald-600 mt-1">{avgPassRate}% avg pass rate</p>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4 border border-red-200">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <p className="text-xs text-red-700 font-medium">Total Failed</p>
            </div>
            <p className="text-2xl font-bold text-red-600">{totalFail.toLocaleString()}</p>
            <p className="text-xs text-red-600 mt-1">Requires attention</p>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <Award className="h-4 w-4 text-blue-600" />
              <p className="text-xs text-blue-700 font-medium">Pass Rate Trend</p>
            </div>
            <p className={`text-2xl font-bold ${passRateTrend >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {passRateTrend >= 0 ? "+" : ""}{passRateTrend}%
            </p>
            <p className="text-xs text-blue-600 mt-1">Since {earliestYear.year}</p>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4 border border-amber-200">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-4 w-4 text-amber-600" />
              <p className="text-xs text-amber-700 font-medium">Volume Growth</p>
            </div>
            <p className={`text-2xl font-bold ${inspectionGrowth >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {inspectionGrowth >= 0 ? "+" : ""}{inspectionGrowth}%
            </p>
            <p className="text-xs text-amber-600 mt-1">Inspection volume</p>
          </div>
        </div>
      )}

      {/* Main Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-amber-600" />
              Year-over-Year Performance
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              Inspection results and pass rate trends ({earliestYear.year} - {latestYear.year})
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-slate-600">Passed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-slate-600">Failed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-slate-600">Conditional</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-0.5 bg-blue-500" />
              <span className="text-slate-600">Pass Rate %</span>
            </div>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <defs>
              <linearGradient id="passGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                <stop offset="100%" stopColor="#059669" stopOpacity={0.8} />
              </linearGradient>
              <linearGradient id="failGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={1} />
                <stop offset="100%" stopColor="#dc2626" stopOpacity={0.8} />
              </linearGradient>
              <linearGradient id="conditionalGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity={1} />
                <stop offset="100%" stopColor="#d97706" stopOpacity={0.8} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 12, fill: "#64748b" }}
              axisLine={{ stroke: "#cbd5e1" }}
              tickLine={{ stroke: "#cbd5e1" }}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={{ stroke: "#cbd5e1" }}
              tickLine={{ stroke: "#cbd5e1" }}
              label={{
                value: "Inspections",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 12, fill: "#64748b" },
              }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11, fill: "#3b82f6" }}
              axisLine={{ stroke: "#3b82f6" }}
              tickLine={{ stroke: "#3b82f6" }}
              domain={[0, 100]}
              label={{
                value: "Pass Rate %",
                angle: 90,
                position: "insideRight",
                style: { fontSize: 12, fill: "#3b82f6" },
              }}
            />

            <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f1f5f9", opacity: 0.5 }} />

            <ReferenceLine yAxisId="right" y={80} stroke="#10b981" strokeDasharray="5 5" opacity={0.3} />

            <Bar yAxisId="left" dataKey="pass" fill="url(#passGradient)" stackId="stack" name="Passed">
              {data.map((entry, index) => (
                <Cell key={`cell-pass-${index}`} />
              ))}
            </Bar>
            <Bar yAxisId="left" dataKey="fail" fill="url(#failGradient)" stackId="stack" name="Failed">
              {data.map((entry, index) => (
                <Cell key={`cell-fail-${index}`} />
              ))}
            </Bar>
            <Bar yAxisId="left" dataKey="conditional" fill="url(#conditionalGradient)" stackId="stack" name="Conditional">
              {data.map((entry, index) => (
                <Cell key={`cell-conditional-${index}`} />
              ))}
            </Bar>

            <Line
              yAxisId="right"
              type="monotone"
              dataKey="passRate"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={{
                fill: "#3b82f6",
                r: 6,
                stroke: "#fff",
                strokeWidth: 2,
              }}
              activeDot={{
                r: 8,
                fill: "#3b82f6",
                stroke: "#fff",
                strokeWidth: 3,
              }}
              name="Pass Rate %"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Year Details Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-amber-600" />
            Detailed Yearly Breakdown
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs uppercase tracking-wider text-slate-600">
                <th className="py-3 px-4 font-semibold">Year</th>
                <th className="py-3 px-4 font-semibold">Total</th>
                <th className="py-3 px-4 font-semibold">Passed</th>
                <th className="py-3 px-4 font-semibold">Failed</th>
                <th className="py-3 px-4 font-semibold">Pass Rate</th>
                <th className="py-3 px-4 font-semibold">YoY Growth</th>
                <th className="py-3 px-4 font-semibold">Trend</th>
              </tr>
            </thead>
            <tbody>
              {data.map((yearData) => (
                <tr
                  key={yearData.year}
                  className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors ${
                    yearData.year === currentYear ? "bg-amber-50/30" : ""
                  }`}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{yearData.year}</span>
                      {yearData.year === currentYear && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                          Current
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-900">{yearData.total}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="font-semibold text-emerald-600">{yearData.pass}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <XCircle className="h-3.5 w-3.5 text-red-600" />
                      <span className="font-semibold text-red-600">{yearData.fail}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            yearData.passRate >= 80 ? "bg-emerald-500" :
                            yearData.passRate >= 60 ? "bg-amber-500" :
                            "bg-red-500"
                          }`}
                          style={{ width: `${yearData.passRate}%` }}
                        />
                      </div>
                      <span className={`text-xs font-semibold min-w-[45px] ${
                        yearData.passRate >= 80 ? "text-emerald-600" :
                        yearData.passRate >= 60 ? "text-amber-600" :
                        "text-red-600"
                      }`}>
                        {yearData.passRate}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {yearData.yoyGrowth !== null ? (
                      <div className={`flex items-center gap-1 ${
                        yearData.yoyGrowth >= 0 ? "text-emerald-600" : "text-red-600"
                      }`}>
                        {yearData.yoyGrowth >= 0 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                        <span className="font-semibold">
                          {yearData.yoyGrowth > 0 ? "+" : ""}{yearData.yoyGrowth}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {yearData.passRate >= 80 ? (
                      <div className="flex items-center gap-1 text-emerald-600">
                        <Award className="h-4 w-4" />
                        <span className="text-xs font-semibold">Excellent</span>
                      </div>
                    ) : yearData.passRate >= 60 ? (
                      <div className="flex items-center gap-1 text-amber-600">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-xs font-semibold">Good</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-red-600">
                        <XCircle className="h-4 w-4" />
                        <span className="text-xs font-semibold">Needs Improvement</span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
