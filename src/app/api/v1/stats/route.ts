import { authenticateApiRequest, json, apiError } from "@/lib/api-auth";
import { computeDashboardStats } from "@/lib/analytics";

export async function GET() {
  const auth = await authenticateApiRequest({ scopes: ["read"], permission: "reports" });
  if (!auth.ok) return apiError(auth.status, auth.message);
  const stats = await computeDashboardStats();
  return json({ data: stats, generatedAt: new Date().toISOString() });
}
