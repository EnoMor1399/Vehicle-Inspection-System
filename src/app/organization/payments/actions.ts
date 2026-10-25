"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { organizationSubscriptions, organizations, subscriptionPayments } from "@/db/schema";
import { getLatestOrganizationSubscription } from "@/lib/organization-control-plane";
import { requireAuth } from "@/lib/require-auth";
import { rateLimit } from "@/lib/rate-limit";
import { initializePaystack, newPaymentReference, paymentsAvailable, toGhsPesewas, type CheckoutChannel } from "@/lib/paystack-payments";
import { newId } from "@/lib/utils";

export type CheckoutState = { ok: boolean; message: string; checkoutUrl?: string };

export async function startSubscriptionCheckout(
  _previous: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const user = await requireAuth();
  if (user.role !== "organization_owner") {
    return { ok: false, message: "Only the Organization Owner can pay this subscription." };
  }
  const channel = formData.get("channel");
  if (channel !== "card" && channel !== "mobile_money") {
    return { ok: false, message: "Select card or mobile money checkout." };
  }
  if (!paymentsAvailable()) {
    return { ok: false, message: "Online checkout is not configured yet. Please contact VIMS billing support." };
  }
  const rate = await rateLimit("api", `subscription-checkout:${user.id}`);
  if (!rate.allowed) return { ok: false, message: "Too many payment attempts. Please try again later." };

  const current = await getLatestOrganizationSubscription(user.organizationId);
  const [organization] = await db.select({
    status: organizations.status,
  }).from(organizations).where(eq(organizations.id, user.organizationId)).limit(1);

  if (!current || !organization || organization.status === "suspended" || organization.status === "cancelled"
    || ["cancelled", "suspended", "expired"].includes(current.subscription.status)) {
    return { ok: false, message: "This subscriber account is not eligible for online payment. Contact support." };
  }
  // Only the Super Admin may authorize this organization's online subscription
  // collection. This policy is independent of the production live-key switch.
  if (!current.subscription.checkoutEnabled) {
    return { ok: false, message: "Online subscription collection is paused by VIMS Super Admin. Contact platform billing support." };
  }
  if (current.subscription.currency !== "GHS") {
    return { ok: false, message: "Paystack Ghana checkout currently supports GHS invoices only." };
  }
  let amountSubunits: number;
  try { amountSubunits = toGhsPesewas(String(current.subscription.amount)); }
  catch (err) { return { ok: false, message: err instanceof Error ? err.message : "Payment amount invalid." }; }

  const reference = newPaymentReference();
  try {
    await db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"subscription-payments:" + current.subscription.id}))`);
      // Re-read under the same lock used by Super Admin pause/resume. A stale
      // form or concurrent subscription price update cannot initiate charges.
      const [bill] = await tx.select({
        checkoutEnabled: organizationSubscriptions.checkoutEnabled,
        organizationId: organizationSubscriptions.organizationId,
        amount: organizationSubscriptions.amount,
        currency: organizationSubscriptions.currency,
        currentPeriodStart: organizationSubscriptions.currentPeriodStart,
        status: organizationSubscriptions.status,
      }).from(organizationSubscriptions)
        .where(eq(organizationSubscriptions.id, current.subscription.id))
        .limit(1);
      if (!bill || bill.organizationId !== user.organizationId || !bill.checkoutEnabled) {
        throw new Error("Super Admin has paused online subscription collection.");
      }
      if (["suspended", "cancelled", "expired"].includes(bill.status)
        || bill.currency !== "GHS"
        || toGhsPesewas(String(bill.amount)) !== amountSubunits
        || bill.currentPeriodStart.getTime() !== current.subscription.currentPeriodStart.getTime()) {
        throw new Error("Subscription billing terms changed. Refresh your invoice before paying.");
      }
      // Prevent accidental double taps or simultaneous checkout attempts.
      const [paid] = await tx.select({ id: subscriptionPayments.id }).from(subscriptionPayments)
        .where(and(
          eq(subscriptionPayments.subscriptionId, current.subscription.id),
          eq(subscriptionPayments.organizationId, user.organizationId),
          eq(subscriptionPayments.billingPeriodStart, current.subscription.currentPeriodStart),
          eq(subscriptionPayments.status, "success"),
        )).limit(1);
      if (paid) throw new Error("This subscription billing period is already paid. Do not submit another payment.");
      const [inFlight] = await tx.select({ id: subscriptionPayments.id }).from(subscriptionPayments)
        .where(and(
          eq(subscriptionPayments.subscriptionId, current.subscription.id),
          eq(subscriptionPayments.organizationId, user.organizationId),
          eq(subscriptionPayments.billingPeriodStart, current.subscription.currentPeriodStart),
          inArray(subscriptionPayments.status, ["pending", "processing"]),
        )).limit(1);
      if (inFlight) {
        throw new Error("A payment is still awaiting confirmation for this billing period. Check its status before starting another checkout.");
      }
      await tx.insert(subscriptionPayments).values({
        id: newId(),
        organizationId: user.organizationId,
        subscriptionId: current.subscription.id,
        billingPeriodStart: current.subscription.currentPeriodStart,
        initiatedBy: user.id,
        reference,
        amountSubunits,
        currency: "GHS",
        channel: channel as CheckoutChannel,
        status: "pending",
        customerEmail: user.email.toLowerCase(),
      });
    });
    const checkoutUrl = await initializePaystack({
      reference,
      amountSubunits,
      email: user.email.toLowerCase(),
      channel: channel as CheckoutChannel,
      organizationId: user.organizationId,
      subscriptionId: current.subscription.id,
    });
    revalidatePath("/organization/payments");
    return { ok: true, checkoutUrl, message: "Your secure Paystack checkout is ready." };
  } catch (error) {
    // A timeout or lost gateway response cannot prove Paystack rejected the
    // transaction. Retain the pending record to prevent an accidental second
    // charge; the owner can verify the reference in payment history.
    return {
      ok: false,
      message: (error instanceof Error ? error.message : "Checkout unavailable.") +
        " If a payment was initiated, check its status in Payment History. Do not retry until it is resolved.",
    };
  }
}
