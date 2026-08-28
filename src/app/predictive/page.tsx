import { requirePermission } from "@/lib/require-auth";
import { db } from "@/db";
import { vehicles, inspections } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { PageHeader, Card, Badge } from "@/components/ui";
import { Activity, AlertTriangle, CheckCircle2, Clock, TrendingDown, Wrench } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PredictiveMaintenancePage() {
  await requirePermission("reports");

  // Get all vehicles with their latest inspection data
  const allVehicles = await db.select().from(vehicles).limit(50);
  const predictions = await Promise.all(allVehicles.map(async (v) => {
    const history = await db
      .select({
        inspectionDate: inspections.inspectionDate,
        overallResult: inspections.overallResult,
        sectionData: inspections.sectionData,
      })
      .from(inspections)
      .where(eq(inspections.vehicleId, v.id))
      .orderBy(desc(inspections.inspectionDate))
      .limit(10);

    if (history.length === 0) return null;

    const failures = history.filter((h) => h.overallResult === "fail").length;
    const conditionals = history.filter((h) => h.overallResult === "conditional_pass").length;
    const passes = history.filter((h) => h.overallResult === "pass").length;

    const failureRate = failures / history.length;
    const conditionalRate = conditionals / history.length;
    const riskScore = Math.min(0.99, failureRate * 0.6 + conditionalRate * 0.3);

    const componentFailures: Record<string, number> = {};
    for (const insp of history) {
      const sections = (insp.sectionData || []) as any[];
      for (const s of sections) {
        for (const item of s.items || []) {
          if (item.result === "fail") {
            const key = `${s.title}: ${item.name}`;
            componentFailures[key] = (componentFailures[key] || 0) + 1;
          }
        }
      }
    }

    const atRisk = Object.entries(componentFailures)
      .filter(([, count]) => count >= 2)
      .map(([component, occurrences]) => ({ component, occurrences }))
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 3);

    const status =
      riskScore > 0.7 ? "critical" :
      riskScore > 0.4 ? "warning" :
      riskScore > 0.2 ? "monitor" : "healthy";

    const recommendedReviewDays = riskScore > 0.7
      ? 30
      : riskScore > 0.4
      ? 90
      : riskScore > 0.2
      ? 180
      : null;

    return {
      vehicle: v,
      status,
      riskScore,
      recommendedReviewDays,
      atRisk,
      stats: { passes, failures, conditionals, total: history.length },
    };
  }));

  const validPredictions = predictions.filter(Boolean) as NonNullable<typeof predictions[number]>[];
  validPredictions.sort((a, b) => b.riskScore - a.riskScore);

  const critical = validPredictions.filter((p) => p.status === "critical").length;
  const warning = validPredictions.filter((p) => p.status === "warning").length;
  const monitor = validPredictions.filter((p) => p.status === "monitor").length;
  const healthy = validPredictions.filter((p) => p.status === "healthy").length;

  return (
    <div className="p-6 lg:p-10">
      <PageHeader
        eyebrow="Risk Intelligence"
        title="Maintenance Risk Intelligence"
        description="Historical risk signals derived from recurring inspection outcomes. Use these indicators to prioritize preventive review; they are not a prediction of a specific future failure."
        action={
          <Badge tone="violet" className="text-sm px-3 py-1">
            <Activity className="h-4 w-4" /> Historical Risk Model
          </Badge>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <p className="text-xs text-slate-500">Critical Risk</p>
          </div>
          <p className="text-3xl font-bold text-red-600">{critical}</p>
          <p className="text-xs text-slate-500 mt-1">Requires action within 30 days</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-amber-600" />
            <p className="text-xs text-slate-500">Warning</p>
          </div>
          <p className="text-3xl font-bold text-amber-600">{warning}</p>
          <p className="text-xs text-slate-500 mt-1">Schedule within 90 days</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="h-4 w-4 text-blue-600" />
            <p className="text-xs text-slate-500">Monitor</p>
          </div>
          <p className="text-3xl font-bold text-blue-600">{monitor}</p>
          <p className="text-xs text-slate-500 mt-1">Increase inspection frequency</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <p className="text-xs text-slate-500">Healthy</p>
          </div>
          <p className="text-3xl font-bold text-emerald-600">{healthy}</p>
          <p className="text-xs text-slate-500 mt-1">Continue regular schedule</p>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-950 mb-4">Fleet Health Overview</h2>
        {validPredictions.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">
            Not enough inspection history for predictions. Vehicles need at least 1 inspection.
          </p>
        ) : (
          <div className="space-y-2">
            {validPredictions.map((p) => (
              <a
                key={p.vehicle.id}
                href={`/vehicles/${p.vehicle.id}`}
                className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 transition border border-slate-100"
              >
                <div className="h-10 w-10 rounded-lg bg-slate-100 grid place-items-center shrink-0">
                  <Wrench className="h-5 w-5 text-slate-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">
                    {p.vehicle.registrationNumber} — {p.vehicle.make} {p.vehicle.model}
                  </p>
                  <p className="text-xs text-slate-500">
                    {p.stats.total} inspections · {p.stats.passes} pass · {p.stats.failures} fail
                    {p.atRisk.length > 0 && ` · At-risk: ${p.atRisk[0].component}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <RiskBadge status={p.status} />
                  <p className="text-xs text-slate-500 mt-1">
                    Risk: <span className="font-medium">{Math.round(p.riskScore * 100)}%</span>
                    {p.recommendedReviewDays && ` · review ≤${p.recommendedReviewDays}d`}
                  </p>
                </div>
              </a>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function RiskBadge({ status }: { status: string }) {
  const map: Record<string, { tone: "red" | "amber" | "blue" | "emerald"; label: string }> = {
    critical: { tone: "red", label: "Critical" },
    warning: { tone: "amber", label: "Warning" },
    monitor: { tone: "blue", label: "Monitor" },
    healthy: { tone: "emerald", label: "Healthy" },
  };
  const m = map[status] || { tone: "slate" as const, label: status };
  return <Badge tone={m.tone as any}>{m.label}</Badge>;
}
