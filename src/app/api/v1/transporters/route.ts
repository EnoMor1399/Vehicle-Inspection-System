import { authenticateApiRequest, json, apiError } from "@/lib/api-auth";
import { db } from "@/db";
import { transporters } from "@/db/schema";
import { desc, sql, isNull, and } from "drizzle-orm";

export async function GET(request: Request) {
  const auth = await authenticateApiRequest({ scopes: ["read"], permission: "transporters" });
  if (!auth.ok) return apiError(auth.status, auth.message);

  const url = new URL(request.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 50)));
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));
  const region = url.searchParams.get("region");

  const where = [isNull(transporters.deletedAt)];
  if (region) where.push(sql`${transporters.region} = ${region}`);

  const rows = await db
    .select()
    .from(transporters)
    .where(and(...where))
    .orderBy(desc(transporters.createdAt))
    .limit(limit)
    .offset(offset);

  const [countRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(transporters)
    .where(and(...where));

  return json({
    data: rows,
    pagination: { limit, offset, total: countRow?.n || 0 },
  });
}
