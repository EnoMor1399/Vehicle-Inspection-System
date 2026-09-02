import { NextRequest, NextResponse } from "next/server";
import { randomBytes, randomUUID } from "crypto";
import { z } from "zod";
import { db } from "@/db";
import { securityEvents } from "@/db/schema";
import { rateLimit } from "@/lib/rate-limit";
import { validateResolvedWebhookDestination, validateWebhookDestination } from "@/lib/integration-security";
import { sanitizeTelemetryUrl } from "@/lib/telemetry";
import { clientIpFromHeaders, normalizeRequestId, normalizeUserAgent } from "@/lib/request-context";
import { API_SMALL_JSON_BODY_LIMIT, readJsonBody } from "@/lib/request-body";

const frontendErrorSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  stack: z.string().max(12000).optional(),
  componentStack: z.string().max(12000).optional(),
  timestamp: z.string().max(100).optional(),
  url: z.string().max(2000).optional(),
}).strict();

function jsonResponse(body: Record<string, unknown>, status: number, requestId: string) {
  return NextResponse.json(body, {
    status,
    headers: { "X-Request-ID": requestId, "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  const requestId = normalizeRequestId(request.headers.get("x-request-id"), randomUUID());
  const ipAddress = clientIpFromHeaders(request.headers);
  const limit = await rateLimit("error", `ip:${ipAddress}`);
  if (!limit.allowed) {
    return jsonResponse({ success: false, error: "Rate limit exceeded" }, 429, requestId);
  }

  const body = await readJsonBody(request, API_SMALL_JSON_BODY_LIMIT);
  if (!body.ok) {
    return jsonResponse({ success: false, error: body.message }, body.status, requestId);
  }

  try {
    const parsed = frontendErrorSchema.safeParse(body.value);
    if (!parsed.success) {
      return jsonResponse({ success: false, error: "Invalid error report" }, 400, requestId);
    }

    const userAgent = normalizeUserAgent(request.headers.get("user-agent"));
    const { message, stack, componentStack, timestamp, url } = parsed.data;
    const safeUrl = sanitizeTelemetryUrl(url);

    await db.insert(securityEvents).values({
      id: randomBytes(16).toString("hex"),
      eventType: "frontend_error",
      severity: "warning",
      ipAddress,
      userAgent,
      description: message,
      metadata: { stack, componentStack, timestamp, url: safeUrl, requestId },
      createdAt: new Date(),
    });

    const webhook = process.env.ERROR_TRACKING_WEBHOOK;
    if (webhook) {
      const destination = validateWebhookDestination(webhook);
      if (destination.ok) {
        const resolved = await validateResolvedWebhookDestination(destination.url);
        if (resolved.ok) {
          try {
            await fetch(destination.url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ source: "rsl-vims-frontend", level: "warning", message, stack, url: safeUrl, timestamp, requestId }),
              signal: AbortSignal.timeout(5000),
            });
          } catch {
            // Error reporting must never break the user-facing request.
          }
        }
      }
    }

    return jsonResponse({ success: true, requestId }, 200, requestId);
  } catch {
    return jsonResponse({ success: false, error: "Failed to log error", requestId }, 500, requestId);
  }
}
