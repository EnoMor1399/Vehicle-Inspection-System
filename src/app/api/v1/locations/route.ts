import { authenticateApiRequest, json, apiError } from "@/lib/api-auth";
import { db } from "@/db";
import { locations } from "@/db/schema";
import { asc } from "drizzle-orm";

export async function GET() {
  const auth = await authenticateApiRequest({ scopes: ["read"], permission: "locations" });
  if (!auth.ok) return apiError(auth.status, auth.message);
  const rows = await db.select().from(locations).orderBy(asc(locations.name));
  return json({ data: rows });
}
