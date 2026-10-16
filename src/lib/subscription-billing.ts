import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "crypto";
import { and, desc, eq, inArray, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  billingInvoices,
  billingPayments,
  billingWebhookEvents,
  organizations,
  organizationSubscriptions,
  sessions,
  subscriptionPlans,
  users,
} from "@/db/schema";
import { getLatestOrganizationSubscription } from "@/lib/organization-control-plane";
import { newId } from "@/lib/utils";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const PAYSTACK_API = "https://api.paystack.co";
const PAYABLE_INVOICE_STATUSES = new Set(["open", "overdue"]);
const REACTIVATABLE_SUBSCRIPTION_STATUSES = new Set([
  "trialing",
  "past_due",
  "grace",
  "suspended",
  "expired",
]);

function moneyToCents(value: string | number) {
  const normalized = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error("Invalid monetary amount");
  }
  const [whole, fraction = ""] = normalized.split(".");
  const cents = BigInt(whole) * 100n + BigInt((fraction + "00").slice(0, 2));
  if (cents > 999999999999n) throw new Error("Monetary amount exceeds supported range");
  return cents;
}

function centsToMoney(value: bigint) {
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  return `${sign}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, "0")}`;
}

function sanitizeCurrency(value: string) {
  const currency = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Currency must be a 3-letter ISO code");
  return currency;
}

function addBillingCycle(start: Date, cycle: string) {
  const end = new Date(start);
  if (cycle === "monthly") {
    end.setUTCMonth(end.getUTCMonth() + 1);
    return end;
  }
  if (cycle === "annual") {
    end.setUTCFullYear(end.getUTCFullYear() + 1);
    return end;
  }
  return null;
}

function safeProviderMetadata(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") return {};
  const value = input as Record<string, unknown>;
  return {
    domain: typeof value.domain === "string" ? value.domain.slice(0, 30) : undefined,
    gateway_response: typeof value.gateway_response === "string"
      ? value.gateway_response.slice(0, 200)
      : undefined,
    paid_at: typeof value.paid_at === "string" ? value.paid_at.slice(0, 80) : undefined,
  };
}

function paystackKey() {
  return (process.env.PAYSTACK_SECRET_KEY || "").trim();
}

export function isPaystackConfigured() {
  return paystackKey().startsWith("sk_");
}

async function getBillingContext(organizationId: string) {
  const [[organization], subscription] = await Promise.all([
    db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1),
    getLatestOrganizationSubscription(organizationId),
  ]);
  if (!organization) throw new Error("Organization not found");
  if (!subscription) throw new Error("Organization subscription not found");
  return { organization, subscription };
}

export async function refreshOverdueInvoices(organizationId: string) {
  await db
    .update(billingInvoices)
    .set({ status: "overdue", updatedAt: new Date() })
    .where(and(
      eq(billingInvoices.organizationId, organizationId),
      eq(billingInvoices.status, "open"),
      lt(billingInvoices.dueAt, new Date()),
    ));
}

export async function listOrganizationBilling(organizationId: string) {
  await refreshOverdueInvoices(organizationId);
  const [invoices, payments] = await Promise.all([
    db
      .select()
      .from(billingInvoices)
      .where(eq(billingInvoices.organizationId, organizationId))
      .orderBy(desc(billingInvoices.createdAt))
      .limit(100),
    db
      .select()
      .from(billingPayments)
      .where(eq(billingPayments.organizationId, organizationId))
      .orderBy(desc(billingPayments.createdAt))
      .limit(200),
  ]);
  return { invoices, payments };
}

export async function getBillingInvoice(organizationId: string, invoiceId: string) {
  const [invoice] = await db
    .select()
    .from(billingInvoices)
    .where(and(
      eq(billingInvoices.organizationId, organizationId),
      eq(billingInvoices.id, invoiceId),
    ))
    .limit(1);
  return invoice || null;
}

export async function createSubscriptionInvoice(input: {
  organizationId: string;
  actorUserId: string;
  dueAt?: Date | null;
  tax?: string | number | null;
  discount?: string | number | null;
  notes?: string | null;
}) {
  const { organization, subscription } = await getBillingContext(input.organizationId);
  if (subscription.subscription.status === "cancelled") {
    throw new Error("Cannot issue a new invoice for a cancelled subscription");
  }

  const [existingPayableInvoice] = await db
    .select()
    .from(billingInvoices)
    .where(and(
      eq(billingInvoices.organizationId, input.organizationId),
      eq(billingInvoices.subscriptionId, subscription.subscription.id),
      inArray(billingInvoices.status, ["open", "overdue"]),
    ))
    .orderBy(desc(billingInvoices.createdAt))
    .limit(1);
  if (existingPayableInvoice) return existingPayableInvoice;

  const subtotalSource = Number(subscription.subscription.amount) > 0
    ? String(subscription.subscription.amount)
    : String(subscription.plan.price);
  const subtotalCents = moneyToCents(subtotalSource);
  if (subtotalCents <= 0n) {
    throw new Error("Set a positive subscription amount before issuing an invoice");
  }

  const discountCents = input.discount === null || input.discount === undefined || input.discount === ""
    ? 0n
    : moneyToCents(input.discount);
  const taxCents = input.tax === null || input.tax === undefined || input.tax === ""
    ? 0n
    : moneyToCents(input.tax);
  if (discountCents > subtotalCents) throw new Error("Invoice discount cannot exceed the subtotal");

  const totalCents = subtotalCents - discountCents + taxCents;
  if (totalCents <= 0n) throw new Error("Invoice total must be greater than zero");

  const periodStart = subscription.subscription.currentPeriodEnd
    && new Date(subscription.subscription.currentPeriodEnd).getTime() > Date.now()
      ? new Date(subscription.subscription.currentPeriodEnd)
      : new Date();

  const periodEnd = addBillingCycle(periodStart, subscription.plan.billingCycle);

  const id = newId();
  const suffix = id.replaceAll("-", "").slice(-8).toUpperCase();
  const dateCode = periodStart.toISOString().slice(0, 7).replace("-", "");
  const slug = organization.slug.replace(/[^a-z0-9]/gi, "").slice(0, 12).toUpperCase() || "ORG";
  const invoiceNumber = `VIMS-${slug}-${dateCode}-${suffix}`;
  const currency = sanitizeCurrency(subscription.subscription.currency || subscription.plan.currency || "GHS");
  const dueAt = input.dueAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  if (dueAt <= new Date()) throw new Error("Invoice due date must be in the future");
  const notes = input.notes?.trim() || null;
  if (notes && notes.length > 4000) throw new Error("Invoice notes must not exceed 4000 characters");

  const lineItemAmount = centsToMoney(subtotalCents);
  const [invoice] = await db
    .insert(billingInvoices)
    .values({
      id,
      organizationId: input.organizationId,
      subscriptionId: subscription.subscription.id,
      invoiceNumber,
      status: "open",
      periodStart,
      periodEnd,
      dueAt,
      subtotal: centsToMoney(subtotalCents),
      discount: centsToMoney(discountCents),
      tax: centsToMoney(taxCents),
      total: centsToMoney(totalCents),
      currency,
      lineItems: [{
        description: `${subscription.plan.name} VIMS subscription`,
        quantity: 1,
        unitAmount: lineItemAmount,
        amount: lineItemAmount,
      }],
      notes,
      createdBy: input.actorUserId,
    })
    .returning();

  if (!invoice) throw new Error("Invoice creation did not complete");
  return invoice;
}

async function settleSuccessfulPayment(
  tx: DbTransaction,
  input: {
    paymentId: string;
    invoiceId: string;
    providerTransactionId?: string | null;
    channel?: string | null;
    paidAt?: Date | null;
    providerMetadata?: Record<string, unknown>;
  },
) {
  const [payment] = await tx
    .select()
    .from(billingPayments)
    .where(eq(billingPayments.id, input.paymentId))
    .limit(1);
  if (!payment) throw new Error("Payment record not found");

  const [invoice] = await tx
    .select()
    .from(billingInvoices)
    .where(and(
      eq(billingInvoices.id, input.invoiceId),
      eq(billingInvoices.organizationId, payment.organizationId),
    ))
    .limit(1);
  if (!invoice) throw new Error("Invoice not found");

  if (payment.status === "success" && invoice.status === "paid") {
    return { payment, invoice, alreadySettled: true };
  }
  if (!PAYABLE_INVOICE_STATUSES.has(invoice.status) && invoice.status !== "paid") {
    throw new Error("Invoice is not payable");
  }

  const paymentCents = moneyToCents(String(payment.amount));
  const invoiceCents = moneyToCents(String(invoice.total));
  if (paymentCents !== invoiceCents) throw new Error("Payment amount does not match the invoice total");
  if (sanitizeCurrency(payment.currency) !== sanitizeCurrency(invoice.currency)) {
    throw new Error("Payment currency does not match the invoice currency");
  }

  const settledAt = input.paidAt || new Date();
  const [updatedPayment] = await tx
    .update(billingPayments)
    .set({
      status: "success",
      providerTransactionId: input.providerTransactionId || payment.providerTransactionId,
      channel: input.channel || payment.channel,
      paidAt: settledAt,
      failureReason: null,
      metadata: input.providerMetadata || payment.metadata,
      updatedAt: settledAt,
    })
    .where(eq(billingPayments.id, payment.id))
    .returning();

  const [updatedInvoice] = await tx
    .update(billingInvoices)
    .set({
      status: "paid",
      paidAt: settledAt,
      updatedAt: settledAt,
    })
    .where(eq(billingInvoices.id, invoice.id))
    .returning();

  const [subscription] = await tx
    .select()
    .from(organizationSubscriptions)
    .where(eq(organizationSubscriptions.id, invoice.subscriptionId))
    .limit(1);

  if (subscription && subscription.status !== "cancelled") {
    const shouldReactivate = REACTIVATABLE_SUBSCRIPTION_STATUSES.has(subscription.status);
    await tx
      .update(organizationSubscriptions)
      .set({
        ...(shouldReactivate ? { status: "active" as const } : {}),
        currentPeriodStart: invoice.periodStart,
        currentPeriodEnd: invoice.periodEnd,
        graceEndsAt: null,
        updatedAt: settledAt,
      })
      .where(eq(organizationSubscriptions.id, subscription.id));

    if (shouldReactivate) {
      const orgUsers = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.organizationId, invoice.organizationId));
      if (orgUsers.length) {
        await tx
          .update(sessions)
          .set({ isActive: false })
          .where(inArray(sessions.userId, orgUsers.map((user) => user.id)));
      }
    }
  }

  return {
    payment: updatedPayment || payment,
    invoice: updatedInvoice || invoice,
    alreadySettled: false,
  };
}

export async function recordManualInvoicePayment(input: {
  organizationId: string;
  invoiceId: string;
  actorUserId: string;
  reference: string;
  channel?: string | null;
  notes?: string | null;
}) {
  const invoice = await getBillingInvoice(input.organizationId, input.invoiceId);
  if (!invoice) throw new Error("Invoice not found");
  if (!PAYABLE_INVOICE_STATUSES.has(invoice.status)) {
    if (invoice.status === "paid") return invoice;
    throw new Error("Invoice is not payable");
  }

  const reference = input.reference.trim().slice(0, 160);
  if (reference.length < 3) throw new Error("Enter a valid payment reference");
  const paymentId = newId();

  await db.transaction(async (tx) => {
    await tx.insert(billingPayments).values({
      id: paymentId,
      organizationId: input.organizationId,
      invoiceId: invoice.id,
      provider: "manual",
      reference,
      status: "pending",
      amount: invoice.total,
      currency: invoice.currency,
      channel: input.channel?.trim().slice(0, 80) || "bank_transfer",
      metadata: input.notes?.trim() ? { notes: input.notes.trim().slice(0, 1000) } : {},
      createdBy: input.actorUserId,
    });

    await settleSuccessfulPayment(tx, {
      paymentId,
      invoiceId: invoice.id,
      channel: input.channel?.trim().slice(0, 80) || "bank_transfer",
      paidAt: new Date(),
    });
  });

  return invoice;
}

type PaystackInitializeResponse = {
  status?: boolean;
  message?: string;
  data?: {
    authorization_url?: string;
    access_code?: string;
    reference?: string;
  };
};

type PaystackVerifyResponse = {
  status?: boolean;
  message?: string;
  data?: {
    id?: number | string;
    status?: string;
    reference?: string;
    amount?: number;
    currency?: string;
    channel?: string;
    paid_at?: string;
    domain?: string;
    gateway_response?: string;
  };
};

export async function initializePaystackInvoicePayment(input: {
  organizationId: string;
  invoiceId: string;
  userId: string;
  payerEmail: string;
  appBaseUrl: string;
}) {
  const key = paystackKey();
  if (!key) throw new Error("Paystack is not configured for this deployment");

  const invoice = await getBillingInvoice(input.organizationId, input.invoiceId);
  if (!invoice) throw new Error("Invoice not found");
  if (!PAYABLE_INVOICE_STATUSES.has(invoice.status)) {
    throw new Error(invoice.status === "paid" ? "Invoice is already paid" : "Invoice is not payable");
  }

  const email = input.payerEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("A valid billing email is required");

  const paymentId = newId();
  const reference = `VIMS-${paymentId.replaceAll("-", "")}`;
  const amountCents = moneyToCents(String(invoice.total));
  const appBase = input.appBaseUrl.replace(/\/$/, "");
  if (!/^https:\/\//i.test(appBase) && process.env.NODE_ENV === "production") {
    throw new Error("A secure public application URL is required for online payment");
  }

  await db.insert(billingPayments).values({
    id: paymentId,
    organizationId: input.organizationId,
    invoiceId: invoice.id,
    provider: "paystack",
    reference,
    status: "pending",
    amount: invoice.total,
    currency: invoice.currency,
    metadata: {},
    createdBy: input.userId,
  });

  try {
    const response = await fetch(`${PAYSTACK_API}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: amountCents.toString(),
        currency: invoice.currency,
        reference,
        callback_url: `${appBase}/organization/billing/verify?reference=${encodeURIComponent(reference)}`,
        metadata: JSON.stringify({
          billing_invoice_id: invoice.id,
          organization_id: input.organizationId,
        }),
      }),
      cache: "no-store",
    });

    const body = await response.json() as PaystackInitializeResponse;
    const authorizationUrl = body.data?.authorization_url || "";
    if (!response.ok || !body.status || !/^https:\/\/checkout\.paystack\.com\//i.test(authorizationUrl)) {
      throw new Error(body.message || "Paystack could not initialize the payment");
    }

    return {
      paymentId,
      reference,
      authorizationUrl,
    };
  } catch (error) {
    await db
      .update(billingPayments)
      .set({
        status: "failed",
        failureReason: error instanceof Error ? error.message.slice(0, 500) : "Payment initialization failed",
        updatedAt: new Date(),
      })
      .where(eq(billingPayments.id, paymentId));
    throw error;
  }
}

async function fetchPaystackVerification(reference: string) {
  const key = paystackKey();
  if (!key) throw new Error("Paystack is not configured for this deployment");

  const response = await fetch(
    `${PAYSTACK_API}/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    },
  );
  const body = await response.json() as PaystackVerifyResponse;
  if (!response.ok || !body.status || !body.data) {
    throw new Error(body.message || "Unable to verify Paystack payment");
  }
  return body.data;
}

export async function verifyPaystackPayment(reference: string) {
  const safeReference = reference.trim().slice(0, 160);
  const [row] = await db
    .select({ payment: billingPayments, invoice: billingInvoices })
    .from(billingPayments)
    .innerJoin(billingInvoices, and(
      eq(billingInvoices.id, billingPayments.invoiceId),
      eq(billingInvoices.organizationId, billingPayments.organizationId),
    ))
    .where(and(
      eq(billingPayments.provider, "paystack"),
      eq(billingPayments.reference, safeReference),
    ))
    .limit(1);
  if (!row) throw new Error("Payment reference not found");

  if (row.payment.status === "success" && row.invoice.status === "paid") {
    return { status: "success" as const, invoice: row.invoice, payment: row.payment };
  }

  const provider = await fetchPaystackVerification(safeReference);
  const status = provider.status || "unknown";
  if (status !== "success") {
    await db
      .update(billingPayments)
      .set({
        status: status === "reversed" ? "reversed" : status === "failed" ? "failed" : "pending",
        failureReason: status === "failed" ? (provider.gateway_response || "Payment failed").slice(0, 500) : null,
        updatedAt: new Date(),
      })
      .where(eq(billingPayments.id, row.payment.id));
    return { status, invoice: row.invoice, payment: row.payment };
  }

  const expectedCents = moneyToCents(String(row.invoice.total));
  if (BigInt(provider.amount || 0) !== expectedCents) {
    throw new Error("Verified Paystack amount does not match the invoice");
  }
  if (sanitizeCurrency(provider.currency || "") !== sanitizeCurrency(row.invoice.currency)) {
    throw new Error("Verified Paystack currency does not match the invoice");
  }
  if (provider.reference !== safeReference) throw new Error("Verified Paystack reference does not match");

  const paidAt = provider.paid_at ? new Date(provider.paid_at) : new Date();
  const settled = await db.transaction((tx) => settleSuccessfulPayment(tx, {
    paymentId: row.payment.id,
    invoiceId: row.invoice.id,
    providerTransactionId: provider.id === undefined ? null : String(provider.id).slice(0, 100),
    channel: provider.channel?.slice(0, 80) || null,
    paidAt: Number.isNaN(paidAt.getTime()) ? new Date() : paidAt,
    providerMetadata: safeProviderMetadata(provider),
  }));

  return { status: "success" as const, invoice: settled.invoice, payment: settled.payment };
}

export async function processPaystackWebhook(rawBody: string, signature: string | null) {
  const key = paystackKey();
  if (!key) throw new Error("Paystack is not configured for this deployment");
  if (!signature || !/^[a-f0-9]{128}$/i.test(signature)) throw new Error("Invalid Paystack signature");

  const expected = createHmac("sha512", key).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(signature, "hex");
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    throw new Error("Invalid Paystack signature");
  }

  const event = JSON.parse(rawBody) as {
    event?: string;
    data?: PaystackVerifyResponse["data"];
  };
  if (event.event !== "charge.success") {
    return { accepted: true, processed: false, event: event.event || "unknown" };
  }

  const reference = event.data?.reference?.trim() || "";
  if (!reference) throw new Error("Paystack webhook is missing a transaction reference");

  const [row] = await db
    .select({ payment: billingPayments, invoice: billingInvoices })
    .from(billingPayments)
    .innerJoin(billingInvoices, and(
      eq(billingInvoices.id, billingPayments.invoiceId),
      eq(billingInvoices.organizationId, billingPayments.organizationId),
    ))
    .where(and(
      eq(billingPayments.provider, "paystack"),
      eq(billingPayments.reference, reference),
    ))
    .limit(1);
  if (!row) throw new Error("Webhook payment reference is not recognized");

  const expectedCents = moneyToCents(String(row.invoice.total));
  if (BigInt(event.data?.amount || 0) !== expectedCents) throw new Error("Webhook amount does not match invoice");
  if (sanitizeCurrency(event.data?.currency || "") !== sanitizeCurrency(row.invoice.currency)) {
    throw new Error("Webhook currency does not match invoice");
  }

  const payloadHash = createHash("sha256").update(rawBody).digest("hex");
  const eventId = createHash("sha256").update(`paystack:${payloadHash}`).digest("hex");
  const paidAt = event.data?.paid_at ? new Date(event.data.paid_at) : new Date();

  const outcome = await db.transaction(async (tx) => {
    const [insertedEvent] = await tx
      .insert(billingWebhookEvents)
      .values({
        id: eventId,
        organizationId: row.invoice.organizationId,
        provider: "paystack",
        eventType: "charge.success",
        reference,
        payloadHash,
      })
      .onConflictDoNothing()
      .returning({ id: billingWebhookEvents.id });

    if (!insertedEvent) {
      return { duplicate: true, invoice: row.invoice, payment: row.payment };
    }

    const settled = await settleSuccessfulPayment(tx, {
      paymentId: row.payment.id,
      invoiceId: row.invoice.id,
      providerTransactionId: event.data?.id === undefined ? null : String(event.data.id).slice(0, 100),
      channel: event.data?.channel?.slice(0, 80) || null,
      paidAt: Number.isNaN(paidAt.getTime()) ? new Date() : paidAt,
      providerMetadata: safeProviderMetadata(event.data),
    });
    return { duplicate: false, ...settled };
  });

  return { accepted: true, processed: !outcome.duplicate, duplicate: outcome.duplicate };
}

export function newManualPaymentReference() {
  return `MANUAL-${randomBytes(12).toString("hex").toUpperCase()}`;
}
