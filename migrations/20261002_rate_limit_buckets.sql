BEGIN;

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  bucket_key varchar(512) PRIMARY KEY,
  count integer NOT NULL DEFAULT 0,
  reset_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rate_limit_reset_idx
  ON rate_limit_buckets(reset_at);

COMMENT ON TABLE rate_limit_buckets IS
  'Shared fixed-window rate-limit state used when Upstash Redis is not configured.';
COMMENT ON COLUMN rate_limit_buckets.bucket_key IS
  'Namespaced policy and identifier key for an atomic shared rate-limit bucket.';
COMMENT ON COLUMN rate_limit_buckets.reset_at IS
  'UTC timestamp when the current fixed window expires.';

COMMIT;
