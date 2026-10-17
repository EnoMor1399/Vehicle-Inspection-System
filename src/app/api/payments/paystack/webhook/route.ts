import { NextResponse, type NextRequest } from "next/server";
import { verifyAndRecordPayment, verifyPaystackSignature } from "@/lib/paystack-payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const secret = process.env.PAYSTACK_SECRET_KEY?.trim();
  const mode = process.env.PAYSTACK_MODE?.trim();
  if (!secret || !["test", "live"].includes(mode || "") ||
    !secret.startsWith(mode === "live" ? "sk_live_" : "sk_test_") ||
    (mode === "live" && process.env.PAYSTACK_LIVE_PAYMENTS_ENABLED !== "true")) {
    return NextResponse.json({ error: "Payment processing unavailable" }, { status: 503 });
  }

  if (Number(request.headers.get("content-length") || 0) > 32_768) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  const raw = await request.text();
  if (Buffer.byteLength(raw) > 32_768) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  if (!verifyPaystackSignature(raw, request.headers.get("x-paystack-signature"), secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  let body: unknown;
  try { body = JSON.parse(raw); }
  catch { return NextResponse.json({ error: "Malformed payload" }, { status: 400 }); }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const event = body as { event?: unknown; data?: { reference?: unknown } };
  if (event.event !== "charge.success") {
    return NextResponse.json({ received: true });
  }
  const reference = event.data?.reference;
  if (typeof reference !== "string" || !/^vims_[a-f0-9]{32}$/.test(reference)) {
    return NextResponse.json({ received: true });
  }

  try {
    // Never trust webhook status/amount alone. Requery Paystack and verify
    // original server-side invoice reference, exact pesewas, currency and mode.
    await verifyAndRecordPayment(reference);
    return NextResponse.json({ received: true });
  } catch (error) {
    // Signed events are retried by the payment provider; do not acknowledge
    // before verification succeeds. Do not log customer data or signed body.
    console.error("Paystack webhook processing failed", {
      reason: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ error: "Unable to reconcile event" }, { status: 503 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
