import { authenticateApiRequest, json, apiError } from "@/lib/api-auth";
import { db } from "@/db";
import { inspections, vehicles } from "@/db/schema";
import { eq, sql, desc } from "drizzle-orm";

// AI-powered defect detection endpoint
// Analyzes inspection history to predict likely defects
export async function POST(request: Request) {
  const auth = await authenticateApiRequest({ scopes: ["inspect"], permission: "inspections" });
  if (!auth.ok) return apiError(auth.status, auth.message);

  try {
    const body = await request.json();
    const { vehicle_id, image_data, section } = body;

    // Mock AI analysis (in production: call OpenAI / Google Vision / AWS Rekognition)
    const analysis = await analyzeDefects(vehicle_id, section, image_data);
    return json({
      data: analysis,
      model: "rsl-defect-v1",
      processed_at: new Date().toISOString(),
    });
  } catch (err: any) {
    return apiError(500, err.message || "AI analysis failed");
  }
}

async function analyzeDefects(vehicleId: string, section: string, imageData?: string) {
  // Fetch inspection history for pattern detection
  const history = vehicleId
    ? await db
        .select({
          inspectionNumber: inspections.inspectionNumber,
          inspectionDate: inspections.inspectionDate,
          overallResult: inspections.overallResult,
          sectionData: inspections.sectionData,
        })
        .from(inspections)
        .where(eq(inspections.vehicleId, vehicleId))
        .orderBy(desc(inspections.inspectionDate))
        .limit(20)
    : [];

  // Aggregate defect patterns
  const defectCounts: Record<string, number> = {};
  const severityCounts: Record<string, { minor: number; major: number; critical: number }> = {};

  for (const insp of history) {
    const sections = (insp.sectionData || []) as any[];
    for (const s of sections) {
      for (const item of s.items || []) {
        if (item.result === "fail") {
          const key = `${s.section}:${item.name}`;
          defectCounts[key] = (defectCounts[key] || 0) + 1;
          if (!severityCounts[key]) severityCounts[key] = { minor: 0, major: 0, critical: 0 };
          const sev = item.severity || "minor";
          if (sev === "minor" || sev === "major" || sev === "critical") {
            (severityCounts[key] as Record<string, number>)[sev]++;
          }
        }
      }
    }
  }

  // Predict likely defects for the given section
  const predictions = Object.entries(defectCounts)
    .filter(([key]) => !section || key.startsWith(section + ":"))
    .map(([key, count]) => {
      const [sec, name] = key.split(":");
      const sevs = severityCounts[key];
      const total = sevs.minor + sevs.major + sevs.critical;
      // Probability score based on frequency and severity
      const probability = Math.min(
        0.95,
        (count / Math.max(1, history.length)) * 0.6 +
          (sevs.critical / Math.max(1, total)) * 0.3 +
          (sevs.major / Math.max(1, total)) * 0.1
      );
      return {
        section: sec,
        item: name,
        probability: Math.round(probability * 100) / 100,
        historical_occurrences: count,
        typical_severity:
          sevs.critical >= sevs.major && sevs.critical >= sevs.minor
            ? "critical"
            : sevs.major >= sevs.minor
            ? "major"
            : "minor",
        confidence: Math.min(0.99, 0.5 + count * 0.05),
      };
    })
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 10);

  // Mock image analysis (if image provided)
  let imageAnalysis = null;
  if (imageData) {
    imageAnalysis = {
      defects_detected: [
        {
          label: "Surface corrosion",
          confidence: 0.82,
          bounding_box: { x: 120, y: 80, w: 200, h: 140 },
          severity: "major",
        },
        {
          label: "Paint damage",
          confidence: 0.71,
          bounding_box: { x: 280, y: 180, w: 90, h: 60 },
          severity: "minor",
        },
      ],
      overall_condition: "fair",
      recommendation: "Schedule body shop inspection for rust treatment",
    };
  }

  return {
    predictions,
    image_analysis: imageAnalysis,
    risk_score: predictions.length > 0 ? predictions[0].probability : 0,
    recommendation:
      predictions.length > 0
        ? `Focus inspection on: ${predictions
            .slice(0, 3)
            .map((p) => p.item)
            .join(", ")}`
        : "No historical patterns detected. Proceed with standard checklist.",
  };
}

// GET: Get defect predictions for a vehicle
export async function GET(request: Request) {
  const auth = await authenticateApiRequest({ scopes: ["read"], permission: "inspections" });
  if (!auth.ok) return apiError(auth.status, auth.message);

  const url = new URL(request.url);
  const vehicleId = url.searchParams.get("vehicle_id");
  const section = url.searchParams.get("section") || "";

  if (!vehicleId) return apiError(400, "vehicle_id required");

  const analysis = await analyzeDefects(vehicleId, section);
  return json({ data: analysis });
}
