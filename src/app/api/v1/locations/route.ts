import { authenticateApiRequest, json, apiError } from "@/lib/api-auth";
import { db } from "@/db";
import { locations } from "@/db/schema";
import { asc, eq } from "drizzle-orm";

export async function GET() {
  const auth = await authenticateApiRequest({ scopes: ["read"], permission: "locations" });
  if (!auth.ok) return apiError(auth.status, auth.message);
  const rows = await db
    .select()
    .from(locations)
    .where(eq(locations.organizationId, auth.user.organizationId))
    .orderBy(asc(locations.name));
  return json({ data: rows });
}
