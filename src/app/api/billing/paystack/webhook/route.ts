import { processPaystackWebhook } from "@/lib/subscription-billing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  try {
    const result = await processPaystackWebhook(rawBody, signature);
    return Response.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    const invalidSignature = message === "Invalid Paystack signature";
    console.warn(`[billing-webhook] ${invalidSignature ? "signature rejected" : "processing rejected"}: ${message}`);
    return Response.json(
      { ok: false, error: invalidSignature ? "Invalid signature" : "Unable to process event" },
      { status: invalidSignature ? 401 : 400 },
    );
  }
}
