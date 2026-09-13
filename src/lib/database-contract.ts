export const CANONICAL_APPLICATION_DATABASE = "Vehicle-Inspection-Enterprise";

type Environment = Record<string, string | undefined>;

export function databaseNameFromConnectionString(value: string) {
  try {
    const url = new URL(value);
    const databaseName = decodeURIComponent(url.pathname.replace(/^\/+/, "")).trim();
    return databaseName || null;
  } catch {
    return null;
  }
}

export function expectedApplicationDatabase(env: Environment = process.env) {
  const configured = env.EXPECTED_DATABASE_NAME?.trim();
  if (configured) return configured;

  // Vercel production must never silently fall back to Neon's default `neondb`
  // because VIMS application data lives in the dedicated enterprise database.
  if (env.VERCEL_ENV?.trim().toLowerCase() === "production") {
    return CANONICAL_APPLICATION_DATABASE;
  }

  // Non-Vercel deployments can opt into the same guard explicitly.
  if (env.VIMS_ENFORCE_DATABASE_TARGET?.trim().toLowerCase() === "true") {
    return CANONICAL_APPLICATION_DATABASE;
  }

  return null;
}

export function assertExpectedApplicationDatabase(
  connectionString: string,
  env: Environment = process.env,
) {
  const expected = expectedApplicationDatabase(env);
  if (!expected) return;

  const actual = databaseNameFromConnectionString(connectionString);
  // Preserve pg's authoritative connection-string error when the URL itself is
  // invalid, but refuse a valid URL that clearly targets the wrong database.
  if (actual && actual !== expected) {
    throw new Error(
      `DATABASE_URL must target the canonical VIMS application database "${expected}".`,
    );
  }
}
