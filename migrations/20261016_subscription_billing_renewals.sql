-- VIMS subscription billing and renewal ledger.
-- Payment credentials and card data are not stored in these tables.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_invoice_status') THEN
    CREATE TYPE billing_invoice_status AS ENUM ('draft','open','paid','overdue','void');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_payment_status') THEN
    CREATE TYPE billing_payment_status AS ENUM ('pending','success','failed','reversed','refunded');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS billing_invoices (
  id varchar(36) PRIMARY KEY,
  organization_id varchar(36) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id varchar(36) NOT NULL REFERENCES organization_subscriptions(id) ON DELETE RESTRICT,
  invoice_number varchar(80) NOT NULL,
  status billing_invoice_status NOT NULL DEFAULT 'open',
  period_start timestamp NOT NULL,
  period_end timestamp,
  issued_at timestamp NOT NULL DEFAULT now(),
  due_at timestamp,
  subtotal numeric(12,2) NOT NULL,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  tax numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL,
  currency varchar(3) NOT NULL DEFAULT 'GHS',
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  paid_at timestamp,
  voided_at timestamp,
  created_by varchar(36),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT billing_invoice_amounts_chk CHECK (
    subtotal >= 0 AND discount >= 0 AND tax >= 0 AND total >= 0
    AND total = round((subtotal - discount + tax)::numeric, 2)
  ),
  CONSTRAINT billing_invoice_period_chk CHECK (period_end IS NULL OR period_end > period_start),
  CONSTRAINT billing_invoice_currency_chk CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE INDEX IF NOT EXISTS billing_invoice_organization_idx
  ON billing_invoices(organization_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS billing_invoice_organization_number_uidx
  ON billing_invoices(organization_id, invoice_number);
CREATE INDEX IF NOT EXISTS billing_invoice_status_due_idx
  ON billing_invoices(status, due_at);
CREATE INDEX IF NOT EXISTS billing_invoice_subscription_idx
  ON billing_invoices(subscription_id, period_start DESC);

CREATE TABLE IF NOT EXISTS billing_payments (
  id varchar(36) PRIMARY KEY,
  organization_id varchar(36) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id varchar(36) NOT NULL REFERENCES billing_invoices(id) ON DELETE RESTRICT,
  provider varchar(40) NOT NULL DEFAULT 'manual',
  reference varchar(160) NOT NULL,
  provider_transaction_id varchar(100),
  status billing_payment_status NOT NULL DEFAULT 'pending',
  amount numeric(12,2) NOT NULL,
  currency varchar(3) NOT NULL DEFAULT 'GHS',
  channel varchar(80),
  paid_at timestamp,
  failure_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by varchar(36),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT billing_payment_amount_chk CHECK (amount > 0),
  CONSTRAINT billing_payment_currency_chk CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE INDEX IF NOT EXISTS billing_payment_organization_idx
  ON billing_payments(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS billing_payment_invoice_idx
  ON billing_payments(invoice_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS billing_payment_provider_reference_uidx
  ON billing_payments(provider, reference);
CREATE INDEX IF NOT EXISTS billing_payment_status_idx
  ON billing_payments(status);

CREATE TABLE IF NOT EXISTS billing_webhook_events (
  id varchar(64) PRIMARY KEY,
  organization_id varchar(36) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider varchar(40) NOT NULL,
  event_type varchar(100) NOT NULL,
  reference varchar(160),
  payload_hash varchar(64) NOT NULL,
  processed_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_webhook_provider_payload_uidx
  ON billing_webhook_events(provider, payload_hash);
CREATE INDEX IF NOT EXISTS billing_webhook_organization_idx
  ON billing_webhook_events(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS billing_webhook_reference_idx
  ON billing_webhook_events(reference);

-- Billing records must stay within the subscriber organization even if a
-- malformed server request tries to reference another organization's record.
DROP TRIGGER IF EXISTS billing_invoice_tenant_reference_guard ON billing_invoices;
CREATE TRIGGER billing_invoice_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, subscription_id
ON billing_invoices
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'subscription_id', 'organization_subscriptions'
);

DROP TRIGGER IF EXISTS billing_payment_tenant_reference_guard ON billing_payments;
CREATE TRIGGER billing_payment_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, invoice_id
ON billing_payments
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'invoice_id', 'billing_invoices'
);
