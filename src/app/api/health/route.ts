import { db, pool } from "@/db";
import { RELEASE_VERSION } from "@/lib/version";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

const degradedThresholdMs = (() => {
  const parsed = Number.parseInt(process.env.HEALTH_DB_DEGRADED_MS || "750", 10);
  if (!Number.isFinite(parsed)) return 750;
  return Math.min(10_000, Math.max(100, parsed));
})();

function responseHeaders(dbLatencyMs: number, totalLatencyMs: number) {
  return {
    "Cache-Control": "no-store",
    "Server-Timing": `db;dur=${dbLatencyMs}, total;dur=${totalLatencyMs}`,
    "X-VIMS-Version": RELEASE_VERSION,
  };
}

export async function GET() {
  const started = performance.now();
  const dbStarted = performance.now();

  try {
    await db.execute(sql`select 1`);
    const dbLatencyMs = Math.round(performance.now() - dbStarted);
    const totalLatencyMs = Math.round(performance.now() - started);
    const degraded = dbLatencyMs >= degradedThresholdMs || pool.waitingCount > 0;

    if (degraded) {
      console.warn(
        `[health] database degraded: latency=${dbLatencyMs}ms waiting=${pool.waitingCount} total=${pool.totalCount} idle=${pool.idleCount}`
      );
    }

    return Response.json(
      {
        status: degraded ? "degraded" : "healthy",
        timestamp: new Date().toISOString(),
        version: RELEASE_VERSION,
        responseTimeMs: totalLatencyMs,
        checks: {
          database: {
            status: degraded ? "degraded" : "healthy",
            latencyMs: dbLatencyMs,
          },
        },
      },
      {
        status: 200,
        headers: responseHeaders(dbLatencyMs, totalLatencyMs),
      }
    );
  } catch (error) {
    const dbLatencyMs = Math.round(performance.now() - dbStarted);
    const totalLatencyMs = Math.round(performance.now() - started);
    const message = error instanceof Error ? error.message : "Unknown database error";
    console.error(`[health] database unavailable after ${dbLatencyMs}ms: ${message}`);

    return Response.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        version: RELEASE_VERSION,
        responseTimeMs: totalLatencyMs,
        checks: {
          database: {
            status: "unhealthy",
            latencyMs: dbLatencyMs,
          },
        },
      },
      {
        status: 503,
        headers: responseHeaders(dbLatencyMs, totalLatencyMs),
      }
    );
  }
}
