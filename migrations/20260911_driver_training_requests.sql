BEGIN;

CREATE TABLE IF NOT EXISTS training_requests (
  id varchar(36) PRIMARY KEY,
  request_number varchar(40) NOT NULL,
  request_type varchar(20) NOT NULL DEFAULT 'client',
  service_id varchar(80) NOT NULL,
  title varchar(220) NOT NULL,
  client_name varchar(220),
  contact_name varchar(180),
  contact_email varchar(200),
  contact_phone varchar(50),
  requested_participants integer NOT NULL DEFAULT 1,
  preferred_start_date date,
  preferred_end_date date,
  location_id varchar(36) REFERENCES locations(id) ON DELETE SET NULL,
  venue varchar(300),
  delivery_mode varchar(30) NOT NULL DEFAULT 'onsite',
  priority varchar(20) NOT NULL DEFAULT 'normal',
  status varchar(24) NOT NULL DEFAULT 'draft',
  business_need text,
  notes text,
  requested_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  submitted_at timestamptz,
  reviewed_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_notes text,
  scheduled_session_id varchar(36) REFERENCES training_sessions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_request_type_chk CHECK (request_type IN ('client', 'internal')),
  CONSTRAINT training_request_priority_chk CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  CONSTRAINT training_request_status_chk CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'scheduled', 'cancelled')),
  CONSTRAINT training_request_delivery_mode_chk CHECK (delivery_mode IN ('onsite', 'classroom', 'practical', 'hybrid', 'virtual')),
  CONSTRAINT training_request_participant_count_chk CHECK (requested_participants BETWEEN 1 AND 5000),
  CONSTRAINT training_request_client_name_chk CHECK (request_type <> 'client' OR client_name IS NOT NULL),
  CONSTRAINT training_request_preferred_dates_chk CHECK (preferred_start_date IS NULL OR preferred_end_date IS NULL OR preferred_end_date >= preferred_start_date),
  CONSTRAINT training_request_submission_chk CHECK (status NOT IN ('submitted', 'under_review', 'approved', 'rejected', 'scheduled') OR submitted_at IS NOT NULL),
  CONSTRAINT training_request_review_chk CHECK (status NOT IN ('approved', 'rejected', 'scheduled') OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)),
  CONSTRAINT training_request_schedule_chk CHECK ((status = 'scheduled' AND scheduled_session_id IS NOT NULL) OR (status <> 'scheduled' AND scheduled_session_id IS NULL))
);

CREATE TABLE IF NOT EXISTS training_request_events (
  id varchar(36) PRIMARY KEY,
  request_id varchar(36) NOT NULL REFERENCES training_requests(id) ON DELETE CASCADE,
  event_type varchar(30) NOT NULL,
  from_status varchar(24),
  to_status varchar(24),
  summary text NOT NULL,
  created_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_request_event_type_chk CHECK (event_type IN ('created', 'submitted', 'review_started', 'approved', 'rejected', 'scheduled', 'cancelled')),
  CONSTRAINT training_request_event_status_chk CHECK (
    (from_status IS NULL OR from_status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'scheduled', 'cancelled'))
    AND (to_status IS NULL OR to_status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'scheduled', 'cancelled'))
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS training_request_number_uidx ON training_requests(request_number);
CREATE INDEX IF NOT EXISTS training_request_status_created_idx ON training_requests(status, created_at);
CREATE INDEX IF NOT EXISTS training_request_service_idx ON training_requests(service_id);
CREATE INDEX IF NOT EXISTS training_request_client_idx ON training_requests(client_name);
CREATE INDEX IF NOT EXISTS training_request_reviewer_idx ON training_requests(reviewed_by);
CREATE UNIQUE INDEX IF NOT EXISTS training_request_scheduled_session_uidx ON training_requests(scheduled_session_id) WHERE scheduled_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS training_request_event_request_created_idx ON training_request_events(request_id, created_at);

COMMIT;
