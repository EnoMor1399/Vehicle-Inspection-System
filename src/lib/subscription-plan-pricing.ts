/**
 * Pricing shared by the public catalogue and Super Admin editor.
 * Calculations use integer minor units (pesewas for GHS) to avoid decimal
 * floating-point drift. This is a catalogue quote, never a payment invoice.
 */
export type PlanPricingInput = {
  price: string;
  billingCycle: "monthly" | "annual" | "custom";
  currency: string;
  annualDiscountPercent: number;
  promoDiscountPercent: number;
  promoLabel: string | null;
  promoStartsOn: string | null;
  promoEndsOn: string | null;
};

function priceToMinorUnits(price: string): number {
  if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(price)) {
    throw new Error("Invalid catalogue price.");
  }
  const [whole, fraction = ""] = price.split(".");
  const units = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(units)) throw new Error("Catalogue price is outside the supported range.");
  return units;
}

function validatedPercent(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 90) {
    throw new Error("Discount must be between 0% and 90%.");
  }
  return value;
}

export function priceFromMinorUnits(units: number) {
  if (!Number.isSafeInteger(units) || units < 0) throw new Error("Invalid calculated price.");
  return (units / 100).toFixed(2);
}

export function calculateAnnualPlanPrice(plan: PlanPricingInput, now = new Date()) {
  const monthlyMinor = priceToMinorUnits(String(plan.price));
  const annualDiscountPercent = validatedPercent(plan.annualDiscountPercent);
  const promoDiscountPercent = validatedPercent(plan.promoDiscountPercent);
  if (plan.billingCycle !== "monthly" || monthlyMinor === 0) {
    return null;
  }
  const baseAnnualMinor = monthlyMinor * 12;
  if (!Number.isSafeInteger(baseAnnualMinor)) throw new Error("Annual price exceeds safe limits.");
  const afterAnnualDiscount = Math.round(baseAnnualMinor * (100 - annualDiscountPercent) / 100);
  const todayUtc = now.toISOString().slice(0, 10);
  const promoActive = promoDiscountPercent > 0
    && (!plan.promoStartsOn || plan.promoStartsOn <= todayUtc)
    && (!plan.promoEndsOn || todayUtc <= plan.promoEndsOn);
  // Discounts stack in a transparent order: annual saving first, then promo
  // percentage on the remaining annual total. Both round to the nearest cent.
  const annualMinor = promoActive
    ? Math.round(afterAnnualDiscount * (100 - promoDiscountPercent) / 100)
    : afterAnnualDiscount;
  return {
    monthlyMinor,
    baseAnnualMinor,
    annualMinor,
    annualPrice: priceFromMinorUnits(annualMinor),
    baseAnnualPrice: priceFromMinorUnits(baseAnnualMinor),
    savingsMinor: baseAnnualMinor - annualMinor,
    savingsPrice: priceFromMinorUnits(baseAnnualMinor - annualMinor),
    annualDiscountPercent,
    activePromoPercent: promoActive ? promoDiscountPercent : 0,
    activePromoLabel: promoActive ? plan.promoLabel?.trim() || "Limited-time promotion" : null,
    currency: plan.currency,
  };
}
