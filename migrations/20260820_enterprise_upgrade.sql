BEGIN;

CREATE TABLE IF NOT EXISTS rfid_tags (
  id varchar(36) PRIMARY KEY,
  tag_uid varchar(128) NOT NULL UNIQUE,
  vehicle_id varchar(36) NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  status varchar(20) NOT NULL DEFAULT 'active',
  assigned_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  assigned_at timestamp NOT NULL DEFAULT now(),
  last_scanned_at timestamp,
  notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rfid_tag_uid_idx ON rfid_tags(tag_uid);
CREATE INDEX IF NOT EXISTS rfid_vehicle_idx ON rfid_tags(vehicle_id);
CREATE INDEX IF NOT EXISTS rfid_status_idx ON rfid_tags(status);

-- Raise the default password standard for newly initialized settings.
ALTER TABLE system_settings ALTER COLUMN password_min_length SET DEFAULT 12;
UPDATE system_settings SET password_min_length = GREATEST(password_min_length, 12);

COMMIT;
