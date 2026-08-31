-- VIMS production performance indexes
-- These indexes target the highest-frequency joins, recency lookups and analytics filters.
-- They are idempotent and safe to re-run through `npm run db:upgrade`.

CREATE INDEX IF NOT EXISTS daily_insp_vehicle_date_idx
  ON daily_inspections (vehicle_id, inspection_date DESC);

CREATE INDEX IF NOT EXISTS daily_insp_vehicle_clearance_date_idx
  ON daily_inspections (vehicle_id, cleared_for_trip, inspection_date DESC);

CREATE INDEX IF NOT EXISTS inspection_vehicle_date_idx
  ON inspections (vehicle_id, inspection_date DESC);

CREATE INDEX IF NOT EXISTS inspection_vehicle_result_date_idx
  ON inspections (vehicle_id, overall_result, inspection_date DESC);

CREATE INDEX IF NOT EXISTS inspection_location_date_idx
  ON inspections (location_id, inspection_date DESC);

CREATE INDEX IF NOT EXISTS inspection_result_date_idx
  ON inspections (overall_result, inspection_date DESC);

CREATE INDEX IF NOT EXISTS vehicle_transporter_status_idx
  ON vehicles (transporter_id, status);

CREATE INDEX IF NOT EXISTS transporter_region_deleted_idx
  ON transporters (region, deleted_at);

CREATE INDEX IF NOT EXISTS doc_owner_expiry_idx
  ON documents (owner_type, owner_id, expiry_date);

CREATE INDEX IF NOT EXISTS session_user_active_expiry_idx
  ON sessions (user_id, is_active, expires_at);

CREATE INDEX IF NOT EXISTS login_attempt_email_created_idx
  ON login_attempts (email, created_at DESC);

CREATE INDEX IF NOT EXISTS login_attempt_ip_created_idx
  ON login_attempts (ip_address, created_at DESC);

CREATE INDEX IF NOT EXISTS security_event_severity_created_idx
  ON security_events (severity, created_at DESC);

ANALYZE daily_inspections;
ANALYZE inspections;
ANALYZE vehicles;
ANALYZE transporters;
ANALYZE documents;
ANALYZE sessions;
ANALYZE login_attempts;
ANALYZE security_events;
