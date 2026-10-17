-- Global Super Administrator-managed copy. No tenant operational records changed.
CREATE TABLE IF NOT EXISTS platform_content (
  key varchar(100) PRIMARY KEY,
  draft_text text,
  published_text text,
  revision integer NOT NULL DEFAULT 0,
  updated_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamp NOT NULL DEFAULT now(),
  published_at timestamp
);
