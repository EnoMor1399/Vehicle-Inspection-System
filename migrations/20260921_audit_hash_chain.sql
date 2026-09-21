BEGIN;

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS previous_hash varchar(64),
  ADD COLUMN IF NOT EXISTS event_hash varchar(64);

CREATE INDEX IF NOT EXISTS audit_event_hash_idx
  ON audit_logs(event_hash);

COMMENT ON COLUMN audit_logs.previous_hash IS
  'SHA-256 hash of the previous chained audit event. Legacy records may be null.';
COMMENT ON COLUMN audit_logs.event_hash IS
  'SHA-256 tamper-evident hash of this audit event and its predecessor.';

COMMIT;
