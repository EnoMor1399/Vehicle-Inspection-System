import { authenticateApiRequest, json, apiError } from "@/lib/api-auth";
import { db } from "@/db";
import { inspections, vehicles } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiRequest({ scopes: ["read"], permission: "inspections" });
  if (!auth.ok) return apiError(auth.status, auth.message);
  const { id } = await params;
  const [row] = await db
    .select({ inspection: inspections, vehicle: vehicles })
    .from(inspections)
    .innerJoin(vehicles, eq(vehicles.id, inspections.vehicleId))
    .where(eq(inspections.id, id));
  if (!row) return apiError(404, "Inspection not found");
  return json({ data: row });
}
