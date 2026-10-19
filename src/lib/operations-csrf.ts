import type { NextRequest } from "next/server";

// Exact browser same-origin checks for privileged POST endpoints. Fetch Metadata
// alone cannot supply an origin on a cross-site submission.
export function trustedOperationsOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  if (!origin) return site === "same-origin";
  try {
    const submitted = new URL(origin);
    if (!["http:", "https:"].includes(submitted.protocol)
      || submitted.username || submitted.password
      || submitted.pathname !== "/" || submitted.search || submitted.hash) return false;
    if (submitted.origin === request.nextUrl.origin) return true;
    const host = request.headers.get("host");
    return Boolean(host && submitted.host.toLowerCase() === host.toLowerCase()
      && submitted.protocol === request.nextUrl.protocol);
  } catch { return false; }
}
