import { readFileSync } from "node:fs";

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

const rawBaseUrl = process.env.VIMS_BASE_URL || process.argv[2];
const expectedVersion = process.env.EXPECTED_VERSION || packageJson.version;
const allowInsecureHttp = process.env.ALLOW_INSECURE_HTTP === "1";

if (!rawBaseUrl) {
  throw new Error("VIMS_BASE_URL or the first command-line argument is required");
}

const baseUrl = new URL(rawBaseUrl);
if (baseUrl.username || baseUrl.password) {
  throw new Error("VIMS_BASE_URL must not contain credentials");
}

const localHostnames = new Set(["localhost", "127.0.0.1", "::1"]);
if (
  baseUrl.protocol !== "https:" &&
  !(allowInsecureHttp || localHostnames.has(baseUrl.hostname))
) {
  throw new Error("Production verification requires HTTPS; set ALLOW_INSECURE_HTTP=1 only for an intentional non-production target");
}

async function check(pathname, expectedStatus) {
  const url = new URL(pathname, baseUrl);
  const response = await fetch(url, {
    method: "GET",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
    headers: { Accept: "application/json" },
  });

  const body = await response.json().catch(() => null);
  const reportedVersion = response.headers.get("x-vims-version") || body?.version;
  const cacheControl = response.headers.get("cache-control") || "";

  if (!response.ok) {
    throw new Error(`${pathname} returned HTTP ${response.status}`);
  }
  if (body?.status !== expectedStatus) {
    throw new Error(`${pathname} reported status ${JSON.stringify(body?.status)} instead of ${expectedStatus}`);
  }
  if (reportedVersion !== expectedVersion) {
    throw new Error(`${pathname} reported version ${JSON.stringify(reportedVersion)} instead of ${expectedVersion}`);
  }
  if (!/no-store/i.test(cacheControl)) {
    throw new Error(`${pathname} must return Cache-Control: no-store`);
  }

  return {
    path: pathname,
    status: body.status,
    version: reportedVersion,
    responseTimeMs: body.responseTimeMs ?? null,
  };
}

const live = await check("/api/health/live", "alive");
const ready = await check("/api/health", "healthy");

console.log(
  JSON.stringify(
    {
      target: baseUrl.origin,
      expectedVersion,
      live,
      ready,
      result: "passed",
    },
    null,
    2,
  ),
);
