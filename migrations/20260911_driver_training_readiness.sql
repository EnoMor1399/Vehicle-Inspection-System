BEGIN;

CREATE TABLE IF NOT EXISTS training_instructor_profiles (
  id varchar(36) PRIMARY KEY,
  user_id varchar(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instructor_code varchar(40) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'active',
  specialties jsonb NOT NULL DEFAULT '[]'::jsonb,
  driver_license_number varchar(100),
  driver_license_expiry date,
  trainer_certification varchar(220),
  trainer_certification_expiry date,
  first_aid_expiry date,
  medical_fitness_expiry date,
  notes text,
  created_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_instructor_status_chk CHECK (status IN ('active', 'inactive', 'suspended')),
  CONSTRAINT training_instructor_specialties_chk CHECK (jsonb_typeof(specialties) = 'array')
);

CREATE UNIQUE INDEX IF NOT EXISTS training_instructor_user_uidx ON training_instructor_profiles(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS training_instructor_code_uidx ON training_instructor_profiles(instructor_code);
CREATE INDEX IF NOT EXISTS training_instructor_status_idx ON training_instructor_profiles(status);
CREATE INDEX IF NOT EXISTS training_instructor_cert_expiry_idx ON training_instructor_profiles(trainer_certification_expiry);
CREATE INDEX IF NOT EXISTS training_instructor_medical_expiry_idx ON training_instructor_profiles(medical_fitness_expiry);

CREATE TABLE IF NOT EXISTS training_session_readiness (
  id varchar(36) PRIMARY KEY,
  session_id varchar(36) NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  status varchar(24) NOT NULL DEFAULT 'not_ready',
  instructor_confirmed boolean NOT NULL DEFAULT false,
  venue_confirmed boolean NOT NULL DEFAULT false,
  vehicle_equipment_ready boolean NOT NULL DEFAULT false,
  training_materials_ready boolean NOT NULL DEFAULT false,
  participant_list_confirmed boolean NOT NULL DEFAULT false,
  risk_assessment_complete boolean NOT NULL DEFAULT false,
  emergency_plan_confirmed boolean NOT NULL DEFAULT false,
  client_confirmation_received boolean NOT NULL DEFAULT false,
  blockers jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  reviewed_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_readiness_status_chk CHECK (status IN ('not_ready', 'blocked', 'ready')),
  CONSTRAINT training_readiness_blockers_chk CHECK (jsonb_typeof(blockers) = 'array')
);

CREATE UNIQUE INDEX IF NOT EXISTS training_readiness_session_uidx ON training_session_readiness(session_id);
CREATE INDEX IF NOT EXISTS training_readiness_status_idx ON training_session_readiness(status);
CREATE INDEX IF NOT EXISTS training_readiness_reviewed_idx ON training_session_readiness(reviewed_at);

COMMIT;
