import { createHmac, timingSafeEqual } from "node:crypto";

export function toGhsPesewas(amount: string) {
  if (!/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(amount)) throw new Error("Invalid subscription amount.");
  const [cedi, fraction = ""] = amount.split(".");
  const value = Number(cedi) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(value) || value <= 0 || value > 2_000_000_000) {
    throw new Error("This subscription amount cannot be paid through checkout.");
  }
  return value;
}

export function verifyPaystackSignature(rawBody: string, header: string | null, secret: string) {
  if (!header || !/^[a-fA-F0-9]{128}$/.test(header)) return false;
  const provided = Buffer.from(header, "hex");
  const computed = createHmac("sha512", secret).update(rawBody, "utf8").digest();
  return timingSafeEqual(provided, computed);
}

export type VerifiedPaystackTransaction = {
  id: number | string;
  reference: string;
  amount: number;
  currency: string;
  status: string;
  domain: string;
  customer?: { email?: string };
  gateway_response?: string;
};

export function matchesOriginalInvoice(txn: VerifiedPaystackTransaction | null | undefined, input: {
  reference: string;
  amountSubunits: number;
  currency: string;
  customerEmail: string;
  mode: string;
}) {
  return Boolean(txn
    && txn.reference === input.reference
    && txn.amount === input.amountSubunits
    && txn.currency === input.currency
    && txn.customer?.email?.toLowerCase() === input.customerEmail.toLowerCase()
    && txn.domain === input.mode);
}
