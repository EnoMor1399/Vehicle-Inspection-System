import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculateAnnualPlanPrice } from "../src/lib/subscription-plan-pricing";

const read = (path: string) => readFileSync(path, "utf8");
const plan = {
  price: "50.00",
  billingCycle: "monthly" as const,
  currency: "GHS",
  annualDiscountPercent: 0,
  promoDiscountPercent: 0,
  promoLabel: null,
  promoStartsOn: null,
  promoEndsOn: null,
};

test("annual invoice is calculated automatically from 12 monthly periods, in pesewas", () => {
  const result = calculateAnnualPlanPrice(plan, new Date("2026-11-04T12:00:00.000Z"));
  assert.ok(result);
  assert.equal(result.baseAnnualPrice, "600.00");
  assert.equal(result.annualPrice, "600.00");
  assert.equal(result.savingsMinor, 0);
  assert.equal(result.monthlyMinor, 5000);
});

test("annual discount and scheduled promotion compound sequentially, without floating point drift", () => {
  const modified = { ...plan, annualDiscountPercent: 10, promoDiscountPercent: 20, promoLabel: "Year-end offer",
    promoStartsOn: "2026-11-01", promoEndsOn: "2026-11-30" };
  const result = calculateAnnualPlanPrice(modified, new Date("2026-11-04T00:00:00.000Z"));
  assert.ok(result);
  assert.equal(result.baseAnnualPrice, "600.00");
  assert.equal(result.annualPrice, "432.00");
  assert.equal(result.savingsPrice, "168.00");
  assert.equal(result.activePromoPercent, 20);
  assert.equal(result.activePromoLabel, "Year-end offer");
  const before = calculateAnnualPlanPrice(modified, new Date("2026-10-31T23:59:59.000Z"));
  const after = calculateAnnualPlanPrice(modified, new Date("2026-12-01T00:00:00.000Z"));
  assert.equal(before?.annualPrice, "540.00");
  assert.equal(after?.annualPrice, "540.00");
});

test("cent rounding and promo period end are deterministic", () => {
  const result = calculateAnnualPlanPrice({ ...plan, price: "0.99", annualDiscountPercent: 15,
    promoDiscountPercent: 10, promoLabel: null, promoStartsOn: null, promoEndsOn: "2026-11-04" },
    new Date("2026-11-04T23:59:59.000Z"));
  assert.equal(result?.baseAnnualPrice, "11.88");
  assert.equal(result?.annualPrice, "9.09");
  assert.equal(result?.activePromoLabel, "Limited-time promotion");
});

test("custom prices and annual-only legacy catalogue plans are not multiplied again", () => {
  assert.equal(calculateAnnualPlanPrice({ ...plan, price: "0.00" }), null);
  assert.equal(calculateAnnualPlanPrice({ ...plan, billingCycle: "custom" }), null);
  assert.equal(calculateAnnualPlanPrice({ ...plan, billingCycle: "annual" }), null);
});

test("rejects invalid price syntax, out-of-range annual discounts or oversized calculations", () => {
  assert.throws(() => calculateAnnualPlanPrice({ ...plan, price: "not a number" }));
  assert.throws(() => calculateAnnualPlanPrice({ ...plan, annualDiscountPercent: 91 }));
  assert.throws(() => calculateAnnualPlanPrice({ ...plan, promoDiscountPercent: -1 }));
  assert.throws(() => calculateAnnualPlanPrice({ ...plan, promoDiscountPercent: 9.5 }));
});

test("annual offers are Super Admin controlled, audited and do not retroactively rewrite payments", () => {
  const schema = read("src/db/schema.ts");
  const action = read("src/app/platform/payments/actions.ts");
  const view = read("src/app/platform/payments/PlanPricingForm.tsx");
  const page = read("src/app/platform/payments/page.tsx");
  assert.match(schema, /annualDiscountPercent: integer\("annual_discount_percent"\)/);
  assert.match(schema, /promoDiscountPercent: integer\("promo_discount_percent"\)/);
  assert.match(schema, /requestedBillingCycle: billingCycleEnum/);
  assert.match(schema, /billingCycle: billingCycleEnum\("billing_cycle"\)/);
  assert.match(action, /requirePlatformSuperAdmin\(\)/);
  assert.match(action, /calculateAnnualPlanPrice\(nextOffer\)/);
  assert.match(action, /required: true/);
  assert.match(action, /revalidatePath\("\/welcome"\)/);
  assert.doesNotMatch(action.slice(action.indexOf("export async function updateSubscriptionPlanPricing")), /update\(subscriptionPayments\)/);
  assert.match(view, /name="annualDiscountPercent"/);
  assert.match(view, /name="promoDiscountPercent"/);
  assert.match(view, /name="promoStartsOn"/);
  assert.match(view, /name="promoEndsOn"/);
  assert.match(page, /promoLabel: plan.promoLabel/);
});

test("annual terms persist through request and Super Admin approval with payment-in-flight safeguards", () => {
  const request = read("src/app/subscribe/actions.ts");
  const dataPlane = read("src/lib/organization-control-plane.ts");
  const admin = read("src/app/platform/organizations/actions.ts");
  const landing = read("src/components/marketing/VimsLandingPage.tsx");
  const migration = read("migrations/20261104_subscription_annual_pricing_promotions.sql");
  assert.match(request, /requestedBillingCycle: parsed.data.requestedBillingCycle/);
  assert.match(dataPlane, /requestedBillingCycle: input.requestedBillingCycle/);
  assert.match(dataPlane, /amount: billedAmount/);
  assert.match(dataPlane, /billingCycle,/);
  assert.match(dataPlane, /input.useCatalogPrice/);
  assert.match(dataPlane, /unresolved subscription payment exists/);
  assert.match(admin, /useCatalogPrice: parsed.data.useCatalogPrice === "true"/);
  assert.match(landing, /calculateAnnualPlanPrice\(plan\)/);
  assert.match(migration, /ALTER TABLE subscription_plans/);
  assert.match(migration, /ALTER TABLE organization_onboarding_requests/);
  assert.match(migration, /ALTER TABLE organization_subscriptions/);
});
