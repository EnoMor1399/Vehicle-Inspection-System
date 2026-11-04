"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { organizations, organizationSubscriptions, subscriptionPayments, subscriptionPlans } from "@/db/schema";
import { requirePlatformSuperAdmin } from "@/lib/require-auth";
import { logAudit } from "@/lib/audit";
import { paymentsAvailable, toGhsPesewas, verifyAndRecordPayment } from "@/lib/paystack-payments";
import { calculateAnnualPlanPrice } from "@/lib/subscription-plan-pricing";

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

export type PlanPricingState = { ok: boolean; message: string };

const promoDate = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]);
function normalizedPromoDate(value: string) {
  if (!value) return null;
  const date = new Date(value + "T00:00:00.000Z");
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("Promotion date is invalid.");
  }
  return value;
}

export async function updateSubscriptionPlanPricing(
  _previous: PlanPricingState,
  formData: FormData,
): Promise<PlanPricingState> {
  const actor = await requirePlatformSuperAdmin();
  const parsed = z.object({
    planId: z.string().uuid(),
    price: z.string().trim().regex(/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/),
    billingCycle: z.enum(["monthly", "annual", "custom"]),
    isActive: z.enum(["true", "false"]),
    annualDiscountPercent: z.coerce.number().int().min(0).max(90),
    promoDiscountPercent: z.coerce.number().int().min(0).max(90),
    promoLabel: z.string().trim().max(80),
    promoStartsOn: promoDate,
    promoEndsOn: promoDate,
  }).safeParse({
    planId: formData.get("planId"),
    price: formData.get("price"),
    billingCycle: formData.get("billingCycle"),
    isActive: formData.get("isActive"),
    annualDiscountPercent: formData.get("annualDiscountPercent"),
    promoDiscountPercent: formData.get("promoDiscountPercent"),
    promoLabel: formData.get("promoLabel") ?? "",
    promoStartsOn: formData.get("promoStartsOn") ?? "",
    promoEndsOn: formData.get("promoEndsOn") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, message: "Enter valid prices and annual/promo discounts (0–90%), with correctly formatted dates." };
  }
  const values = parsed.data;
  let startDate: string | null;
  let endDate: string | null;
  try {
    startDate = normalizedPromoDate(values.promoStartsOn);
    endDate = normalizedPromoDate(values.promoEndsOn);
  } catch {
    return { ok: false, message: "Enter valid promotion dates." };
  }
  if (startDate && endDate && startDate > endDate) {
    return { ok: false, message: "The promotion end date cannot precede its start date." };
  }
  if (values.billingCycle !== "monthly" &&
      (values.annualDiscountPercent > 0 || values.promoDiscountPercent > 0)) {
    return { ok: false, message: "Annual discount and promo settings require a monthly base plan." };
  }
  // Do not leave invisible offers on a zero-priced custom plan.
  if (Number(values.price) === 0 && (values.annualDiscountPercent || values.promoDiscountPercent)) {
    return { ok: false, message: "Set a positive monthly base price before enabling discounts." };
  }

  const [plan] = await db.select().from(subscriptionPlans)
    .where(eq(subscriptionPlans.id, values.planId)).limit(1);
  if (!plan) return { ok: false, message: "Subscription plan not found." };
  if (plan.currency !== "GHS") {
    return { ok: false, message: "Only Ghana cedi pricing can be updated in this Paystack control centre." };
  }
  const nextOffer = {
    price: Number(values.price).toFixed(2),
    billingCycle: values.billingCycle,
    currency: plan.currency,
    annualDiscountPercent: values.annualDiscountPercent,
    promoDiscountPercent: values.promoDiscountPercent,
    promoLabel: values.promoDiscountPercent ? values.promoLabel || null : null,
    promoStartsOn: values.promoDiscountPercent ? startDate : null,
    promoEndsOn: values.promoDiscountPercent ? endDate : null,
  };
  let preview;
  try {
    preview = calculateAnnualPlanPrice(nextOffer);
    // Test maximum promo effect even when a scheduled promotion is not yet
    // active, so saving today's price cannot create a future zero-price quote.
    const fullDiscount = calculateAnnualPlanPrice({
      ...nextOffer, promoStartsOn: null, promoEndsOn: null,
    });
    if (Number(values.price) > 0 && fullDiscount && fullDiscount.annualMinor === 0) {
      return { ok: false, message: "Combined discounts cannot reduce a paid annual subscription to zero." };
    }
  } catch {
    return { ok: false, message: "The resulting annual price is invalid. Review the monthly price and discounts." };
  }

  // Audit before mutation, fail closed if the audit service is unavailable.
  // Catalog updates cannot rewrite already approved organization invoices,
  // outstanding Paystack amounts or existing payment records.
  try {
    await logAudit({
      organizationId: actor.organizationId,
      userId: actor.id,
      userName: actor.name,
      action: "update",
      entityType: "platform_subscription_plan_pricing",
      entityId: plan.id,
      entityLabel: plan.name,
      summary: "Super Admin updated monthly pricing, annual discount and promotional offer",
      before: {
        price: plan.price,
        billingCycle: plan.billingCycle,
        isActive: plan.isActive,
        annualDiscountPercent: plan.annualDiscountPercent,
        promoDiscountPercent: plan.promoDiscountPercent,
        promoLabel: plan.promoLabel,
        promoStartsOn: plan.promoStartsOn,
        promoEndsOn: plan.promoEndsOn,
      },
      after: {
        ...nextOffer,
        isActive: values.isActive === "true",
        calculatedAnnualPrice: preview?.annualPrice || null,
      },
      required: true,
    });
    await db.update(subscriptionPlans).set({
      ...nextOffer,
      isActive: values.isActive === "true",
      updatedAt: new Date(),
    }).where(eq(subscriptionPlans.id, plan.id));
    revalidatePath("/platform/payments");
    revalidatePath("/platform/organizations");
    revalidatePath("/");
    revalidatePath("/welcome");
    revalidatePath("/subscribe");
    return {
      ok: true,
      message: preview
        ? `Plan saved. Current annual catalogue price: GH₵${preview.annualPrice}. Existing invoices and payments were not changed.`
        : "Plan saved. Annual pricing requires a positive monthly base amount. Existing invoices were not changed.",
    };
  } catch {
    return { ok: false, message: "Could not update plan pricing safely. Review the audit service and retry." };
  }
}
