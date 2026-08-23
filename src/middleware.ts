import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

async function apiRateIdentity(request: NextRequest, ip: string): Promise<string> {
  const authorization = request.headers.get("authorization") || "";
  const rawKey = request.headers.get("x-api-key") || authorization.replace(/^Bearer\s+/i, "").trim();
  if (!rawKey) return `ip:${ip}`;

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawKey));
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `credential:${hex.slice(0, 32)}`;
}

function allowedOrigins(request: NextRequest): Set<string> {
  const configured = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  configured.push(request.nextUrl.origin);
  return new Set(configured);
}

function applyRateHeaders(response: NextResponse, result: Awaited<ReturnType<typeof rateLimit>>) {
  response.headers.set("X-RateLimit-Limit", String(result.limit));
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  response.headers.set("X-RateLimit-Reset", String(result.reset));
}

function rateLimited(result: Awaited<ReturnType<typeof rateLimit>>) {
  const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
  return NextResponse.json(
    { error: "Rate limit exceeded. Please try again later.", retryAfter },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(result.reset),
      },
    }
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = clientIp(request);
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
  let appliedRateLimit: Awaited<ReturnType<typeof rateLimit>> | null = null;

  if (pathname.startsWith("/api/v1/")) {
    const identity = await apiRateIdentity(request, ip);
    const result = await rateLimit("api", identity);
    appliedRateLimit = result;
    if (!result.allowed) return rateLimited(result);

    const mutating = !["GET", "HEAD", "OPTIONS"].includes(request.method);
    if (mutating) {
      const origin = request.headers.get("origin");
      if (origin && !allowedOrigins(request).has(origin)) {
        return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
      }

      const contentLength = Number(request.headers.get("content-length") || 0);
      if (Number.isFinite(contentLength) && contentLength > 10 * 1024 * 1024) {
        return NextResponse.json({ error: "Request body exceeds 10 MB limit" }, { status: 413 });
      }
    }
  }

  if (pathname.startsWith("/verify/")) {
    const result = await rateLimit("verify", `ip:${ip}`);
    appliedRateLimit = result;
    if (!result.allowed) return rateLimited(result);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("X-Request-ID", requestId);
  response.headers.set("Cache-Control", pathname.startsWith("/verify/") ? "private, max-age=60" : "no-store");
  if (appliedRateLimit) applyRateHeaders(response, appliedRateLimit);
  return response;
}

export const config = {
  matcher: ["/api/v1/:path*", "/verify/:path*"],
};
