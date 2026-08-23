import { db } from "@/db";
import { dailyInspections, vehicles, transporters } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { PageHeader, Card, Badge, Button, StatCard, EmptyState } from "@/components/ui";
import { requireAuth } from "@/lib/require-auth";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Plus, ClipboardCheck, CheckCircle2, XCircle, AlertTriangle, Calendar, Truck, Activity } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DailyInspectionsPage() {
  await requireAuth();

  const today = new Date().toISOString().slice(0, 10);

  const [todaysRows, recentRows, stats] = await Promise.all([
    db
      .select({
        id: dailyInspections.id,
        inspectionDate: dailyInspections.inspectionDate,
        status: dailyInspections.status,
        driverName: dailyInspections.driverName,
        completedAt: dailyInspections.completedAt,
        clearedForTrip: dailyInspections.clearedForTrip,
        passedItems: dailyInspections.passedItems,
        totalItems: dailyInspections.totalItems,
        regNumber: vehicles.registrationNumber,
        make: vehicles.make,
        model: vehicles.model,
      })
      .from(dailyInspections)
      .innerJoin(vehicles, eq(vehicles.id, dailyInspections.vehicleId))
      .where(eq(dailyInspections.inspectionDate, today))
      .orderBy(desc(dailyInspections.completedAt)),
    db
      .select({
        id: dailyInspections.id,
        inspectionDate: dailyInspections.inspectionDate,
        status: dailyInspections.status,
        driverName: dailyInspections.driverName,
        completedAt: dailyInspections.completedAt,
        clearedForTrip: dailyInspections.clearedForTrip,
        passedItems: dailyInspections.passedItems,
        totalItems: dailyInspections.totalItems,
        regNumber: vehicles.registrationNumber,
        make: vehicles.make,
        model: vehicles.model,
      })
      .from(dailyInspections)
      .innerJoin(vehicles, eq(vehicles.id, dailyInspections.vehicleId))
      .orderBy(desc(dailyInspections.inspectionDate), desc(dailyInspections.completedAt))
      .limit(15),
    db
      .select({
        total: sql<number>`count(*)::int`,
        passed: sql<number>`count(*) filter (where ${dailyInspections.status} = 'passed')::int`,
        failed: sql<number>`count(*) filter (where ${dailyInspections.status} = 'failed')::int`,
        defectNoted: sql<number>`count(*) filter (where ${dailyInspections.status} = 'defect_noted')::int`,
      })
      .from(dailyInspections),
  ]);

  const passRate = stats[0]?.total
    ? Math.round(((stats[0].passed || 0) / stats[0].total) * 100)
    : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-10">
      <PageHeader
        eyebrow="Pre-Trip Safety"
        title="Daily Inspections"
        description="Pre-trip inspection protocol for tires, brakes, lights, and fluids."
        action={
          <Link href="/daily-inspections/new">
            <Button>
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">New Daily Check</span><span className="sm:hidden">New</span>
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <StatCard label="Today's Checks" value={todaysRows.length} tone="blue" icon={<Calendar className="h-4 w-4 sm:h-5 sm:w-5" />} />
        <StatCard label="Total Checks" value={stats[0]?.total || 0} tone="slate" icon={<ClipboardCheck className="h-4 w-4 sm:h-5 sm:w-5" />} />
        <StatCard label="Pass Rate" value={`${passRate}%`} hint={`${stats[0]?.passed || 0} passed`} tone="emerald" icon={<CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />} />
        <StatCard label="Grounded" value={stats[0]?.failed || 0} hint="Failed — cannot depart" tone="red" icon={<XCircle className="h-4 w-4 sm:h-5 sm:w-5" />} />
      </div>

      <Card className="p-4 sm:p-6 mb-4 sm:mb-6 bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg sm:rounded-xl bg-emerald-600 text-white grid place-items-center shrink-0">
            <Activity className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-lg font-semibold text-slate-950 mb-1">Pre-Trip Protocol</h2>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed mb-3">
              Every vehicle must complete this daily inspection <strong>before leaving the yard</strong>.
              Verifies tires, brakes, lights, fluids across 9 categories.
            </p>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1 sm:gap-1.5">
                <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-600" /> Pass: cleared
              </span>
              <span className="inline-flex items-center gap-1 sm:gap-1.5">
                <AlertTriangle className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-600" /> Defect: monitor
              </span>
              <span className="inline-flex items-center gap-1 sm:gap-1.5">
                <XCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-red-600" /> Fail: grounded
              </span>
            </div>
          </div>
        </div>
      </Card>

      {todaysRows.length > 0 && (
        <Card className="p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-base sm:text-lg font-semibold text-slate-950 flex items-center gap-2">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5" /> Today&apos;s Inspections ({todaysRows.length})
            </h2>
          </div>
          <InspectionTable rows={todaysRows} />
        </Card>
      )}

      <Card className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h2 className="text-base sm:text-lg font-semibold text-slate-950 flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 sm:h-5 sm:w-5" /> Recent Inspections
          </h2>
          <Badge tone="slate">{recentRows.length} records</Badge>
        </div>
        {recentRows.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck className="h-10 w-10" />}
            title="No daily inspections yet"
            description="Start your first pre-trip check to begin tracking daily roadworthiness."
          />
        ) : (
          <InspectionTable rows={recentRows} />
        )}
      </Card>
    </div>
  );
}

function InspectionTable({ rows }: { rows: any[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
          <tr>
            <th className="py-2 pr-4 text-left">Date</th>
            <th className="py-2 pr-4 text-left">Vehicle</th>
            <th className="py-2 pr-4 text-left">Driver</th>
            <th className="py-2 pr-4 text-left">Items Passed</th>
            <th className="py-2 pr-4 text-left">Status</th>
            <th className="py-2 pr-4 text-left">Trip Clearance</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
              <td className="py-3 pr-4">
                <p className="font-medium text-slate-900">{formatDate(r.inspectionDate)}</p>
                <p className="text-xs text-slate-500">{r.completedAt ? new Date(r.completedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—"}</p>
              </td>
              <td className="py-3 pr-4">
                <p className="font-medium text-slate-900">{r.regNumber}</p>
                <p className="text-xs text-slate-500">{r.make} {r.model}</p>
              </td>
              <td className="py-3 pr-4 text-slate-700">{r.driverName || "—"}</td>
              <td className="py-3 pr-4">
                <span className="font-semibold text-emerald-700">{r.passedItems}</span>
                <span className="text-slate-500">/{r.totalItems}</span>
              </td>
              <td className="py-3 pr-4"><StatusBadge status={r.status} /></td>
              <td className="py-3 pr-4">
                {r.clearedForTrip ? (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Cleared
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-red-700 font-medium">
                    <XCircle className="h-3.5 w-3.5" /> Grounded
                  </span>
                )}
              </td>
              <td className="py-3 text-right">
                <Link href={`/daily-inspections/${r.id}`} className="text-sm text-amber-700 hover:text-amber-800 font-medium">
                  View →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "passed") {
    return <Badge tone="emerald"><CheckCircle2 className="h-3.5 w-3.5" /> Passed</Badge>;
  }
  if (status === "failed") {
    return <Badge tone="red"><XCircle className="h-3.5 w-3.5" /> Failed</Badge>;
  }
  return <Badge tone="amber"><AlertTriangle className="h-3.5 w-3.5" /> Defect Noted</Badge>;
}
