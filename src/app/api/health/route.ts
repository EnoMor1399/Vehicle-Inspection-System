import { pool } from "@/db";
import { expectedApplicationDatabase } from "@/lib/database-contract";
import { RELEASE_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";

const criticalTables = [
  "users",
  "vehicles",
  "inspections",
  "daily_inspections",
  "training_sessions",
  "training_assessments",
] as const;

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

type ReadinessRow = {
  database_name: string;
  missing_tables: string[] | null;
};

export async function GET() {
  const started = performance.now();
  const dbStarted = performance.now();

  try {
    const readiness = await pool.query<ReadinessRow>(
      `SELECT current_database() AS database_name,
              ARRAY(
                SELECT required.table_name
                  FROM unnest($1::text[]) AS required(table_name)
                 WHERE to_regclass(format('public.%I', required.table_name)) IS NULL
              ) AS missing_tables`,
      [criticalTables],
    );

    const dbLatencyMs = Math.round(performance.now() - dbStarted);
    const totalLatencyMs = Math.round(performance.now() - started);
    const row = readiness.rows[0];
    const actualDatabase = row?.database_name || "unknown";
    const expectedDatabase = expectedApplicationDatabase(process.env);
    const missingTables = row?.missing_tables || [];
    const databaseTargetHealthy = !expectedDatabase || actualDatabase === expectedDatabase;
    const schemaHealthy = missingTables.length === 0;
    const unhealthy = !databaseTargetHealthy || !schemaHealthy;
    const degraded = !unhealthy && (dbLatencyMs >= degradedThresholdMs || pool.waitingCount > 0);
    const status = unhealthy ? "unhealthy" : degraded ? "degraded" : "healthy";

    if (!databaseTargetHealthy) {
      console.error(
        `[health] wrong database target: expected=${expectedDatabase} actual=${actualDatabase}`,
      );
    }
    if (!schemaHealthy) {
      console.error(`[health] critical schema objects missing: ${missingTables.join(",")}`);
    }
    if (degraded) {
      console.warn(
        `[health] database degraded: latency=${dbLatencyMs}ms waiting=${pool.waitingCount} total=${pool.totalCount} idle=${pool.idleCount}`,
      );
    }

    return Response.json(
      {
        status,
        timestamp: new Date().toISOString(),
        version: RELEASE_VERSION,
        responseTimeMs: totalLatencyMs,
        checks: {
          database: {
            status: unhealthy ? "unhealthy" : degraded ? "degraded" : "healthy",
            latencyMs: dbLatencyMs,
          },
          databaseTarget: {
            status: databaseTargetHealthy ? "healthy" : "unhealthy",
            enforced: Boolean(expectedDatabase),
          },
          schema: {
            status: schemaHealthy ? "healthy" : "unhealthy",
            criticalTablesChecked: criticalTables.length,
            missingCriticalTables: missingTables.length,
          },
        },
      },
      {
        status: unhealthy ? 503 : 200,
        headers: responseHeaders(dbLatencyMs, totalLatencyMs),
      },
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
          databaseTarget: {
            status: "unknown",
            enforced: Boolean(expectedApplicationDatabase(process.env)),
          },
          schema: {
            status: "unknown",
            criticalTablesChecked: criticalTables.length,
            missingCriticalTables: null,
          },
        },
      },
      {
        status: 503,
        headers: responseHeaders(dbLatencyMs, totalLatencyMs),
      },
    );
  }
}
