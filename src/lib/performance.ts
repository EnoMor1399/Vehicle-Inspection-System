const DEFAULT_SLOW_OPERATION_MS = 750;

function boundedThreshold(value: string | undefined): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_SLOW_OPERATION_MS;
  return Math.min(30_000, Math.max(50, parsed));
}

const slowOperationMs = boundedThreshold(process.env.API_SLOW_QUERY_MS);

export type TimedOperation<T> = {
  value: T;
  durationMs: number;
};

function safeMetricName(value: string): string {
  const cleaned = value.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_");
  return cleaned.replace(/^_+|_+$/g, "").slice(0, 40) || "operation";
}

export async function timeOperation<T>(label: string, operation: () => Promise<T>): Promise<TimedOperation<T>> {
  const started = performance.now();
  try {
    const value = await operation();
    const durationMs = performance.now() - started;
    if (durationMs >= slowOperationMs) {
      console.warn(`[performance] slow operation ${safeMetricName(label)}: ${Math.round(durationMs)}ms`);
    }
    return { value, durationMs };
  } catch (error) {
    const durationMs = performance.now() - started;
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(`[performance] operation ${safeMetricName(label)} failed after ${Math.round(durationMs)}ms: ${message}`);
    throw error;
  }
}

export function formatServerTiming(
  entries: Array<{ name: string; durationMs: number }>,
  totalDurationMs?: number
): string {
  const metrics = entries.map(({ name, durationMs }) =>
    `${safeMetricName(name)};dur=${Math.max(0, Math.round(durationMs * 10) / 10)}`
  );

  if (typeof totalDurationMs === "number" && Number.isFinite(totalDurationMs)) {
    metrics.push(`total;dur=${Math.max(0, Math.round(totalDurationMs * 10) / 10)}`);
  }

  return metrics.join(", ");
}
