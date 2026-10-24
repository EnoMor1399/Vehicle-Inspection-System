import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  approvedPaystackCheckout,
  validatedPaystackCredentials,
} from "../src/lib/paystack-runtime";

const testKey = "sk_test_fixture_not_a_real_key";
const liveKey = "sk_live_fixture_not_a_real_key";

test("VIMS accepts matching Paystack test credentials with live charges disabled", () => {
  const configured = approvedPaystackCheckout({
    mode: "test",
    secretKey: testKey,
    livePaymentsEnabled: "false",
  });
  assert.equal(configured.mode, "test");
});

test("VIMS refuses live Paystack charges by default", () => {
  for (const setting of [undefined, "", "false", "TRUE", "1"]) {
    assert.throws(
      () => approvedPaystackCheckout({
        mode: "live",
        secretKey: liveKey,
        livePaymentsEnabled: setting,
      }),
      /Live Paystack checkout is disabled/,
    );
  }
});

test("VIMS requires both matching live key and explicit approval before a new checkout", () => {
  const enabled = approvedPaystackCheckout({
    mode: "live",
    secretKey: liveKey,
    livePaymentsEnabled: "true",
  });
  assert.equal(enabled.mode, "live");
  for (const input of [
    { mode: "test", secretKey: liveKey },
    { mode: "live", secretKey: testKey },
    { mode: "live", secretKey: "sk_live_" },
    { mode: "sandbox", secretKey: testKey },
    { mode: "test", secretKey: undefined },
  ]) {
    assert.throws(
      () => approvedPaystackCheckout({ ...input, livePaymentsEnabled: "true" }),
      /Paystack (?:credentials|mode)/,
    );
  }
});

test("Pausing live checkout does not disable verification credentials", () => {
  const verified = validatedPaystackCredentials({
    mode: "live",
    secretKey: liveKey,
    livePaymentsEnabled: "false",
  });
  assert.equal(verified.mode, "live");
});

test("Live approval is checked before creating a Paystack checkout, not before requerying settlement", () => {
  const payment = readFileSync("src/lib/paystack-payments.ts", "utf8");
  const webhook = readFileSync("src/app/api/payments/paystack/webhook/route.ts", "utf8");
  const start = payment.indexOf("export async function initializePaystack(");
  const verify = payment.indexOf("export async function verifyAndRecordPayment(");
  assert.ok(start > 0 && verify > start);
  assert.match(payment.slice(start, verify), /requireCheckoutApproval\(\)/);
  assert.doesNotMatch(payment.slice(verify), /requireCheckoutApproval\(\)/);
  assert.match(webhook, /validatedPaystackCredentials\(/);
  assert.match(webhook, /verifyPaystackSignature\(/);
  assert.match(webhook, /verifyAndRecordPayment\(/);
  assert.doesNotMatch(webhook, /PAYSTACK_LIVE_PAYMENTS_ENABLED/);
});

test("Only card and Ghana mobile money are offered through hosted checkout", () => {
  const payment = readFileSync("src/lib/paystack-payments.ts", "utf8");
  assert.match(payment, /type CheckoutChannel = "card" \| "mobile_money"/);
  assert.match(payment, /currency: "GHS"/);
  assert.match(payment, /channels: \[input.channel\]/);
  assert.match(payment, /destination.hostname !== "checkout.paystack.com"/);
});
