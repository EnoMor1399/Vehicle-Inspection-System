import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

type Policy = "login" | "twoFactor" | "api" | "verify";
type Window = `${number} ${"s" | "m" | "h" | "d"}`;

type LimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
  backend: "upstash" | "memory";
};

function positiveInt(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), max) : fallback;
}

const apiLimit = positiveInt(process.env.RATE_LIMIT_MAX_REQUESTS, 100, 100_000);
const apiWindowMs = positiveInt(process.env.RATE_LIMIT_WINDOW_MS, 60_000, 86_400_000);
const apiWindow: Window = `${Math.max(1, Math.ceil(apiWindowMs / 1000))} s`;

const policyConfig: Record<Policy, { limit: number; windowMs: number; window: Window }> = {
  login: { limit: 10, windowMs: 15 * 60_000, window: "15 m" },
  twoFactor: { limit: 5, windowMs: 5 * 60_000, window: "5 m" },
  api: { limit: apiLimit, windowMs: apiWindowMs, window: apiWindow },
  verify: { limit: 60, windowMs: 60_000, window: "1 m" },
};

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token, enableTelemetry: false }) : null;

const distributed: Partial<Record<Policy, Ratelimit>> = redis
  ? Object.fromEntries(
      (Object.keys(policyConfig) as Policy[]).map((policy) => [
        policy,
        new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(policyConfig[policy].limit, policyConfig[policy].window),
          prefix: `vims:ratelimit:${policy}`,
          analytics: false,
        }),
      ])
    )
  : {};

const memory = new Map<string, { count: number; reset: number }>();

export async function rateLimit(policy: Policy, identifier: string): Promise<LimitResult> {
  const config = policyConfig[policy];
  const limiter = distributed[policy];
  if (limiter) {
    const result = await limiter.limit(identifier);
    return {
      allowed: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
      backend: "upstash",
    };
  }

  const now = Date.now();
  const key = `${policy}:${identifier}`;
  let row = memory.get(key);
  if (!row || row.reset <= now) row = { count: 0, reset: now + config.windowMs };
  row.count += 1;
  memory.set(key, row);

  if (memory.size > 5000) {
    for (const [k, v] of memory) if (v.reset <= now) memory.delete(k);
  }

  return {
    allowed: row.count <= config.limit,
    limit: config.limit,
    remaining: Math.max(0, config.limit - row.count),
    reset: row.reset,
    backend: "memory",
  };
}
