import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

type Policy = "login" | "signup" | "twoFactor" | "api" | "verify" | "error";
type Window = `${number} ${"s" | "m" | "h" | "d"}`;

export type LimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
  backend: "upstash" | "memory";
};

export type MemoryRateEntry = { count: number; reset: number };

type MemoryPolicyConfig = { limit: number; windowMs: number };

function positiveInt(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), max) : fallback;
}

const apiLimit = positiveInt(process.env.RATE_LIMIT_MAX_REQUESTS, 100, 100_000);
const apiWindowMs = positiveInt(process.env.RATE_LIMIT_WINDOW_MS, 60_000, 86_400_000);
const apiWindow: Window = `${Math.max(1, Math.ceil(apiWindowMs / 1000))} s`;
const memoryEntryLimit = positiveInt(process.env.RATE_LIMIT_MEMORY_MAX_ENTRIES, 5_000, 50_000);

const policyConfig: Record<Policy, { limit: number; windowMs: number; window: Window }> = {
  login: { limit: 10, windowMs: 15 * 60_000, window: "15 m" },
  signup: { limit: 5, windowMs: 60 * 60_000, window: "1 h" },
  twoFactor: { limit: 5, windowMs: 5 * 60_000, window: "5 m" },
  api: { limit: apiLimit, windowMs: apiWindowMs, window: apiWindow },
  verify: { limit: 60, windowMs: 60_000, window: "1 m" },
  error: { limit: 20, windowMs: 60_000, window: "1 m" },
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

const memory = new Map<string, MemoryRateEntry>();
let lastDistributedWarningAt = 0;

function pruneMemoryStore(store: Map<string, MemoryRateEntry>, now: number, maxEntries: number, incomingKey: string) {
  for (const [key, value] of store) {
    if (value.reset <= now) store.delete(key);
  }

  if (store.has(incomingKey)) return;
  while (store.size >= maxEntries) {
    const oldestKey = store.keys().next().value as string | undefined;
    if (!oldestKey) break;
    store.delete(oldestKey);
  }
}

export function applyMemoryRateLimit(
  store: Map<string, MemoryRateEntry>,
  policy: string,
  identifier: string,
  config: MemoryPolicyConfig,
  now = Date.now(),
  maxEntries = 5_000
): LimitResult {
  const safeMaxEntries = Math.max(1, Math.floor(maxEntries));
  const key = `${policy}:${identifier}`;
  pruneMemoryStore(store, now, safeMaxEntries, key);

  let row = store.get(key);
  if (!row || row.reset <= now) row = { count: 0, reset: now + config.windowMs };
  row.count += 1;

  // Refresh insertion order so eviction behaves like a bounded LRU fallback.
  store.delete(key);
  store.set(key, row);

  return {
    allowed: row.count <= config.limit,
    limit: config.limit,
    remaining: Math.max(0, config.limit - row.count),
    reset: row.reset,
    backend: "memory",
  };
}

function warnDistributedFallback() {
  const now = Date.now();
  if (now - lastDistributedWarningAt < 60_000) return;
  lastDistributedWarningAt = now;
  console.warn("[rate-limit] distributed limiter unavailable; using bounded in-memory fallback");
}

export async function rateLimit(policy: Policy, identifier: string): Promise<LimitResult> {
  const config = policyConfig[policy];
  const limiter = distributed[policy];

  if (limiter) {
    try {
      const result = await limiter.limit(identifier);
      return {
        allowed: result.success,
        limit: result.limit,
        remaining: result.remaining,
        reset: result.reset,
        backend: "upstash",
      };
    } catch {
      // Availability must not depend on Redis being reachable. The fallback is
      // deliberately bounded and local to the current server process.
      warnDistributedFallback();
    }
  }

  return applyMemoryRateLimit(memory, policy, identifier, config, Date.now(), memoryEntryLimit);
}
