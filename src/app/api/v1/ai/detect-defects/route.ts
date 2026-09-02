import { z } from "zod";
import { authenticateApiRequest, json, apiError } from "@/lib/api-auth";
import { db } from "@/db";
import { inspections, vehicles } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { API_AI_JSON_BODY_LIMIT, readJsonBody } from "@/lib/request-body";

const requestSchema = z.object({
  vehicle_id: z.string().uuid(),
  section: z.string().max(20).optional().default(""),
  // Image data is accepted only for compatibility signaling. VIMS does not
  // currently run computer vision, so keep this bounded to avoid receiving
  // large evidence blobs that the endpoint cannot analyze.
  image_data: z.string().max(750_000).optional(),
}).strict();

// Compatibility endpoint: provides historical defect-risk signals only.
// No computer-vision model is bundled with VIMS and the service never invents
// image findings when no configured vision provider exists.
export async function POST(request: Request) {
  const auth = await authenticateApiRequest({ scopes: ["inspect"], permission: "inspections" });
  if (!auth.ok) return apiError(auth.status, auth.message);

  try {
    const bodyResult = await readJsonBody(request, API_AI_JSON_BODY_LIMIT);
    if (!bodyResult.ok) return apiError(bodyResult.status, bodyResult.message);

    const parsed = requestSchema.safeParse(bodyResult.value);
    if (!parsed.success) return apiError(400, "Invalid risk-analysis request");
    const analysis = await analyzeHistoricalDefectRisk(parsed.data.vehicle_id, parsed.data.section);
    return json({
      data: {
        ...analysis,
        image_analysis: null,
        image_analysis_status: parsed.data.image_data ? "not_configured" : "not_requested",
      },
      model: "historical-defect-risk-v2",
      methodology: "deterministic_historical_heuristic",
      processed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Historical defect-risk analysis failed:", error instanceof Error ? error.message : "unknown error");
    return apiError(500, "Risk analysis failed");
  }
}

export async function GET(request: Request) {
  const auth = await authenticateApiRequest({ scopes: ["read"], permission: "inspections" });
  if (!auth.ok) return apiError(auth.status, auth.message);

  const url = new URL(request.url);
  const vehicleId = url.searchParams.get("vehicle_id") || "";
  const section = url.searchParams.get("section") || "";
  const parsedVehicleId = z.string().uuid().safeParse(vehicleId);
  if (!parsedVehicleId.success) return apiError(400, "vehicle_id must be a valid UUID");
  if (section.length > 20) return apiError(400, "section is invalid");

  try {
    const analysis = await analyzeHistoricalDefectRisk(parsedVehicleId.data, section);
    return json({
      data: { ...analysis, image_analysis: null, image_analysis_status: "not_requested" },
      model: "historical-defect-risk-v2",
      methodology: "deterministic_historical_heuristic",
    });
  } catch (error) {
    console.error("Historical defect-risk lookup failed:", error instanceof Error ? error.message : "unknown error");
    return apiError(500, "Risk analysis failed");
  }
}

async function analyzeHistoricalDefectRisk(vehicleId: string, section: string) {
  const [vehicle] = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.id, vehicleId));
  if (!vehicle) throw new Error("Vehicle not found");

  const history = await db
    .select({
      inspectionNumber: inspections.inspectionNumber,
      inspectionDate: inspections.inspectionDate,
      overallResult: inspections.overallResult,
      sectionData: inspections.sectionData,
    })
    .from(inspections)
    .where(eq(inspections.vehicleId, vehicleId))
    .orderBy(desc(inspections.inspectionDate))
    .limit(20);

  const defectCounts: Record<string, number> = {};
  const severityCounts: Record<string, { minor: number; major: number; critical: number }> = {};

  for (const inspection of history) {
    for (const sectionData of inspection.sectionData || []) {
      for (const item of sectionData.items || []) {
        if (item.result !== "fail") continue;
        const key = `${sectionData.section}:${item.name}`;
        defectCounts[key] = (defectCounts[key] || 0) + 1;
        severityCounts[key] ||= { minor: 0, major: 0, critical: 0 };
        const severity = item.severity || "minor";
        if (severity === "minor" || severity === "major" || severity === "critical") {
          severityCounts[key][severity] += 1;
        }
      }
    }
  }

  const predictions = Object.entries(defectCounts)
    .filter(([key]) => !section || key.startsWith(`${section}:`))
    .map(([key, occurrences]) => {
      const separator = key.indexOf(":");
      const sec = key.slice(0, separator);
      const item = key.slice(separator + 1);
      const severities = severityCounts[key];
      const total = severities.minor + severities.major + severities.critical;
      const frequency = occurrences / Math.max(1, history.length);
      const severityWeight = (
        severities.critical * 1 + severities.major * 0.6 + severities.minor * 0.25
      ) / Math.max(1, total);
      const risk = Math.min(1, frequency * 0.75 + severityWeight * 0.25);
      const typicalSeverity = severities.critical >= severities.major && severities.critical >= severities.minor
        ? "critical"
        : severities.major >= severities.minor
          ? "major"
          : "minor";
      return {
        section: sec,
        item,
        historical_risk: Math.round(risk * 100) / 100,
        historical_occurrences: occurrences,
        typical_severity: typicalSeverity,
        sample_size: history.length,
      };
    })
    .sort((a, b) => b.historical_risk - a.historical_risk)
    .slice(0, 10);

  return {
    signals: predictions,
    risk_score: predictions[0]?.historical_risk || 0,
    sample_size: history.length,
    recommendation: predictions.length
      ? `Prioritize review of historically recurring items: ${predictions.slice(0, 3).map((item) => item.item).join(", ")}.`
      : "No recurring historical defect pattern is available. Use the standard inspection checklist.",
    disclaimer: "Historical risk signals are decision support only and do not replace a physical vehicle inspection.",
  };
}
