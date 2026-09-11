import { z } from "zod";

export const TRAINING_QUOTATION_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "sent",
  "accepted",
  "rejected",
  "expired",
  "cancelled",
  "superseded",
] as const;

export const TRAINING_QUOTATION_ITEM_TYPES = [
  "training_fee",
  "assessment",
  "certificate",
  "logistics",
  "materials",
  "travel",
  "accommodation",
  "equipment",
  "other",
] as const;

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || undefined);
const optionalEmail = z.string().trim().max(200).optional().or(z.literal("")).transform((value) => value || undefined).refine(
  (value) => !value || z.string().email().safeParse(value).success,
  "Enter a valid email address"
);

export const trainingQuotationCreateSchema = z.object({
  requestId: z.string().uuid(),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code").default("GHS"),
  validUntil: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid quotation expiry date"),
  discountAmount: z.coerce.number().min(0).max(100000000).default(0),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  terms: optionalText(8000),
  notes: optionalText(4000),
});

export const trainingQuotationItemSchema = z.object({
  quotationId: z.string().uuid(),
  itemType: z.enum(TRAINING_QUOTATION_ITEM_TYPES),
  description: z.string().trim().min(2).max(500),
  quantity: z.coerce.number().positive().max(1000000),
  unitPrice: z.coerce.number().min(0).max(100000000),
});

export const trainingQuotationTransitionSchema = z.object({
  quotationId: z.string().uuid(),
  status: z.enum(TRAINING_QUOTATION_STATUSES),
  decisionNotes: optionalText(4000),
  acceptedByName: optionalText(200),
  acceptedByEmail: optionalEmail,
});

const ALLOWED_TRANSITIONS: Record<string, ReadonlySet<string>> = {
  draft: new Set(["pending_approval", "cancelled"]),
  pending_approval: new Set(["draft", "approved", "cancelled"]),
  approved: new Set(["sent", "cancelled", "superseded"]),
  sent: new Set(["accepted", "rejected", "expired", "cancelled"]),
  accepted: new Set(),
  rejected: new Set(),
  expired: new Set(),
  cancelled: new Set(),
  superseded: new Set(),
};

export function canTransitionTrainingQuotation(fromStatus: string, toStatus: string) {
  if (fromStatus === toStatus) return false;
  return ALLOWED_TRANSITIONS[fromStatus]?.has(toStatus) ?? false;
}

export function trainingQuotationValidationMessage(error: z.ZodError) {
  return error.issues.slice(0, 4).map((issue) => issue.message).join("; ") || "Invalid training quotation data";
}

export function quotationLineTotal(quantity: number, unitPrice: number) {
  return Math.round(quantity * unitPrice * 100) / 100;
}

export function calculateQuotationTotals(
  lines: Array<{ quantity: number; unitPrice: number }>,
  discountAmount: number,
  taxRate: number,
) {
  const subtotal = Math.round(lines.reduce((sum, line) => sum + quotationLineTotal(line.quantity, line.unitPrice), 0) * 100) / 100;
  const normalizedDiscount = Math.round(discountAmount * 100) / 100;
  if (!Number.isFinite(subtotal) || subtotal < 0) throw new Error("Invalid quotation subtotal");
  if (!Number.isFinite(normalizedDiscount) || normalizedDiscount < 0 || normalizedDiscount > subtotal) {
    throw new Error("Quotation discount cannot exceed subtotal");
  }
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) throw new Error("Invalid quotation tax rate");
  const taxable = Math.round((subtotal - normalizedDiscount) * 100) / 100;
  const taxAmount = Math.round(taxable * taxRate) / 100;
  const totalAmount = Math.round((taxable + taxAmount) * 100) / 100;
  return { subtotal, discountAmount: normalizedDiscount, taxRate, taxAmount, totalAmount };
}

export function quotationApprovalReady(input: {
  itemCount: number;
  totalAmount: number;
  validUntil: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const expiry = new Date(`${input.validUntil}T23:59:59.999Z`);
  return input.itemCount > 0 && input.totalAmount > 0 && Number.isFinite(expiry.getTime()) && expiry.getTime() >= now.getTime();
}

export function quotationIsAcceptedAndValid(input: {
  status: string;
  validUntil: string;
  now?: Date;
}) {
  if (input.status !== "accepted") return false;
  const now = input.now ?? new Date();
  const expiry = new Date(`${input.validUntil}T23:59:59.999Z`);
  return Number.isFinite(expiry.getTime()) && expiry.getTime() >= now.getTime();
}
