-- An additive, no-credentials payment ledger with reference uniqueness and ownership FKs.
CREATE TABLE IF NOT EXISTS subscription_payments (
  id varchar(36) PRIMARY KEY,
  organization_id varchar(36) NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  subscription_id varchar(36) NOT NULL REFERENCES organization_subscriptions(id) ON DELETE RESTRICT,
  initiated_by varchar(36) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  provider varchar(24) NOT NULL DEFAULT 'paystack',
  reference varchar(90) NOT NULL UNIQUE,
  amount_subunits integer NOT NULL CHECK (amount_subunits > 0),
  currency varchar(3) NOT NULL DEFAULT 'GHS',
  channel varchar(20) NOT NULL CHECK (channel IN ('card', 'mobile_money')),
  status varchar(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'success', 'failed')),
  customer_email varchar(200) NOT NULL,
  gateway_transaction_id varchar(40),
  gateway_message varchar(240),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  paid_at timestamp
);
CREATE INDEX IF NOT EXISTS subscription_payment_org_created_idx
  ON subscription_payments (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS subscription_payment_subscription_idx
  ON subscription_payments (subscription_id);
CREATE INDEX IF NOT EXISTS subscription_payment_status_idx
  ON subscription_payments (status);
