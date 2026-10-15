BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'inspection_appointment_status'
  ) THEN
    CREATE TYPE inspection_appointment_status AS ENUM (
      'scheduled',
      'confirmed',
      'checked_in',
      'in_progress',
      'completed',
      'cancelled',
      'no_show'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS inspection_appointments (
  id varchar(36) PRIMARY KEY,
  appointment_number varchar(50) NOT NULL UNIQUE,
  vehicle_id varchar(36) NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  location_id varchar(36) REFERENCES locations(id) ON DELETE SET NULL,
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 45 CHECK (duration_minutes BETWEEN 15 AND 240),
  appointment_type varchar(30) NOT NULL DEFAULT 'routine',
  priority varchar(20) NOT NULL DEFAULT 'normal',
  status inspection_appointment_status NOT NULL DEFAULT 'scheduled',
  assigned_inspector_id varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  linked_inspection_id varchar(36) REFERENCES inspections(id) ON DELETE SET NULL,
  notes text,
  booked_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inspection_appointment_scheduled_idx
  ON inspection_appointments(scheduled_at);

CREATE INDEX IF NOT EXISTS inspection_appointment_location_scheduled_idx
  ON inspection_appointments(location_id, scheduled_at);

CREATE INDEX IF NOT EXISTS inspection_appointment_status_scheduled_idx
  ON inspection_appointments(status, scheduled_at);

CREATE INDEX IF NOT EXISTS inspection_appointment_vehicle_scheduled_idx
  ON inspection_appointments(vehicle_id, scheduled_at);

CREATE INDEX IF NOT EXISTS inspection_appointment_inspector_scheduled_idx
  ON inspection_appointments(assigned_inspector_id, scheduled_at);

CREATE INDEX IF NOT EXISTS inspection_appointment_linked_inspection_idx
  ON inspection_appointments(linked_inspection_id);

COMMENT ON TABLE inspection_appointments IS
  'Operational scheduling records for VIMS inspections, kept separate from completed inspection evidence.';

COMMIT;
