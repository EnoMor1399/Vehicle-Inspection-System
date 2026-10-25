"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { organizations, organizationSubscriptions, subscriptionPayments } from "@/db/schema";
import { requirePlatformSuperAdmin } from "@/lib/require-auth";
import { logAudit } from "@/lib/audit";
import { paymentsAvailable, toGhsPesewas, verifyAndRecordPayment } from "@/lib/paystack-payments";

const controlSchema = z.object({
  organizationId: z.string().uuid(),
  enabled: z.enum(["true", "false"]),
});

export async function setSubscriptionCheckoutAvailability(formData: FormData) {
  const actor = await requirePlatformSuperAdmin();
  const parsed = controlSchema.safeParse({
    organizationId: formData.get("organizationId"),
    enabled: formData.get("enabled"),
  });
  if (!parsed.success) throw new Error("Invalid subscription billing control request.");

  const { organizationId } = parsed.data;
  const enabled = parsed.data.enabled === "true";
  const [organization] = await db.select({
    id: organizations.id,
    name: organizations.name,
    status: organizations.status,
  }).from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  if (!organization) throw new Error("Subscriber organization not found.");

  const [current] = await db.select().from(organizationSubscriptions)
    .where(eq(organizationSubscriptions.organizationId, organizationId))
    .orderBy(desc(organizationSubscriptions.createdAt))
    .limit(1);
  if (!current) throw new Error("Subscription not found.");

  if (enabled) {
    if (!paymentsAvailable()) {
      throw new Error("Paystack checkout is unavailable. Complete approved gateway configuration first.");
    }
    if (organization.status === "suspended" || organization.status === "cancelled"
      || ["suspended", "cancelled", "expired"].includes(current.status)) {
      throw new Error("This subscriber is not eligible for online payments.");
    }
    if (current.currency !== "GHS") throw new Error("Only GHS subscription checkout is supported.");
    toGhsPesewas(String(current.amount));
  }

  // Record an authenticated, tenant-attributed Super Admin approval intent
  // BEFORE changing the payment policy. Deny if the audit ledger is down.
  await logAudit({
    organizationId,
    userId: actor.id,
    userName: actor.name,
    action: "update",
    entityType: "subscription_checkout_control",
    entityId: current.id,
    entityLabel: organization.name,
    summary: `Super Admin ${enabled ? "approved" : "paused"} VIMS subscription checkout`,
    before: { checkoutEnabled: current.checkoutEnabled },
    after: { checkoutEnabled: enabled, provider: "paystack", currency: "GHS" },
    required: true,
  });

  await db.transaction(async (tx) => {
    // Serialize with new hosted checkout attempts, so an administrative pause
    // cannot race an in-flight database payment creation.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"subscription-payments:" + current.id}))`);
    const [latest] = await tx.select({
      id: organizationSubscriptions.id,
    }).from(organizationSubscriptions)
      .where(eq(organizationSubscriptions.organizationId, organizationId))
      .orderBy(desc(organizationSubscriptions.createdAt))
      .limit(1);
    if (latest?.id !== current.id) throw new Error("Subscription changed; refresh this page.");

    await tx.update(organizationSubscriptions)
      .set({ checkoutEnabled: enabled, updatedAt: new Date() })
      .where(and(
        eq(organizationSubscriptions.id, current.id),
        eq(organizationSubscriptions.organizationId, organizationId),
      ));
  });

  revalidatePath(`/platform/organizations/${organizationId}`);
  revalidatePath("/platform/payments");
  revalidatePath("/organization/payments");
}

export type VerifySubscriptionPaymentState = { ok: boolean; message: string };

export async function verifySubscriptionPayment(
  _previous: VerifySubscriptionPaymentState,
  formData: FormData,
): Promise<VerifySubscriptionPaymentState> {
  const actor = await requirePlatformSuperAdmin();
  const parsed = z.object({ paymentId: z.string().uuid() }).safeParse({
    paymentId: formData.get("paymentId"),
  });
  if (!parsed.success) return { ok: false, message: "Invalid payment reference." };

  const [payment] = await db.select({
    id: subscriptionPayments.id,
    reference: subscriptionPayments.reference,
    organizationId: subscriptionPayments.organizationId,
    status: subscriptionPayments.status,
  }).from(subscriptionPayments)
    .where(eq(subscriptionPayments.id, parsed.data.paymentId))
    .limit(1);

  if (!payment) return { ok: false, message: "Payment record not found." };
  if (payment.status === "success") return { ok: true, message: "Already confirmed by Paystack." };
  if (payment.status !== "pending" && payment.status !== "processing") {
    return { ok: false, message: "Only unresolved payments can be reverified." };
  }

  try {
    // Never mark paid manually: signed webhook and this Super Admin action
    // share exact canonical provider verification, amount and tenant checks.
    await logAudit({
      organizationId: payment.organizationId,
      userId: actor.id,
      userName: actor.name,
      action: "inspect",
      entityType: "subscription_payment_verification",
      entityId: payment.id,
      summary: "Super Admin requested independent Paystack settlement verification",
      after: { provider: "paystack", paymentReference: payment.reference },
      required: true,
    });
    const status = await verifyAndRecordPayment(payment.reference);
    revalidatePath("/platform/payments");
    revalidatePath("/organization/payments");
    return { ok: true, message: `Verified provider status: ${status}.` };
  } catch {
    return { ok: false, message: "Payment could not be verified. Review the provider transaction and retry safely." };
  }
}
