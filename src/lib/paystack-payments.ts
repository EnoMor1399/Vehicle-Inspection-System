import "server-only";

import { randomBytes } from "node:crypto";
import { matchesOriginalInvoice, type VerifiedPaystackTransaction } from "@/lib/paystack-validation";
export { toGhsPesewas, verifyPaystackSignature } from "@/lib/paystack-validation";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { subscriptionPayments } from "@/db/schema";

const GATEWAY = "https://api.paystack.co";
export type CheckoutChannel = "card" | "mobile_money";

function paystackSecret() {
  const secret = process.env.PAYSTACK_SECRET_KEY?.trim();
  const mode = process.env.PAYSTACK_MODE?.trim();
  if (!secret || !["test", "live"].includes(mode || "") ||
      !secret.startsWith(mode === "live" ? "sk_live_" : "sk_test_")) {
    throw new Error("Paystack is not configured for this environment.");
  }
  if (mode === "live" && process.env.PAYSTACK_LIVE_PAYMENTS_ENABLED !== "true") {
    throw new Error("Live payments require explicit activation.");
  }
  return { secret, mode };
}

export function paymentsAvailable() {
  try { paystackSecret(); return true; } catch { return false; }
}

async function paystackRequest<T>(path: string, method: "GET" | "POST", body?: Record<string, unknown>): Promise<T> {
  const { secret } = paystackSecret();
  const response = await fetch(GATEWAY + path, {
    method,
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(12000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("The payment provider is temporarily unavailable. Please try again.");
  const result: unknown = await response.json();
  if (!result || typeof result !== "object" || !("status" in result) ||
      (result as {status: unknown}).status !== true) {
    throw new Error("The payment provider did not accept the request.");
  }
  return result as T;
}

export async function initializePaystack(input: {
  reference: string;
  amountSubunits: number;
  email: string;
  channel: CheckoutChannel;
  organizationId: string;
  subscriptionId: string;
}) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configured) throw new Error("The checkout return URL is not configured.");
  const url = new URL(configured);
  if (url.protocol !== "https:" || url.username || url.password || url.hash || url.search ||
      url.pathname !== "/" || !url.hostname) {
    throw new Error("Invalid secure checkout return URL.");
  }
  const result = await paystackRequest<{
    status: boolean;
    data: { authorization_url: string; reference: string };
  }>("/transaction/initialize", "POST", {
    email: input.email,
    amount: String(input.amountSubunits),
    currency: "GHS",
    channels: [input.channel],
    reference: input.reference,
    callback_url: new URL("/organization/payments/result", url.origin).toString(),
    metadata: {
      application: "VIMS",
      organization_id: input.organizationId,
      subscription_id: input.subscriptionId,
    },
  });
  if (result.data?.reference !== input.reference) throw new Error("Checkout reference mismatch.");
  let destination: URL;
  try { destination = new URL(result.data.authorization_url); }
  catch { throw new Error("Invalid checkout response."); }
  if (destination.protocol !== "https:" || destination.hostname !== "checkout.paystack.com"
    || destination.username || destination.password) {
    throw new Error("Checkout destination rejected.");
  }
  return destination.toString();
}

export async function verifyAndRecordPayment(reference: string) {
  if (!/^vims_[a-f0-9]{32}$/.test(reference)) throw new Error("Invalid payment reference.");
  const [payment] = await db.select().from(subscriptionPayments)
    .where(eq(subscriptionPayments.reference, reference)).limit(1);
  if (!payment) throw new Error("Payment record not found.");
  if (payment.status === "success") return "success" as const;

  const response = await paystackRequest<{ data: VerifiedPaystackTransaction }>(
    `/transaction/verify/${encodeURIComponent(reference)}`, "GET",
  );
  const txn = response.data;
  const { mode } = paystackSecret();
  if (!matchesOriginalInvoice(txn, {
    reference,
    currency: payment.currency,
    amountSubunits: payment.amountSubunits,
    customerEmail: payment.customerEmail,
    mode,
  })) {
    throw new Error("Payment verification did not match the original invoice. Contact support.");
  }
  const currentStatus = txn.status === "success" ? "success"
    : ["failed", "abandoned", "reversed"].includes(txn.status) ? "failed"
      : "processing";

  await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${reference}))`);
    const [current] = await tx.select().from(subscriptionPayments)
      .where(eq(subscriptionPayments.reference, reference)).limit(1);
    if (!current || current.status === "success") return;
    await tx.update(subscriptionPayments).set({
      status: currentStatus,
      gatewayTransactionId: String(txn.id).slice(0, 40),
      gatewayMessage: String(txn.gateway_response || txn.status).slice(0, 240),
      paidAt: currentStatus === "success" ? new Date() : null,
      updatedAt: new Date(),
    }).where(and(eq(subscriptionPayments.id, current.id), eq(subscriptionPayments.organizationId, current.organizationId)));
  });
  // Do not alter subscription status, billing provider or operational access here.
  // The payment is a verified receipt, not permission to provision a tenant.
  return currentStatus;
}

export async function getSubscriptionPaymentHistory(organizationId: string) {
  return db.select().from(subscriptionPayments)
    .where(eq(subscriptionPayments.organizationId, organizationId))
    .orderBy(desc(subscriptionPayments.createdAt)).limit(30);
}

export function newPaymentReference() {
  return `vims_${randomBytes(16).toString("hex")}`;
}
