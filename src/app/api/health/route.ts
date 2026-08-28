import { db } from "@/db";
import { RELEASE_VERSION } from "@/lib/version";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  try {
    await db.execute(sql`select 1`);
    return Response.json(
      {
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: RELEASE_VERSION,
        responseTimeMs: Date.now() - started,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return Response.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        responseTimeMs: Date.now() - started,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
