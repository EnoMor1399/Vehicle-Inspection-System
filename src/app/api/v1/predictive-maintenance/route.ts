import { authenticateApiRequest, json } from "@/lib/api-auth";
import { db } from "@/db";
import { vehicles, inspections } from "@/db/schema";
import { eq, desc, inArray, lte, sql, and } from "drizzle-orm";

type VehicleRecord = typeof vehicles.$inferSelect;
type HistoryRecord = Pick<
  typeof inspections.$inferSelect,
  "inspectionDate" | "overallResult" | "sectionData"
>;

// Historical maintenance-risk endpoint.
// This endpoint intentionally reports evidence-based risk indicators rather than
// claiming to predict an exact component failure date.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const privateRiskHeaders = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie, Authorization, X-API-Key" };

export async function GET(request: Request) {
  const auth = await authenticateApiRequest({ scopes: ["read"], permission: "reports" });
  if (!auth.ok) return Response.json({ error: { status: auth.status, message: auth.message } }, { status: auth.status, headers: privateRiskHeaders });
  if (!auth.user.organizationId) return Response.json({ error: { status: 403, message: "Organization context is required" } }, { status: 403, headers: privateRiskHeaders });

  const url = new URL(request.url);
  const vehicleId = url.searchParams.get("vehicle_id")?.trim() || null;
  if (vehicleId && vehicleId.length > 64) return Response.json({ error: { status: 400, message: "vehicle_id is invalid" } }, { status: 400, headers: privateRiskHeaders });

  if (!vehicleId) {
    const selectedVehicles = await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.organizationId, auth.user.organizationId))
      .orderBy(desc(vehicles.createdAt))
      .limit(100);

    if (selectedVehicles.length === 0) {
      return json({
        methodology: "deterministic_historical_heuristic_v2",
        disclaimer: "Risk indicators summarize recorded inspection history. They are not a prediction of a specific future failure and do not replace physical inspection or qualified maintenance assessment.",
        data: [],
      }, 200, privateRiskHeaders);
    }

    const vehicleIds = selectedVehicles.map((vehicle) => vehicle.id);
    const rankedHistory = db
      .select({
        vehicleId: inspections.vehicleId,
        inspectionDate: inspections.inspectionDate,
        overallResult: inspections.overallResult,
        sectionData: inspections.sectionData,
        rank: sql<number>`row_number() over (partition by ${inspections.vehicleId} order by ${inspections.inspectionDate} desc)`.as("inspection_rank"),
      })
      .from(inspections)
      .where(eq(inspections.organizationId, auth.user.organizationId))
      .as("ranked_history");

    const historyRows = await db
      .select({
        vehicleId: rankedHistory.vehicleId,
        inspectionDate: rankedHistory.inspectionDate,
        overallResult: rankedHistory.overallResult,
        sectionData: rankedHistory.sectionData,
      })
      .from(rankedHistory)
      .where(and(
        inArray(rankedHistory.vehicleId, vehicleIds),
        lte(rankedHistory.rank, 12)
      ));

    const historyByVehicle = new Map<string, HistoryRecord[]>();
    for (const row of historyRows) {
      const history = historyByVehicle.get(row.vehicleId) || [];
      history.push({
        inspectionDate: row.inspectionDate,
        overallResult: row.overallResult,
        sectionData: row.sectionData,
      });
      historyByVehicle.set(row.vehicleId, history);
    }

    const assessments = selectedVehicles.map((vehicle) => ({
      vehicle,
      assessment: assessVehicleRiskFromHistory(vehicle, historyByVehicle.get(vehicle.id) || []),
    }));

    assessments.sort((a, b) => b.assessment.risk_score - a.assessment.risk_score);
    return json({
      methodology: "deterministic_historical_heuristic_v2",
      disclaimer: "Risk indicators summarize recorded inspection history. They are not a prediction of a specific future failure and do not replace physical inspection or qualified maintenance assessment.",
      data: assessments.slice(0, 20),
    }, 200, privateRiskHeaders);
  }

  const [vehicle] = await db
    .select()
    .from(vehicles)
    .where(and(
      eq(vehicles.organizationId, auth.user.organizationId),
      eq(vehicles.id, vehicleId),
    ))
    .limit(1);
  if (!vehicle) return Response.json({ error: { status: 404, message: "Vehicle not found" } }, { status: 404, headers: privateRiskHeaders });

  const history = await db
    .select({
      inspectionDate: inspections.inspectionDate,
      overallResult: inspections.overallResult,
      sectionData: inspections.sectionData,
    })
    .from(inspections)
    .where(and(
      eq(inspections.organizationId, auth.user.organizationId),
      eq(inspections.vehicleId, vehicleId),
    ))
    .orderBy(desc(inspections.inspectionDate))
    .limit(12);

  return json({
    methodology: "deterministic_historical_heuristic_v2",
    disclaimer: "Risk indicators summarize recorded inspection history. They are not a prediction of a specific future failure and do not replace physical inspection or qualified maintenance assessment.",
    data: assessVehicleRiskFromHistory(vehicle, history),
  }, 200, privateRiskHeaders);
}

export function assessVehicleRiskFromHistory(vehicle: VehicleRecord, history: HistoryRecord[]) {
  if (history.length === 0) {
    return {
      vehicle_id: vehicle.id,
      registration: vehicle.registrationNumber,
      status: "insufficient_data",
      risk_score: 0,
      recommended_review_days: 30,
      recommended_action: "Establish a baseline inspection before relying on historical risk indicators.",
      recurring_defects: [],
      historical_stats: { total_inspections: 0, passes: 0, failures: 0, conditionals: 0, pass_rate: null },
    };
  }

  const failures = history.filter((item) => item.overallResult === "fail" || item.overallResult === "reinspection_required").length;
  const conditionals = history.filter((item) => item.overallResult === "conditional_pass").length;
  const passes = history.filter((item) => item.overallResult === "pass").length;

  const componentFailures: Record<string, number> = {};
  for (const record of history) {
    const sections = Array.isArray(record.sectionData) ? record.sectionData : [];
    for (const section of sections) {
      const items = Array.isArray(section?.items) ? section.items : [];
      for (const item of items) {
        if (item?.result === "fail") {
          const key = `${section?.title || section?.section || "Inspection"}: ${item?.name || "Unnamed item"}`;
          componentFailures[key] = (componentFailures[key] || 0) + 1;
        }
      }
    }
  }

  const recurringDefects = Object.entries(componentFailures)
    .filter(([, count]) => count >= 2)
    .map(([component, occurrences]) => ({ component, occurrences }))
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 5);

  const failureRate = failures / history.length;
  const conditionalRate = conditionals / history.length;
  const recurrenceFactor = Math.min(0.25, recurringDefects.length * 0.05);
  const riskScore = Math.min(1, failureRate * 0.6 + conditionalRate * 0.3 + recurrenceFactor);

  const status = riskScore >= 0.7 ? "high" : riskScore >= 0.4 ? "elevated" : riskScore >= 0.2 ? "monitor" : "low";
  const recommendedReviewDays = status === "high" ? 30 : status === "elevated" ? 90 : status === "monitor" ? 180 : 365;

  let recommendedAction = "Continue the normal inspection and preventive-maintenance schedule.";
  if (status === "high") {
    recommendedAction = `Prioritize qualified maintenance review within 30 days${recurringDefects[0] ? `; recurring concern: ${recurringDefects[0].component}` : ""}.`;
  } else if (status === "elevated") {
    recommendedAction = `Schedule a maintenance review within 90 days${recurringDefects.length ? ` and monitor ${recurringDefects.slice(0, 2).map((item) => item.component).join(", ")}` : ""}.`;
  } else if (status === "monitor") {
    recommendedAction = "Consider increased inspection frequency and review recurring historical defects.";
  }

  return {
    vehicle_id: vehicle.id,
    registration: vehicle.registrationNumber,
    status,
    risk_score: Math.round(riskScore * 100) / 100,
    recommended_review_days: recommendedReviewDays,
    recommended_action: recommendedAction,
    recurring_defects: recurringDefects,
    historical_stats: {
      total_inspections: history.length,
      passes,
      failures,
      conditionals,
      pass_rate: Math.round((passes / history.length) * 100),
    },
  };
}
