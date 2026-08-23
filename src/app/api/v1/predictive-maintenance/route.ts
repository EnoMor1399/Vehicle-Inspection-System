import { authenticateApiRequest, json, apiError } from "@/lib/api-auth";
import { db } from "@/db";
import { vehicles, inspections } from "@/db/schema";
import { eq, sql, desc } from "drizzle-orm";

// Predictive maintenance endpoint
// Predicts when a vehicle is likely to fail based on inspection patterns
export async function GET(request: Request) {
  const auth = await authenticateApiRequest({ scopes: ["read"], permission: "reports" });
  if (!auth.ok) return apiError(auth.status, auth.message);

  const url = new URL(request.url);
  const vehicleId = url.searchParams.get("vehicle_id");

  if (!vehicleId) {
    // Fleet-wide predictions
    const allVehicles = await db.select().from(vehicles).limit(100);
    const predictions = [];
    for (const v of allVehicles) {
      const pred = await predictForVehicle(v.id);
      if (pred) predictions.push({ vehicle: v, prediction: pred });
    }
    predictions.sort((a, b) => (a.prediction.days_to_failure ?? 99999) - (b.prediction.days_to_failure ?? 99999));
    return json({ data: predictions.slice(0, 20) });
  }

  const prediction = await predictForVehicle(vehicleId);
  return json({ data: prediction });
}

async function predictForVehicle(vehicleId: string) {
  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, vehicleId));
  if (!vehicle) return null;

  const history = await db
    .select({
      inspectionDate: inspections.inspectionDate,
      overallResult: inspections.overallResult,
      sectionData: inspections.sectionData,
    })
    .from(inspections)
    .where(eq(inspections.vehicleId, vehicleId))
    .orderBy(desc(inspections.inspectionDate))
    .limit(12);

  if (history.length === 0) {
    return {
      vehicle_id: vehicleId,
      registration: vehicle.registrationNumber,
      status: "unknown",
      risk_score: 0.5,
      days_to_failure: null,
      recommended_action: "Insufficient data. Schedule baseline inspection.",
      at_risk_components: [],
    };
  }

  // Calculate failure rate over time
  const failures = history.filter((h) => h.overallResult === "fail").length;
  const conditionals = history.filter((h) => h.overallResult === "conditional_pass").length;
  const passes = history.filter((h) => h.overallResult === "pass").length;

  // Identify recurring defect components
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

  const atRiskComponents = Object.entries(componentFailures)
    .filter(([, count]) => count >= 2)
    .map(([component, count]) => ({ component, occurrences: count }))
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 5);

  // Calculate risk score (0-1)
  const failureRate = failures / history.length;
  const conditionalRate = conditionals / history.length;
  const riskScore = Math.min(0.99, failureRate * 0.6 + conditionalRate * 0.3 + (atRiskComponents.length * 0.05));

  // Estimate days to failure based on odometer usage pattern
  const odometer = vehicle.odometerReading || 0;
  const mfgYear = vehicle.manufacturingYear || new Date().getFullYear() - 5;
  const age = new Date().getFullYear() - mfgYear;
  const ageFactor = Math.min(1.5, 1 + age * 0.05);

  // Base prediction: higher risk = sooner failure
  const baseDays = 365;
  const daysToFailure = riskScore > 0.7
    ? Math.round(baseDays * (1 - riskScore) * ageFactor)
    : riskScore > 0.4
    ? Math.round(baseDays * (1 - riskScore * 0.8))
    : null;

  // Determine status
  const status =
    riskScore > 0.7
      ? "critical"
      : riskScore > 0.4
      ? "warning"
      : riskScore > 0.2
      ? "monitor"
      : "healthy";

  // Recommended action
  let recommendedAction = "Continue regular inspection schedule";
  if (status === "critical") {
    recommendedAction = `Schedule preventive maintenance within 30 days. At-risk: ${
      atRiskComponents[0]?.component || "critical systems"
    }`;
  } else if (status === "warning") {
    recommendedAction = `Schedule preventive maintenance within 90 days. Monitor: ${
      atRiskComponents.slice(0, 2).map((c) => c.component).join(", ") || "vehicle systems"
    }`;
  } else if (status === "monitor") {
    recommendedAction = "Increase inspection frequency. Minor issues detected historically.";
  }

  return {
    vehicle_id: vehicleId,
    registration: vehicle.registrationNumber,
    status,
    risk_score: Math.round(riskScore * 100) / 100,
    days_to_failure: daysToFailure,
    recommended_action: recommendedAction,
    at_risk_components: atRiskComponents,
    historical_stats: {
      total_inspections: history.length,
      passes,
      failures,
      conditionals,
      pass_rate: Math.round((passes / history.length) * 100),
    },
    odometer,
    age_years: age,
  };
}
