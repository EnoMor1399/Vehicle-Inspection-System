-- VIMS security/operations access-path hardening
-- Prepared for the next guarded `npm run db:upgrade` execution.
-- No production database change occurs merely by committing this file.

CREATE INDEX IF NOT EXISTS login_attempt_email_failed_created_idx
  ON login_attempts (email, created_at DESC)
  WHERE success = false;

CREATE INDEX IF NOT EXISTS login_attempt_ip_failed_created_idx
  ON login_attempts (ip_address, created_at DESC)
  WHERE success = false;

CREATE INDEX IF NOT EXISTS session_user_active_activity_idx
  ON sessions (user_id, last_activity_at DESC)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS audit_entity_created_idx
  ON audit_logs (entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_user_created_idx
  ON audit_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notification_user_unread_created_idx
  ON notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

-- token and key_hash are already UNIQUE and therefore already backed by unique
-- PostgreSQL indexes. Remove the older duplicate non-unique indexes.
DROP INDEX IF EXISTS session_token_idx;
DROP INDEX IF EXISTS api_key_hash_idx;

ANALYZE sessions;
ANALYZE login_attempts;
ANALYZE audit_logs;
ANALYZE notifications;
ANALYZE api_keys;
