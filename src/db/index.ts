import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const poolMax = boundedInteger(
  process.env.DB_POOL_MAX || process.env.DATABASE_POOL_SIZE,
  isServerless ? 5 : 10,
  1,
  20
);
const idleTimeoutMillis = boundedInteger(process.env.DB_POOL_IDLE_TIMEOUT_MS, 10_000, 1_000, 120_000);
const connectionTimeoutMillis = boundedInteger(process.env.DB_POOL_CONNECTION_TIMEOUT_MS, 10_000, 1_000, 30_000);
const statementTimeoutMillis = boundedInteger(process.env.DB_STATEMENT_TIMEOUT_MS, 30_000, 1_000, 120_000);
const queryTimeoutMillis = boundedInteger(
  process.env.DB_QUERY_TIMEOUT_MS,
  Math.min(statementTimeoutMillis + 5_000, 125_000),
  1_000,
  125_000
);

const globalForDb = globalThis as typeof globalThis & {
  __vimsPostgresqlPool?: Pool;
};

function createPool() {
  const nextPool = new Pool({
    connectionString: databaseUrl,
    max: poolMax,
    idleTimeoutMillis,
    connectionTimeoutMillis,
    statement_timeout: statementTimeoutMillis,
    query_timeout: queryTimeoutMillis,
    keepAlive: true,
    allowExitOnIdle: true,
    application_name: "vims-web",
  });

  nextPool.on("error", (error) => {
    // Never log the connection string or credentials. This catches errors on
    // idle pooled clients so they do not become unhandled process errors.
    console.error(`[db] idle client error: ${error.message}`);
  });

  return nextPool;
}

export const pool = globalForDb.__vimsPostgresqlPool ?? createPool();
globalForDb.__vimsPostgresqlPool = pool;

export const db = drizzle(pool);
