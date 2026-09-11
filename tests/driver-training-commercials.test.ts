import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  calculateQuotationTotals,
  canTransitionTrainingQuotation,
  quotationApprovalReady,
  quotationIsAcceptedAndValid,
  quotationLineTotal,
  trainingQuotationCreateSchema,
  trainingQuotationItemSchema,
} from "../src/lib/training-commercial-policy";

test("quotation policy validates currency, expiry and line values", () => {
  const requestId = "d34db33f-0000-4000-8000-000000000030";
  assert.equal(trainingQuotationCreateSchema.safeParse({ requestId, currency: "GHS", validUntil: "2026-10-31", discountAmount: 0, taxRate: 15 }).success, true);
  assert.equal(trainingQuotationCreateSchema.safeParse({ requestId, currency: "GH", validUntil: "2026-10-31", discountAmount: 0, taxRate: 15 }).success, false);
  assert.equal(trainingQuotationItemSchema.safeParse({ quotationId: requestId, itemType: "training_fee", description: "Defensive Driving Training", quantity: 20, unitPrice: 250 }).success, true);
  assert.equal(trainingQuotationItemSchema.safeParse({ quotationId: requestId, itemType: "training_fee", description: "X", quantity: 0, unitPrice: 250 }).success, false);
});

test("quotation totals calculate line totals, discount, tax and final amount deterministically", () => {
  assert.equal(quotationLineTotal(3, 10.125), 30.38);
  const totals = calculateQuotationTotals([{ quantity: 20, unitPrice: 250 }, { quantity: 1, unitPrice: 500 }], 500, 15);
  assert.deepEqual(totals, { subtotal: 5500, discountAmount: 500, taxRate: 15, taxAmount: 750, totalAmount: 5750 });
  assert.throws(() => calculateQuotationTotals([{ quantity: 1, unitPrice: 100 }], 101, 0), /discount cannot exceed subtotal/i);
});

test("quotation lifecycle separates preparation, approval, sending and client decision", () => {
  assert.equal(canTransitionTrainingQuotation("draft", "pending_approval"), true);
  assert.equal(canTransitionTrainingQuotation("pending_approval", "approved"), true);
  assert.equal(canTransitionTrainingQuotation("approved", "sent"), true);
  assert.equal(canTransitionTrainingQuotation("sent", "accepted"), true);
  assert.equal(canTransitionTrainingQuotation("sent", "rejected"), true);
  assert.equal(canTransitionTrainingQuotation("accepted", "sent"), false);
  assert.equal(canTransitionTrainingQuotation("rejected", "draft"), false);
});

test("quotation approval and delivery authorization require priced, valid records", () => {
  const now = new Date("2026-09-11T12:00:00Z");
  assert.equal(quotationApprovalReady({ itemCount: 1, totalAmount: 1000, validUntil: "2026-09-30", now }), true);
  assert.equal(quotationApprovalReady({ itemCount: 0, totalAmount: 1000, validUntil: "2026-09-30", now }), false);
  assert.equal(quotationApprovalReady({ itemCount: 1, totalAmount: 1000, validUntil: "2026-09-10", now }), false);
  assert.equal(quotationIsAcceptedAndValid({ status: "accepted", validUntil: "2026-09-30", now }), true);
  assert.equal(quotationIsAcceptedAndValid({ status: "sent", validUntil: "2026-09-30", now }), false);
  assert.equal(quotationIsAcceptedAndValid({ status: "accepted", validUntil: "2026-09-10", now }), false);
});

test("commercial actions serialize quote edits and preserve controlled client acceptance", () => {
  const source = readFileSync("src/app/driver-training/commercials/actions.ts", "utf8");
  assert.match(source, /pg_advisory_xact_lock\(hashtext/);
  assert.match(source, /Quotation line items can only be edited while the quotation is draft/);
  assert.match(source, /resolve or supersede the current active quotation/i);
  assert.match(source, /Client acceptance requires the accepting person's name/);
  assert.match(source, /Expired quotations cannot be accepted/);
  assert.match(source, /This training request already has an accepted quotation/);
  assert.match(source, /logAudit/);
});

test("commercial migration enforces accepted-quote uniqueness and client scheduling authorization", () => {
  const migration = readFileSync("migrations/20260911_driver_training_commercials.sql", "utf8");
  assert.match(migration, /training_quotation_amount_chk/);
  assert.match(migration, /training_quotation_one_accepted_request_uidx/);
  assert.match(migration, /WHERE status = 'accepted'/);
  assert.match(migration, /enforce_training_request_commercial_authorization/);
  assert.match(migration, /accepted, valid quotation before scheduling/);
  assert.match(migration, /q\.valid_until >= CURRENT_DATE/);
});

test("enterprise migration runner and verifier include commercial objects", () => {
  const runner = readFileSync("scripts/apply-enterprise-upgrade.mjs", "utf8");
  const verifier = readFileSync("scripts/verify-enterprise-upgrade.mjs", "utf8");
  assert.match(runner, /20260911_driver_training_commercials\.sql/);
  assert.match(verifier, /training_quotations/);
  assert.match(verifier, /training_quotation_items/);
  assert.match(verifier, /training_quotation_one_accepted_request_uidx/);
});

test("Driver Training navigation exposes commercial workspace and delivery authorization language", () => {
  const layout = readFileSync("src/app/driver-training/layout.tsx", "utf8");
  const page = readFileSync("src/app/driver-training/commercials/page.tsx", "utf8");
  assert.match(layout, /\/driver-training\/commercials/);
  assert.match(page, /Training Commercials & Quotations/);
  assert.match(page, /cannot be scheduled until a quotation is accepted/);
  assert.match(page, /Acceptance authorizes delivery but does not create the training session/);
});
