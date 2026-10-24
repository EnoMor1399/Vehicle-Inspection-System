import { NextResponse, type NextRequest } from "next/server";
import { verifyAndRecordPayment, verifyPaystackSignature } from "@/lib/paystack-payments";
import { validatedPaystackCredentials } from "@/lib/paystack-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Accept a correctly authenticated settlement notification even if
  // new live checkouts are paused. Otherwise legitimate in-flight payments
  // could remain pending indefinitely after an emergency checkout shutdown.
  let secret: string;
  try {
    secret = validatedPaystackCredentials({
      secretKey: process.env.PAYSTACK_SECRET_KEY,
      mode: process.env.PAYSTACK_MODE,
    }).secret;
  } catch {
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
  if (typeof reference !== "string" || !/^vims-[a-f0-9]{32}$/.test(reference)) {
    return NextResponse.json({ received: true });
  }

  try {
    // Never trust webhook status/amount alone. Requery Paystack and verify
    // original server-side invoice reference, exact pesewas, currency and mode.
    const status = await verifyAndRecordPayment(reference);
    if (status !== "success") {
      // A signed success event may arrive before the verification API confirms
      // settlement. Request Paystack retry instead of acknowledging early.
      return NextResponse.json({ error: "Settlement not yet confirmed" }, { status: 503 });
    }
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
