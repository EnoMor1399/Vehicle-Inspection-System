"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { trainingQuotationItems, trainingQuotations } from "@/db/training-commercial-schema";
import { trainingRequests } from "@/db/training-request-schema";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { canManageTraining } from "@/lib/training-access";
import {
  calculateQuotationTotals,
  canTransitionTrainingQuotation,
  quotationApprovalReady,
  quotationIsAcceptedAndValid,
  quotationLineTotal,
  trainingQuotationCreateSchema,
  trainingQuotationItemSchema,
  trainingQuotationPricingSchema,
  trainingQuotationTransitionSchema,
  trainingQuotationValidationMessage,
} from "@/lib/training-commercial-policy";
import { newId } from "@/lib/utils";

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function refreshCommercialPaths() {
  revalidatePath("/driver-training");
  revalidatePath("/driver-training/requests");
  revalidatePath("/driver-training/commercials");
}

async function requireTrainingManager() {
  const user = await getCurrentUser();
  if (!canManageTraining(user)) throw new Error("You do not have permission to manage Driver Training commercial records");
  return user;
}

async function recalculateQuotation(tx: typeof db, quotationId: string, discountAmount: number, taxRate: number) {
  const lines = await tx.select().from(trainingQuotationItems).where(eq(trainingQuotationItems.quotationId, quotationId));
  const totals = calculateQuotationTotals(
    lines.map((line) => ({ quantity: Number(line.quantity), unitPrice: Number(line.unitPrice) })),
    discountAmount,
    taxRate,
  );
  await tx.update(trainingQuotations).set({
    subtotal: totals.subtotal.toFixed(2),
    discountAmount: totals.discountAmount.toFixed(2),
    taxRate: totals.taxRate.toFixed(3),
    taxAmount: totals.taxAmount.toFixed(2),
    totalAmount: totals.totalAmount.toFixed(2),
    updatedAt: new Date(),
  }).where(eq(trainingQuotations.id, quotationId));
  return { totals, itemCount: lines.length };
}

export async function createTrainingQuotation(formData: FormData) {
  const user = await requireTrainingManager();
  const parsed = trainingQuotationCreateSchema.safeParse({
    requestId: field(formData, "requestId"),
    currency: field(formData, "currency") || "GHS",
    validUntil: field(formData, "validUntil"),
    terms: field(formData, "terms"),
    notes: field(formData, "notes"),
  });
  if (!parsed.success) throw new Error(trainingQuotationValidationMessage(parsed.error));
  const data = parsed.data;

  const id = newId();
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${data.requestId}))`);
    const [request] = await tx.select().from(trainingRequests).where(eq(trainingRequests.id, data.requestId)).limit(1);
    if (!request) return { ok: false as const, error: "Training request not found" };
    if (request.requestType !== "client") return { ok: false as const, error: "Internal training requests do not require a client quotation" };
    if (request.status !== "approved" || request.scheduledSessionId) {
      return { ok: false as const, error: "Only approved, unscheduled client requests can receive quotations" };
    }

    const existing = await tx.select().from(trainingQuotations).where(eq(trainingQuotations.requestId, request.id));
    if (existing.some((quote) => ["draft", "pending_approval", "approved", "sent", "accepted"].includes(quote.status))) {
      return { ok: false as const, error: "Resolve or supersede the current active quotation before creating another version" };
    }
    const versionNumber = existing.reduce((max, quote) => Math.max(max, quote.versionNumber), 0) + 1;
    const quotationNumber = `TQT-${new Date().getUTCFullYear()}-${id.slice(0, 8).toUpperCase()}-V${versionNumber}`;
    const values = {
      id,
      quotationNumber,
      requestId: request.id,
      versionNumber,
      currency: data.currency,
      status: "draft",
      validUntil: data.validUntil,
      subtotal: "0.00",
      discountAmount: "0.00",
      taxRate: "0.000",
      taxAmount: "0.00",
      totalAmount: "0.00",
      terms: data.terms || null,
      notes: data.notes || null,
      preparedBy: user.id,
      updatedAt: new Date(),
    } as const;
    await tx.insert(trainingQuotations).values(values);
    return { ok: true as const, request, values };
  });

  if (!result.ok) throw new Error(result.error);
  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "create",
    entityType: "training_quotation",
    entityId: id,
    entityLabel: result.values.quotationNumber,
    summary: `Created quotation ${result.values.quotationNumber} for ${result.request.requestNumber}`,
    after: result.values,
  });
  refreshCommercialPaths();
}

export async function updateTrainingQuotationPricing(formData: FormData) {
  const user = await requireTrainingManager();
  const parsed = trainingQuotationPricingSchema.safeParse({
    quotationId: field(formData, "quotationId"),
    validUntil: field(formData, "validUntil"),
    discountAmount: field(formData, "discountAmount") || "0",
    taxRate: field(formData, "taxRate") || "0",
  });
  if (!parsed.success) throw new Error(trainingQuotationValidationMessage(parsed.error));
  const data = parsed.data;

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${data.quotationId}))`);
    const [quote] = await tx.select().from(trainingQuotations).where(eq(trainingQuotations.id, data.quotationId)).limit(1);
    if (!quote) return { ok: false as const, error: "Training quotation not found" };
    if (quote.status !== "draft") return { ok: false as const, error: "Quotation pricing can only be changed while the quotation is draft" };
    const recalculated = await recalculateQuotation(tx as unknown as typeof db, quote.id, data.discountAmount, data.taxRate);
    await tx.update(trainingQuotations).set({ validUntil: data.validUntil, updatedAt: new Date() }).where(eq(trainingQuotations.id, quote.id));
    return { ok: true as const, quote, totals: recalculated.totals };
  });
  if (!result.ok) throw new Error(result.error);

  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "update",
    entityType: "training_quotation",
    entityId: result.quote.id,
    entityLabel: result.quote.quotationNumber,
    summary: `Updated pricing controls for ${result.quote.quotationNumber}`,
    before: { validUntil: result.quote.validUntil, discountAmount: result.quote.discountAmount, taxRate: result.quote.taxRate },
    after: { validUntil: data.validUntil, discountAmount: result.totals.discountAmount, taxRate: result.totals.taxRate },
  });
  refreshCommercialPaths();
}

export async function addTrainingQuotationItem(formData: FormData) {
  const user = await requireTrainingManager();
  const parsed = trainingQuotationItemSchema.safeParse({
    quotationId: field(formData, "quotationId"),
    itemType: field(formData, "itemType"),
    description: field(formData, "description"),
    quantity: field(formData, "quantity"),
    unitPrice: field(formData, "unitPrice"),
  });
  if (!parsed.success) throw new Error(trainingQuotationValidationMessage(parsed.error));
  const data = parsed.data;
  const itemId = newId();

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${data.quotationId}))`);
    const [quote] = await tx.select().from(trainingQuotations).where(eq(trainingQuotations.id, data.quotationId)).limit(1);
    if (!quote) return { ok: false as const, error: "Training quotation not found" };
    if (quote.status !== "draft") return { ok: false as const, error: "Quotation line items can only be edited while the quotation is draft" };
    const lineTotal = quotationLineTotal(data.quantity, data.unitPrice);
    await tx.insert(trainingQuotationItems).values({
      id: itemId,
      quotationId: quote.id,
      itemType: data.itemType,
      description: data.description,
      quantity: data.quantity.toFixed(2),
      unitPrice: data.unitPrice.toFixed(2),
      lineTotal: lineTotal.toFixed(2),
    });
    const recalculated = await recalculateQuotation(tx as unknown as typeof db, quote.id, Number(quote.discountAmount), Number(quote.taxRate));
    return { ok: true as const, quote, lineTotal, totals: recalculated.totals };
  });
  if (!result.ok) throw new Error(result.error);

  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "create",
    entityType: "training_quotation_item",
    entityId: itemId,
    entityLabel: result.quote.quotationNumber,
    summary: `Added line item to ${result.quote.quotationNumber}`,
    after: { itemType: data.itemType, description: data.description, quantity: data.quantity, unitPrice: data.unitPrice, lineTotal: result.lineTotal },
  });
  refreshCommercialPaths();
}

export async function removeTrainingQuotationItem(formData: FormData) {
  const user = await requireTrainingManager();
  const itemId = field(formData, "itemId");
  if (!/^[0-9a-f-]{36}$/i.test(itemId)) throw new Error("Invalid quotation line item");

  const result = await db.transaction(async (tx) => {
    const [item] = await tx.select().from(trainingQuotationItems).where(eq(trainingQuotationItems.id, itemId)).limit(1);
    if (!item) return { ok: false as const, error: "Quotation line item not found" };
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${item.quotationId}))`);
    const [quote] = await tx.select().from(trainingQuotations).where(eq(trainingQuotations.id, item.quotationId)).limit(1);
    if (!quote) return { ok: false as const, error: "Training quotation not found" };
    if (quote.status !== "draft") return { ok: false as const, error: "Quotation line items can only be edited while the quotation is draft" };
    await tx.delete(trainingQuotationItems).where(eq(trainingQuotationItems.id, item.id));
    await recalculateQuotation(tx as unknown as typeof db, quote.id, Number(quote.discountAmount), Number(quote.taxRate));
    return { ok: true as const, quote, item };
  });
  if (!result.ok) throw new Error(result.error);

  await logAudit({
    userId: user.id,
    userName: user.name,
    action: "delete",
    entityType: "training_quotation_item",
    entityId: itemId,
    entityLabel: result.quote.quotationNumber,
    summary: `Removed line item from ${result.quote.quotationNumber}`,
    before: result.item,
  });
  refreshCommercialPaths();
}

export async function transitionTrainingQuotation(formData: FormData) {
  const user = await requireTrainingManager();
  const parsed = trainingQuotationTransitionSchema.safeParse({
    quotationId: field(formData, "quotationId"),
    status: field(formData, "status"),
    decisionNotes: field(formData, "decisionNotes"),
    acceptedByName: field(formData, "acceptedByName"),
    acceptedByEmail: field(formData, "acceptedByEmail"),
  });
  if (!parsed.success) throw new Error(trainingQuotationValidationMessage(parsed.error));
  const data = parsed.data;

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${data.quotationId}))`);
    const [quote] = await tx.select().from(trainingQuotations).where(eq(trainingQuotations.id, data.quotationId)).limit(1);
    if (!quote) return { ok: false as const, error: "Training quotation not found" };
    if (!canTransitionTrainingQuotation(quote.status, data.status)) {
      return { ok: false as const, error: `Quotation cannot move from ${quote.status} to ${data.status}` };
    }
    const items = await tx.select().from(trainingQuotationItems).where(eq(trainingQuotationItems.quotationId, quote.id));
    const totalAmount = Number(quote.totalAmount);
    const now = new Date();

    if (data.status === "pending_approval" || data.status === "approved") {
      if (!quotationApprovalReady({ itemCount: items.length, totalAmount, validUntil: quote.validUntil, now })) {
        return { ok: false as const, error: "Quotation requires at least one priced line, a positive total, and a future validity date before approval" };
      }
    }
    if (data.status === "accepted") {
      if (!data.acceptedByName) return { ok: false as const, error: "Client acceptance requires the accepting person's name" };
      if (!quotationIsAcceptedAndValid({ status: "accepted", validUntil: quote.validUntil, now })) {
        return { ok: false as const, error: "Expired quotations cannot be accepted" };
      }
      const [otherAccepted] = await tx.select({ id: trainingQuotations.id }).from(trainingQuotations).where(and(
        eq(trainingQuotations.requestId, quote.requestId),
        eq(trainingQuotations.status, "accepted"),
        ne(trainingQuotations.id, quote.id),
      )).limit(1);
      if (otherAccepted) return { ok: false as const, error: "This training request already has an accepted quotation" };
    }
    if (data.status === "rejected" && !data.decisionNotes) {
      return { ok: false as const, error: "Rejected quotations require client decision notes" };
    }
    if (data.status === "expired") {
      const expiry = new Date(`${quote.validUntil}T23:59:59.999Z`);
      if (expiry.getTime() >= now.getTime()) return { ok: false as const, error: "Quotation is still within its validity period" };
    }

    const patch = {
      status: data.status,
      approvedBy: data.status === "approved" ? user.id : quote.approvedBy,
      approvedAt: data.status === "approved" ? now : quote.approvedAt,
      sentAt: data.status === "sent" ? now : quote.sentAt,
      acceptedByName: data.status === "accepted" ? data.acceptedByName || null : quote.acceptedByName,
      acceptedByEmail: data.status === "accepted" ? data.acceptedByEmail?.toLowerCase() || null : quote.acceptedByEmail,
      acceptedAt: data.status === "accepted" ? now : quote.acceptedAt,
      clientDecisionNotes: data.decisionNotes || quote.clientDecisionNotes,
      updatedAt: now,
    } as const;
    await tx.update(trainingQuotations).set(patch).where(eq(trainingQuotations.id, quote.id));
    return { ok: true as const, quote, patch };
  });
  if (!result.ok) throw new Error(result.error);

  await logAudit({
    userId: user.id,
    userName: user.name,
    action: data.status === "approved" ? "approve" : data.status === "rejected" ? "reject" : "update",
    entityType: "training_quotation",
    entityId: result.quote.id,
    entityLabel: result.quote.quotationNumber,
    summary: `Changed quotation status from ${result.quote.status} to ${data.status}`,
    before: { status: result.quote.status },
    after: { status: data.status, decisionNotes: data.decisionNotes || null },
  });
  refreshCommercialPaths();
}
