-- Auditable, strictly expiring, read-only support sessions.
-- A support session never replaces the Super Administrator's session.
CREATE TABLE IF NOT EXISTS support_sessions (
  id varchar(36) PRIMARY KEY,
  token_hash varchar(64) NOT NULL UNIQUE,
  actor_user_id varchar(36) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  actor_session_id varchar(36) NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  target_user_id varchar(36) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  organization_id varchar(36) NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  reason varchar(500) NOT NULL,
  ip_address varchar(45),
  created_at timestamp NOT NULL DEFAULT NOW(),
  expires_at timestamp NOT NULL,
  ended_at timestamp
);
CREATE UNIQUE INDEX IF NOT EXISTS support_session_token_idx ON support_sessions(token_hash);
CREATE INDEX IF NOT EXISTS support_session_actor_idx ON support_sessions(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS support_session_target_idx ON support_sessions(organization_id, target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS support_session_expiry_idx ON support_sessions(expires_at);
