import { authenticateApiRequest, json, apiError } from "@/lib/api-auth";
import { db } from "@/db";
import { transporters } from "@/db/schema";
import { desc, sql, isNull, and } from "drizzle-orm";
import { parseApiPagination } from "@/lib/api-pagination";
import { formatServerTiming, timeOperation } from "@/lib/performance";

export async function GET(request: Request) {
  const auth = await authenticateApiRequest({ scopes: ["read"], permission: "transporters" });
  if (!auth.ok) return apiError(auth.status, auth.message);

  const url = new URL(request.url);
  const pagination = parseApiPagination(url.searchParams);
  if (!pagination.ok) return apiError(400, pagination.message);
  const { limit, offset } = pagination;

  const region = url.searchParams.get("region")?.trim() || null;
  if (region && region.length > 100) return apiError(400, "region is too long");

  const where = [isNull(transporters.deletedAt)];
  if (region) where.push(sql`${transporters.region} = ${region}`);
  const predicate = and(...where);

  const started = performance.now();
  const [rowsQuery, countQuery] = await Promise.all([
    timeOperation("transporters_list", async () => db
      .select()
      .from(transporters)
      .where(predicate)
      .orderBy(desc(transporters.createdAt))
      .limit(limit)
      .offset(offset)),
    timeOperation("transporters_count", async () => db
      .select({ n: sql<number>`count(*)::int` })
      .from(transporters)
      .where(predicate)),
  ]);
  const totalDurationMs = performance.now() - started;
  const [countRow] = countQuery.value;

  return json({
    data: rowsQuery.value,
    pagination: { limit, offset, total: countRow?.n || 0 },
  }, 200, {
    "Server-Timing": formatServerTiming([
      { name: "transporters_list", durationMs: rowsQuery.durationMs },
      { name: "transporters_count", durationMs: countQuery.durationMs },
    ], totalDurationMs),
  });
}
