-- PR #117: annual billing quotes and Super Admin discounts/promotions.
-- Additive, non-destructive. All existing plan promotions are off by default.
-- Run and verify on a Neon rehearsal branch before deploying an app that
-- selects these columns. No existing organization invoices are updated.
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS annual_discount_percent integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_discount_percent integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_label varchar(80),
  ADD COLUMN IF NOT EXISTS promo_starts_on date,
  ADD COLUMN IF NOT EXISTS promo_ends_on date;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vims_plan_annual_discount_range') THEN
    ALTER TABLE subscription_plans
      ADD CONSTRAINT vims_plan_annual_discount_range
      CHECK (annual_discount_percent BETWEEN 0 AND 90);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vims_plan_promo_discount_range') THEN
    ALTER TABLE subscription_plans
      ADD CONSTRAINT vims_plan_promo_discount_range
      CHECK (promo_discount_percent BETWEEN 0 AND 90);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vims_plan_promo_dates_order') THEN
    ALTER TABLE subscription_plans
      ADD CONSTRAINT vims_plan_promo_dates_order
      CHECK (promo_starts_on IS NULL OR promo_ends_on IS NULL OR promo_starts_on <= promo_ends_on);
  END IF;
END $$;

-- A billing cycle is chosen explicitly when subscribers request and receive
-- a plan; new requests default to monthly for backwards compatibility.
ALTER TABLE organization_onboarding_requests
  ADD COLUMN IF NOT EXISTS requested_billing_cycle billing_cycle NOT NULL DEFAULT 'monthly';

ALTER TABLE organization_subscriptions
  ADD COLUMN IF NOT EXISTS billing_cycle billing_cycle NOT NULL DEFAULT 'monthly';

-- Preserve existing explicitly annual plan assignments without changing any
-- existing invoice amount, payment, due date or paid period.
UPDATE organization_subscriptions AS subscription
SET billing_cycle = 'annual'
FROM subscription_plans AS plan
WHERE subscription.plan_id = plan.id
  AND plan.billing_cycle = 'annual'
  AND subscription.billing_cycle = 'monthly';
