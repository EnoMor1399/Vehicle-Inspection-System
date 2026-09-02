import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { buildContentSecurityPolicy } from "@/lib/csp";
import { clientIpFromHeaders, normalizeRequestId } from "@/lib/request-context";
import {
  API_AI_JSON_BODY_LIMIT,
  API_INSPECTION_JSON_BODY_LIMIT,
  API_SMALL_JSON_BODY_LIMIT,
} from "@/lib/request-body";

async function apiRateIdentity(request: NextRequest, ip: string): Promise<string> {
  const authorization = request.headers.get("authorization") || "";
  const rawKey = request.headers.get("x-api-key") || authorization.replace(/^Bearer\s+/i, "").trim();
  if (!rawKey || rawKey.length > 512) return `ip:${ip}`;

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawKey));
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `credential:${hex.slice(0, 32)}`;
}

function normalizeOrigin(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function allowedOrigins(request: NextRequest): Set<string> {
  const configured = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => normalizeOrigin(value.trim()))
    .filter((value): value is string => Boolean(value));
  configured.push(request.nextUrl.origin);
  return new Set(configured);
}

function apiMutationBodyLimit(pathname: string): number {
  if (pathname === "/api/v1/inspections") return API_INSPECTION_JSON_BODY_LIMIT;
  if (pathname === "/api/v1/ai/detect-defects") return API_AI_JSON_BODY_LIMIT;
  return API_SMALL_JSON_BODY_LIMIT;
}

function applyRateHeaders(response: NextResponse, result: Awaited<ReturnType<typeof rateLimit>>) {
  response.headers.set("X-RateLimit-Limit", String(result.limit));
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  response.headers.set("X-RateLimit-Reset", String(result.reset));
}

function rateLimited(result: Awaited<ReturnType<typeof rateLimit>>, requestId: string) {
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
        "X-Request-ID": requestId,
        "Cache-Control": "no-store",
      },
    }
  );
}

function rejected(message: string, status: number, requestId: string) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "X-Request-ID": requestId, "Cache-Control": "no-store" } }
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = clientIpFromHeaders(request.headers);
  const requestId = normalizeRequestId(request.headers.get("x-request-id"), crypto.randomUUID());
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const csp = buildContentSecurityPolicy(nonce, process.env.NODE_ENV === "production");
  let appliedRateLimit: Awaited<ReturnType<typeof rateLimit>> | null = null;

  if (pathname.startsWith("/api/v1/")) {
    const identity = await apiRateIdentity(request, ip);
    const result = await rateLimit("api", identity);
    appliedRateLimit = result;
    if (!result.allowed) return rateLimited(result, requestId);

    const mutating = !["GET", "HEAD", "OPTIONS"].includes(request.method);
    if (mutating) {
      const originHeader = request.headers.get("origin");
      const origin = normalizeOrigin(originHeader);
      if (originHeader && (!origin || !allowedOrigins(request).has(origin))) {
        return rejected("Origin not allowed", 403, requestId);
      }

      const contentLengthHeader = request.headers.get("content-length");
      if (contentLengthHeader) {
        if (!/^\d+$/.test(contentLengthHeader)) {
          return rejected("Invalid Content-Length header", 400, requestId);
        }
        const contentLength = Number(contentLengthHeader);
        const maxBodyBytes = apiMutationBodyLimit(pathname);
        if (!Number.isSafeInteger(contentLength) || contentLength > maxBodyBytes) {
          return rejected(`Request body exceeds ${maxBodyBytes} byte limit`, 413, requestId);
        }
      }
    }
  }

  if (pathname.startsWith("/verify/")) {
    const result = await rateLimit("verify", `ip:${ip}`);
    appliedRateLimit = result;
    if (!result.allowed) return rateLimited(result, requestId);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("X-Request-ID", requestId);
  response.headers.set("Content-Security-Policy", csp);
  if (pathname.startsWith("/verify/")) {
    response.headers.set("Cache-Control", "private, max-age=60");
  } else if (pathname.startsWith("/api/")) {
    response.headers.set("Cache-Control", "no-store");
  }
  if (appliedRateLimit) applyRateHeaders(response, appliedRateLimit);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons/|robots.txt|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)",
  ],
};
