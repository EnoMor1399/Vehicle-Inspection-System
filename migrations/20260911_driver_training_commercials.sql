BEGIN;

CREATE TABLE IF NOT EXISTS training_quotations (
  id varchar(36) PRIMARY KEY,
  quotation_number varchar(50) NOT NULL,
  request_id varchar(36) NOT NULL REFERENCES training_requests(id) ON DELETE CASCADE,
  version_number integer NOT NULL DEFAULT 1,
  currency varchar(3) NOT NULL DEFAULT 'GHS',
  status varchar(24) NOT NULL DEFAULT 'draft',
  valid_until date NOT NULL,
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  discount_amount numeric(14,2) NOT NULL DEFAULT 0,
  tax_rate numeric(6,3) NOT NULL DEFAULT 0,
  tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  terms text,
  notes text,
  prepared_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  approved_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  sent_at timestamptz,
  accepted_by_name varchar(200),
  accepted_by_email varchar(200),
  accepted_at timestamptz,
  client_decision_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_quotation_version_chk CHECK (version_number >= 1),
  CONSTRAINT training_quotation_currency_chk CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT training_quotation_status_chk CHECK (status IN ('draft', 'pending_approval', 'approved', 'sent', 'accepted', 'rejected', 'expired', 'cancelled', 'superseded')),
  CONSTRAINT training_quotation_amount_chk CHECK (
    subtotal >= 0
    AND discount_amount >= 0
    AND discount_amount <= subtotal
    AND tax_rate >= 0
    AND tax_rate <= 100
    AND tax_amount >= 0
    AND total_amount = round((subtotal - discount_amount) + tax_amount, 2)
  ),
  CONSTRAINT training_quotation_approval_chk CHECK (
    status NOT IN ('approved', 'sent', 'accepted', 'rejected', 'expired', 'superseded')
    OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)
  ),
  CONSTRAINT training_quotation_sent_chk CHECK (
    status NOT IN ('sent', 'accepted', 'rejected', 'expired') OR sent_at IS NOT NULL
  ),
  CONSTRAINT training_quotation_acceptance_chk CHECK (
    status <> 'accepted' OR (accepted_by_name IS NOT NULL AND accepted_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS training_quotation_items (
  id varchar(36) PRIMARY KEY,
  quotation_id varchar(36) NOT NULL REFERENCES training_quotations(id) ON DELETE CASCADE,
  item_type varchar(30) NOT NULL,
  description varchar(500) NOT NULL,
  quantity numeric(12,2) NOT NULL,
  unit_price numeric(14,2) NOT NULL,
  line_total numeric(14,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_quotation_item_type_chk CHECK (item_type IN ('training_fee', 'assessment', 'certificate', 'logistics', 'materials', 'travel', 'accommodation', 'equipment', 'other')),
  CONSTRAINT training_quotation_item_amount_chk CHECK (quantity > 0 AND unit_price >= 0 AND line_total = round(quantity * unit_price, 2))
);

CREATE UNIQUE INDEX IF NOT EXISTS training_quotation_number_uidx ON training_quotations(quotation_number);
CREATE UNIQUE INDEX IF NOT EXISTS training_quotation_request_version_uidx ON training_quotations(request_id, version_number);
CREATE INDEX IF NOT EXISTS training_quotation_request_status_idx ON training_quotations(request_id, status);
CREATE INDEX IF NOT EXISTS training_quotation_valid_until_idx ON training_quotations(valid_until);
CREATE UNIQUE INDEX IF NOT EXISTS training_quotation_one_accepted_request_uidx ON training_quotations(request_id) WHERE status = 'accepted';
CREATE INDEX IF NOT EXISTS training_quotation_item_quotation_idx ON training_quotation_items(quotation_id);
CREATE INDEX IF NOT EXISTS training_quotation_item_type_idx ON training_quotation_items(item_type);

CREATE OR REPLACE FUNCTION enforce_training_request_commercial_authorization()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.request_type = 'client' AND NEW.status = 'scheduled' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM training_quotations q
      WHERE q.request_id = NEW.id
        AND q.status = 'accepted'
        AND q.valid_until >= CURRENT_DATE
    ) THEN
      RAISE EXCEPTION 'Client training request requires an accepted, valid quotation before scheduling';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS training_request_commercial_authorization_trg ON training_requests;
CREATE TRIGGER training_request_commercial_authorization_trg
BEFORE INSERT OR UPDATE OF status, scheduled_session_id ON training_requests
FOR EACH ROW
EXECUTE FUNCTION enforce_training_request_commercial_authorization();

COMMIT;
