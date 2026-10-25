-- Super Admin approval is mandatory before an organization can start a
-- NEW Paystack subscription checkout. Existing in-flight transactions
-- continue to settle via the signed webhook and Paystack verification API.
-- Existing subscriptions default to disabled deliberately (fail closed).
-- Apply this additive migration to a verified staging database BEFORE
-- deploying source code that selects organization_subscriptions.checkout_enabled.
ALTER TABLE organization_subscriptions
  ADD COLUMN IF NOT EXISTS checkout_enabled boolean NOT NULL DEFAULT false;
