BEGIN;

CREATE TABLE IF NOT EXISTS training_sessions (
  id varchar(36) PRIMARY KEY,
  reference_number varchar(40) NOT NULL,
  service_id varchar(80) NOT NULL,
  title varchar(220) NOT NULL,
  client_name varchar(220),
  transporter_id varchar(36) REFERENCES transporters(id) ON DELETE SET NULL,
  location_id varchar(36) REFERENCES locations(id) ON DELETE SET NULL,
  venue varchar(300),
  delivery_mode varchar(30) NOT NULL DEFAULT 'onsite',
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  instructor_id varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  instructor_name varchar(200),
  capacity integer NOT NULL DEFAULT 20,
  status varchar(24) NOT NULL DEFAULT 'scheduled',
  notes text,
  created_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_session_dates_chk CHECK (end_at >= start_at),
  CONSTRAINT training_session_capacity_chk CHECK (capacity BETWEEN 1 AND 500),
  CONSTRAINT training_session_status_chk CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  CONSTRAINT training_session_delivery_mode_chk CHECK (delivery_mode IN ('onsite', 'classroom', 'practical', 'hybrid'))
);

CREATE TABLE IF NOT EXISTS training_participants (
  id varchar(36) PRIMARY KEY,
  session_id varchar(36) NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  full_name varchar(200) NOT NULL,
  company_name varchar(220),
  employee_number varchar(100),
  phone varchar(50),
  email varchar(200),
  driver_license_number varchar(100),
  driver_license_class varchar(50),
  driver_license_expiry date,
  attendance_status varchar(24) NOT NULL DEFAULT 'registered',
  risk_level varchar(20),
  assessment_status varchar(24) NOT NULL DEFAULT 'pending',
  certificate_eligible boolean NOT NULL DEFAULT false,
  notes text,
  created_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_participant_attendance_chk CHECK (attendance_status IN ('registered', 'attended', 'absent', 'withdrawn')),
  CONSTRAINT training_participant_risk_chk CHECK (risk_level IS NULL OR risk_level IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT training_participant_assessment_chk CHECK (assessment_status IN ('pending', 'assessed', 'passed', 'failed'))
);

CREATE TABLE IF NOT EXISTS training_assessments (
  id varchar(36) PRIMARY KEY,
  participant_id varchar(36) NOT NULL REFERENCES training_participants(id) ON DELETE CASCADE,
  session_id varchar(36) NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  assessor_id varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  assessment_type varchar(40) NOT NULL,
  theory_score numeric(5,2),
  practical_score numeric(5,2),
  overall_score numeric(5,2),
  result varchar(30) NOT NULL,
  risk_level varchar(20),
  strengths text,
  improvement_areas jsonb NOT NULL DEFAULT '[]'::jsonb,
  remarks text,
  assessed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_assessment_type_chk CHECK (assessment_type IN ('pre_training', 'post_training', 'proficiency', 'practical', 'refresher')),
  CONSTRAINT training_assessment_score_chk CHECK (
    (theory_score IS NULL OR theory_score BETWEEN 0 AND 100)
    AND (practical_score IS NULL OR practical_score BETWEEN 0 AND 100)
    AND (overall_score IS NULL OR overall_score BETWEEN 0 AND 100)
  ),
  CONSTRAINT training_assessment_result_chk CHECK (result IN ('pass', 'fail', 'competent', 'not_yet_competent')),
  CONSTRAINT training_assessment_risk_chk CHECK (risk_level IS NULL OR risk_level IN ('low', 'medium', 'high', 'critical'))
);

CREATE TABLE IF NOT EXISTS training_certificates (
  id varchar(36) PRIMARY KEY,
  certificate_number varchar(50) NOT NULL,
  verification_code varchar(64) NOT NULL,
  participant_id varchar(36) NOT NULL REFERENCES training_participants(id) ON DELETE RESTRICT,
  session_id varchar(36) NOT NULL REFERENCES training_sessions(id) ON DELETE RESTRICT,
  service_id varchar(80) NOT NULL,
  issue_date date NOT NULL,
  expiry_date date,
  status varchar(24) NOT NULL DEFAULT 'active',
  issued_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revocation_reason text,
  CONSTRAINT training_certificate_status_chk CHECK (status IN ('active', 'expired', 'revoked'))
);

CREATE UNIQUE INDEX IF NOT EXISTS training_session_reference_uidx ON training_sessions(reference_number);
CREATE INDEX IF NOT EXISTS training_session_service_idx ON training_sessions(service_id);
CREATE INDEX IF NOT EXISTS training_session_status_start_idx ON training_sessions(status, start_at);
CREATE INDEX IF NOT EXISTS training_session_transporter_idx ON training_sessions(transporter_id);
CREATE INDEX IF NOT EXISTS training_session_instructor_idx ON training_sessions(instructor_id);
CREATE INDEX IF NOT EXISTS training_participant_session_idx ON training_participants(session_id);
CREATE INDEX IF NOT EXISTS training_participant_license_idx ON training_participants(driver_license_number);
CREATE INDEX IF NOT EXISTS training_participant_email_idx ON training_participants(email);
CREATE INDEX IF NOT EXISTS training_participant_assessment_idx ON training_participants(assessment_status);
CREATE INDEX IF NOT EXISTS training_assessment_participant_idx ON training_assessments(participant_id, assessed_at);
CREATE INDEX IF NOT EXISTS training_assessment_session_idx ON training_assessments(session_id);
CREATE INDEX IF NOT EXISTS training_assessment_result_idx ON training_assessments(result);
CREATE UNIQUE INDEX IF NOT EXISTS training_certificate_number_uidx ON training_certificates(certificate_number);
CREATE UNIQUE INDEX IF NOT EXISTS training_certificate_verification_uidx ON training_certificates(verification_code);
CREATE INDEX IF NOT EXISTS training_certificate_participant_idx ON training_certificates(participant_id);
CREATE INDEX IF NOT EXISTS training_certificate_session_idx ON training_certificates(session_id);
CREATE INDEX IF NOT EXISTS training_certificate_status_idx ON training_certificates(status);

COMMIT;
