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
