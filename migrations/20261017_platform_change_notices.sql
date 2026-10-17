-- Additive, idempotent VIMS platform-wide / subscriber-scoped change notices.
-- A notice is delivered in-app at or after publish_at; effective_at is when
-- the announced change takes effect, so advance notice is possible.
CREATE TABLE IF NOT EXISTS platform_change_notices (
 id varchar(36) PRIMARY KEY,
 organization_id varchar(36) REFERENCES organizations(id) ON DELETE RESTRICT,
 created_by varchar(36) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 title varchar(160) NOT NULL,
 summary text NOT NULL,
 impact text NOT NULL,
 action_required text NOT NULL,
 action_url varchar(300),
 severity varchar(16) NOT NULL DEFAULT 'info',
 status varchar(16) NOT NULL DEFAULT 'draft',
 publish_at timestamp NOT NULL,
 effective_at timestamp NOT NULL,
 expires_at timestamp,
 created_at timestamp NOT NULL DEFAULT now(),
 updated_at timestamp NOT NULL DEFAULT now(),
 CONSTRAINT platform_change_notice_severity_chk CHECK (severity IN ('info','important','critical')),
 CONSTRAINT platform_change_notice_status_chk CHECK (status IN ('draft','published','withdrawn')),
 CONSTRAINT platform_change_notice_dates_chk CHECK (effective_at >= publish_at AND (expires_at IS NULL OR expires_at > publish_at)),
 CONSTRAINT platform_change_notice_internal_url_chk CHECK (
   action_url IS NULL OR (action_url LIKE '/%' AND action_url NOT LIKE '//%' AND POSITION(CHR(92) IN action_url) = 0)
 )
);
CREATE INDEX IF NOT EXISTS platform_change_notice_audience_idx
 ON platform_change_notices (organization_id, status, publish_at);
CREATE INDEX IF NOT EXISTS platform_change_notice_effective_idx
 ON platform_change_notices (effective_at);

CREATE TABLE IF NOT EXISTS platform_change_notice_receipts (
 id varchar(36) PRIMARY KEY,
 notice_id varchar(36) NOT NULL REFERENCES platform_change_notices(id) ON DELETE CASCADE,
 user_id varchar(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 organization_id varchar(36) NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
 acknowledged_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS platform_change_notice_user_uidx
 ON platform_change_notice_receipts (notice_id, user_id);
CREATE INDEX IF NOT EXISTS platform_change_notice_receipt_user_idx
 ON platform_change_notice_receipts (organization_id, user_id);

-- Fail closed if an acknowledgement is accidentally associated with a
-- different tenant than the authenticated user (including database-side writes).
CREATE OR REPLACE FUNCTION vims_notice_receipt_tenant_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM users u WHERE u.id = NEW.user_id AND u.organization_id = NEW.organization_id) THEN
   RAISE EXCEPTION 'Cross-organization notice receipt rejected';
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM platform_change_notices n
    WHERE n.id = NEW.notice_id
      AND n.status = 'published'
      AND (n.organization_id IS NULL OR n.organization_id = NEW.organization_id)
 ) THEN
   RAISE EXCEPTION 'Cross-organization notice receipt rejected: unavailable notice';
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS platform_change_notice_receipt_tenant_guard ON platform_change_notice_receipts;
CREATE TRIGGER platform_change_notice_receipt_tenant_guard
 BEFORE INSERT OR UPDATE ON platform_change_notice_receipts
 FOR EACH ROW EXECUTE FUNCTION vims_notice_receipt_tenant_guard();
