BEGIN;

CREATE TABLE IF NOT EXISTS training_attendance_signoffs (
  id varchar(36) PRIMARY KEY,
  participant_id varchar(36) NOT NULL REFERENCES training_participants(id) ON DELETE CASCADE,
  session_id varchar(36) NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  check_in_at timestamptz,
  check_out_at timestamptz,
  attendance_minutes integer NOT NULL DEFAULT 0,
  status varchar(24) NOT NULL DEFAULT 'open',
  participant_acknowledged boolean NOT NULL DEFAULT false,
  instructor_confirmed boolean NOT NULL DEFAULT false,
  confirmed_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  confirmed_at timestamptz,
  notes text,
  created_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_attendance_status_chk CHECK (status IN ('open', 'confirmed', 'disputed', 'void')),
  CONSTRAINT training_attendance_duration_chk CHECK (attendance_minutes BETWEEN 0 AND 100000),
  CONSTRAINT training_attendance_times_chk CHECK (check_out_at IS NULL OR check_in_at IS NULL OR check_out_at >= check_in_at),
  CONSTRAINT training_attendance_confirmation_chk CHECK (
    status <> 'confirmed'
    OR (
      check_in_at IS NOT NULL
      AND check_out_at IS NOT NULL
      AND attendance_minutes > 0
      AND participant_acknowledged = true
      AND instructor_confirmed = true
      AND confirmed_at IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS training_attendance_participant_session_uidx
  ON training_attendance_signoffs(participant_id, session_id);
CREATE INDEX IF NOT EXISTS training_attendance_session_status_idx
  ON training_attendance_signoffs(session_id, status);
CREATE INDEX IF NOT EXISTS training_attendance_participant_idx
  ON training_attendance_signoffs(participant_id);
CREATE INDEX IF NOT EXISTS training_attendance_confirmed_idx
  ON training_attendance_signoffs(confirmed_at);

CREATE TABLE IF NOT EXISTS training_evidence_records (
  id varchar(36) PRIMARY KEY,
  session_id varchar(36) NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  participant_id varchar(36) REFERENCES training_participants(id) ON DELETE CASCADE,
  evidence_type varchar(40) NOT NULL,
  title varchar(220) NOT NULL,
  reference varchar(500) NOT NULL,
  sha256 varchar(64),
  status varchar(24) NOT NULL DEFAULT 'pending',
  captured_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  verified_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_evidence_type_chk CHECK (evidence_type IN (
    'attendance_register',
    'assessment_sheet',
    'practical_observation',
    'client_confirmation',
    'photo_reference',
    'document_reference',
    'other'
  )),
  CONSTRAINT training_evidence_status_chk CHECK (status IN ('pending', 'verified', 'rejected')),
  CONSTRAINT training_evidence_title_chk CHECK (char_length(title) BETWEEN 3 AND 220),
  CONSTRAINT training_evidence_reference_chk CHECK (char_length(reference) BETWEEN 2 AND 500),
  CONSTRAINT training_evidence_sha256_chk CHECK (sha256 IS NULL OR sha256 ~ '^[A-Fa-f0-9]{64}$'),
  CONSTRAINT training_evidence_rejection_reason_chk CHECK (
    status <> 'rejected' OR (review_notes IS NOT NULL AND char_length(btrim(review_notes)) >= 5)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS training_evidence_scope_reference_uidx
  ON training_evidence_records(session_id, COALESCE(participant_id, ''), reference);
CREATE INDEX IF NOT EXISTS training_evidence_session_idx
  ON training_evidence_records(session_id, captured_at);
CREATE INDEX IF NOT EXISTS training_evidence_participant_idx
  ON training_evidence_records(participant_id);
CREATE INDEX IF NOT EXISTS training_evidence_status_idx
  ON training_evidence_records(status, captured_at);
CREATE INDEX IF NOT EXISTS training_evidence_type_idx
  ON training_evidence_records(evidence_type);

COMMIT;
