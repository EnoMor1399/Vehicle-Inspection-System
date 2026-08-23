import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { securityEvents } from "@/db/schema";
import { randomBytes } from "crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, stack, componentStack, timestamp, url, userAgent } = body;

    // Log error to database
    await db.insert(securityEvents).values({
      id: randomBytes(16).toString("hex"),
      eventType: "frontend_error",
      severity: "error",
      description: message,
      metadata: {
        stack,
        componentStack,
        timestamp,
        url,
        userAgent,
      },
      createdAt: new Date(),
    });

    // In production, you would also send to external error tracking service
    // e.g., Sentry, LogRocket, Bugsnag, etc.
    if (process.env.ERROR_TRACKING_WEBHOOK) {
      await fetch(process.env.ERROR_TRACKING_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "rsl-vims-frontend",
          level: "error",
          message,
          stack,
          url,
          timestamp,
        }),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to log error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to log error" },
      { status: 500 }
    );
  }
}
