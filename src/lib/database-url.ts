type DatabaseUrlOptions = {
  preferNeonPooler?: boolean;
};

function normalizeSslMode(url: URL) {
  // node-postgres currently treats sslmode=require as certificate verification.
  // Make that behavior explicit so a future pg major version cannot silently
  // weaken transport verification semantics.
  if (url.searchParams.get("sslmode")?.toLowerCase() === "require") {
    url.searchParams.set("sslmode", "verify-full");
  }
}

function routeNeonThroughPooler(url: URL) {
  const hostname = url.hostname.toLowerCase();
  if (!hostname.endsWith(".neon.tech")) return;

  const labels = hostname.split(".");
  const endpoint = labels[0];
  if (!endpoint?.startsWith("ep-") || endpoint.endsWith("-pooler")) return;

  labels[0] = `${endpoint}-pooler`;
  url.hostname = labels.join(".");
}

export function normalizePostgresConnectionString(
  value: string,
  options: DatabaseUrlOptions = {}
) {
  try {
    const url = new URL(value);
    normalizeSslMode(url);

    if (options.preferNeonPooler) {
      routeNeonThroughPooler(url);
    }

    return url.toString();
  } catch {
    // Preserve the original value so pg can emit the authoritative connection
    // error rather than hiding it behind URL normalization.
    return value;
  }
}
