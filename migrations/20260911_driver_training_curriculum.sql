BEGIN;

CREATE TABLE IF NOT EXISTS training_curricula (
  id varchar(36) PRIMARY KEY,
  code varchar(40) NOT NULL,
  service_id varchar(80) NOT NULL,
  title varchar(220) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'active',
  owner_id varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  notes text,
  created_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_curriculum_status_chk CHECK (status IN ('active', 'inactive')),
  CONSTRAINT training_curriculum_code_chk CHECK (code ~ '^[A-Z0-9][A-Z0-9._-]{2,39}$')
);

CREATE TABLE IF NOT EXISTS training_curriculum_versions (
  id varchar(36) PRIMARY KEY,
  curriculum_id varchar(36) NOT NULL REFERENCES training_curricula(id) ON DELETE CASCADE,
  version_number varchar(20) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'draft',
  effective_from date NOT NULL,
  review_due_date date NOT NULL,
  total_hours numeric(6,2) NOT NULL,
  theory_pass_mark integer NOT NULL,
  practical_pass_mark integer NOT NULL,
  minimum_attendance_minutes integer NOT NULL DEFAULT 0,
  learning_objectives jsonb NOT NULL DEFAULT '[]'::jsonb,
  competencies jsonb NOT NULL DEFAULT '[]'::jsonb,
  modules jsonb NOT NULL DEFAULT '[]'::jsonb,
  change_summary text,
  created_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  approved_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_curriculum_version_number_chk CHECK (version_number ~ '^\d{1,3}\.\d{1,3}$'),
  CONSTRAINT training_curriculum_version_status_chk CHECK (status IN ('draft', 'approved', 'superseded', 'retired')),
  CONSTRAINT training_curriculum_version_dates_chk CHECK (review_due_date >= effective_from),
  CONSTRAINT training_curriculum_version_hours_chk CHECK (total_hours > 0 AND total_hours <= 500),
  CONSTRAINT training_curriculum_version_marks_chk CHECK (theory_pass_mark BETWEEN 0 AND 100 AND practical_pass_mark BETWEEN 0 AND 100),
  CONSTRAINT training_curriculum_version_attendance_chk CHECK (minimum_attendance_minutes BETWEEN 0 AND 30000),
  CONSTRAINT training_curriculum_version_objectives_chk CHECK (jsonb_typeof(learning_objectives) = 'array'),
  CONSTRAINT training_curriculum_version_competencies_chk CHECK (jsonb_typeof(competencies) = 'array'),
  CONSTRAINT training_curriculum_version_modules_chk CHECK (jsonb_typeof(modules) = 'array'),
  CONSTRAINT training_curriculum_version_approval_chk CHECK (
    status <> 'approved' OR (
      approved_by IS NOT NULL
      AND approved_at IS NOT NULL
      AND jsonb_array_length(learning_objectives) > 0
      AND jsonb_array_length(competencies) > 0
      AND jsonb_array_length(modules) > 0
    )
  )
);

CREATE TABLE IF NOT EXISTS training_session_curricula (
  id varchar(36) PRIMARY KEY,
  session_id varchar(36) NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  curriculum_version_id varchar(36) NOT NULL REFERENCES training_curriculum_versions(id) ON DELETE RESTRICT,
  assigned_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training_matrix_requirements (
  id varchar(36) PRIMARY KEY,
  requirement_key varchar(420) NOT NULL,
  scope_type varchar(20) NOT NULL DEFAULT 'global',
  client_name varchar(220),
  job_role varchar(160),
  service_id varchar(80) NOT NULL,
  recurrence_months integer NOT NULL DEFAULT 12,
  minimum_license_class varchar(50),
  required boolean NOT NULL DEFAULT true,
  notes text,
  created_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_matrix_scope_chk CHECK (scope_type IN ('global', 'client', 'role')),
  CONSTRAINT training_matrix_recurrence_chk CHECK (recurrence_months BETWEEN 0 AND 120),
  CONSTRAINT training_matrix_scope_data_chk CHECK (
    (scope_type = 'global')
    OR (scope_type = 'client' AND client_name IS NOT NULL AND char_length(btrim(client_name)) > 0)
    OR (scope_type = 'role' AND job_role IS NOT NULL AND char_length(btrim(job_role)) > 0)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS training_curriculum_code_uidx ON training_curricula(code);
CREATE INDEX IF NOT EXISTS training_curriculum_service_idx ON training_curricula(service_id);
CREATE INDEX IF NOT EXISTS training_curriculum_status_idx ON training_curricula(status);
CREATE INDEX IF NOT EXISTS training_curriculum_owner_idx ON training_curricula(owner_id);
CREATE UNIQUE INDEX IF NOT EXISTS training_curriculum_version_uidx ON training_curriculum_versions(curriculum_id, version_number);
CREATE INDEX IF NOT EXISTS training_curriculum_version_status_idx ON training_curriculum_versions(curriculum_id, status);
CREATE INDEX IF NOT EXISTS training_curriculum_review_due_idx ON training_curriculum_versions(review_due_date);
CREATE INDEX IF NOT EXISTS training_curriculum_effective_idx ON training_curriculum_versions(effective_from);
CREATE UNIQUE INDEX IF NOT EXISTS training_curriculum_one_approved_uidx
  ON training_curriculum_versions(curriculum_id)
  WHERE status = 'approved';
CREATE UNIQUE INDEX IF NOT EXISTS training_session_curriculum_session_uidx ON training_session_curricula(session_id);
CREATE INDEX IF NOT EXISTS training_session_curriculum_version_idx ON training_session_curricula(curriculum_version_id);
CREATE UNIQUE INDEX IF NOT EXISTS training_matrix_requirement_key_uidx ON training_matrix_requirements(requirement_key);
CREATE INDEX IF NOT EXISTS training_matrix_service_idx ON training_matrix_requirements(service_id);
CREATE INDEX IF NOT EXISTS training_matrix_scope_idx ON training_matrix_requirements(scope_type, client_name, job_role);

COMMIT;
