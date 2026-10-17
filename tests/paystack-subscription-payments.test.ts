import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  matchesOriginalInvoice, toGhsPesewas, verifyPaystackSignature,
  type VerifiedPaystackTransaction,
} from "../src/lib/paystack-validation";

test("Paystack GHS amounts are exact integer pesewas, never client floating point", () => {
  assert.equal(toGhsPesewas("12.34"), 1234);
  assert.equal(toGhsPesewas("1"), 100);
  assert.equal(toGhsPesewas("0.01"), 1);
  assert.equal(toGhsPesewas("150.5"), 15050);
  for (const invalid of ["0", "0.00", "-1", "12.345", "1e5", "10,000", " NaN", "2.999", "9999999999", "0.001"]) {
    assert.throws(() => toGhsPesewas(invalid), invalid);
  }
});

test("Paystack webhook signature compares raw bytes and rejects tampering", () => {
  const key = "sk_test_example_not_a_real_credential";
  const raw = JSON.stringify({ event: "charge.success", data: { reference: "vims-aa" } });
  const signature = createHmac("sha512", key).update(raw).digest("hex");
  assert.equal(verifyPaystackSignature(raw, signature, key), true);
  assert.equal(verifyPaystackSignature(raw + " ", signature, key), false);
  assert.equal(verifyPaystackSignature(raw, signature.slice(2), key), false);
  assert.equal(verifyPaystackSignature(raw, "0".repeat(128), key), false);
  assert.equal(verifyPaystackSignature(raw, null, key), false);
  assert.equal(verifyPaystackSignature(raw, signature, key + "bad"), false);
});

test("server independently matches reference, payer, environment, currency and exact amount", () => {
  const input = { reference: "vims-00112233445566778899aabbccddeeff", amountSubunits: 24500, currency: "GHS", customerEmail: "owner@example.com", mode: "test" };
  const success: VerifiedPaystackTransaction = { id: 123, reference: input.reference, status: "success",
    amount: 24500, currency: "GHS", domain: "test", customer: { email: "OWNER@EXAMPLE.COM" } };
  assert.equal(matchesOriginalInvoice(success, input), true);
  assert.equal(matchesOriginalInvoice({ ...success, reference: "vims-wrong" }, input), false);
  assert.equal(matchesOriginalInvoice({ ...success, amount: 24501 }, input), false);
  assert.equal(matchesOriginalInvoice({ ...success, currency: "USD" }, input), false);
  assert.equal(matchesOriginalInvoice({ ...success, domain: "live" }, input), false);
  assert.equal(matchesOriginalInvoice({ ...success, customer: { email: "fraud@example.com" } }, input), false);
  assert.equal(matchesOriginalInvoice(null, input), false);
});

test("checkout enforces organization ownership and billed invoice amount", () => {
  const actions = readFileSync("src/app/organization/payments/actions.ts", "utf8");
  const provider = readFileSync("src/lib/paystack-payments.ts", "utf8");
  assert.match(actions, /user\.role !== "organization_owner"/);
  assert.match(actions, /user\.organizationId/);
  assert.match(actions, /current\.subscription\.amount/);
  assert.match(actions, /toGhsPesewas/);
  assert.match(actions, /pg_advisory_xact_lock/);
  assert.match(actions, /billingPeriodStart/);
  assert.match(actions, /This subscription billing period is already paid/);
  assert.match(provider, /PAYSTACK_LIVE_PAYMENTS_ENABLED/);
  assert.match(provider, /channels: \[input\.channel\]/);
  assert.match(provider, /checkout\.paystack\.com/);
});

test("webhook requires signed payload and independent gateway verification", () => {
  const webhook = readFileSync("src/app/api/payments/paystack/webhook/route.ts", "utf8");
  const provider = readFileSync("src/lib/paystack-payments.ts", "utf8");
  const schema = readFileSync("src/db/schema.ts", "utf8");
  const migration = readFileSync("migrations/20261017_subscription_payments_paystack.sql", "utf8");
  assert.match(webhook, /verifyPaystackSignature\(raw,/);
  assert.match(webhook, /verifyAndRecordPayment\(reference\)/);
  assert.match(webhook, /return NextResponse\.json\(\{ error: "Invalid signature" \}, \{ status: 401 \}\)/);
  assert.match(webhook, /Buffer\.byteLength\(raw\) > 32_768/);
  assert.match(provider, /matchesOriginalInvoice\(txn/);
  assert.match(provider, /status === "success"/);
  assert.match(provider, /pg_advisory_xact_lock/);
  assert.match(schema, /export const subscriptionPayments = pgTable/);
  assert.match(migration, /reference varchar\(90\) NOT NULL UNIQUE/);
  assert.match(readFileSync("scripts/apply-enterprise-upgrade.mjs", "utf8"), /20261017_subscription_payments_paystack\.sql/);
});
