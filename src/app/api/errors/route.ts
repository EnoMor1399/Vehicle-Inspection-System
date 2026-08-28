import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { db } from "@/db";
import { securityEvents } from "@/db/schema";
import { rateLimit } from "@/lib/rate-limit";
import { validateWebhookDestination } from "@/lib/integration-security";

const frontendErrorSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  stack: z.string().max(12000).optional(),
  componentStack: z.string().max(12000).optional(),
  timestamp: z.string().max(100).optional(),
  url: z.string().max(2000).optional(),
}).strict();

function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > 64 * 1024) {
    return NextResponse.json({ success: false, error: "Payload too large" }, { status: 413 });
  }

  const ipAddress = clientIp(request);
  const limit = await rateLimit("error", `ip:${ipAddress}`);
  if (!limit.allowed) {
    return NextResponse.json({ success: false, error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const parsed = frontendErrorSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid error report" }, { status: 400 });
    }

    const userAgent = (request.headers.get("user-agent") || "unknown").slice(0, 1000);
    const { message, stack, componentStack, timestamp, url } = parsed.data;

    await db.insert(securityEvents).values({
      id: randomBytes(16).toString("hex"),
      eventType: "frontend_error",
      severity: "warning",
      ipAddress,
      userAgent,
      description: message,
      metadata: { stack, componentStack, timestamp, url },
      createdAt: new Date(),
    });

    const webhook = process.env.ERROR_TRACKING_WEBHOOK;
    if (webhook) {
      const destination = validateWebhookDestination(webhook);
      if (destination.ok) {
        try {
          await fetch(destination.url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ source: "rsl-vims-frontend", level: "warning", message, stack, url, timestamp }),
            signal: AbortSignal.timeout(5000),
          });
        } catch {
          // Error reporting must never break the user-facing request.
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to log error" }, { status: 500 });
  }
}
