BEGIN;

CREATE TABLE IF NOT EXISTS training_regulatory_requirements (
  id varchar(36) PRIMARY KEY,
  requirement_code varchar(50) NOT NULL,
  service_id varchar(80),
  title varchar(240) NOT NULL,
  authority varchar(240) NOT NULL,
  standard_reference varchar(240),
  requirement_type varchar(30) NOT NULL,
  mandatory boolean NOT NULL DEFAULT true,
  status varchar(20) NOT NULL DEFAULT 'active',
  review_due_date date,
  notes text,
  created_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_regulatory_requirement_service_chk CHECK (service_id IS NULL OR service_id IN ('defensive-driving','driving-proficiency-test','hazmat-hydrocarbons','off-road-driving','forklift-operator-safety','vehicle-safety-inspection')),
  CONSTRAINT training_regulatory_requirement_type_chk CHECK (requirement_type IN ('provider_accreditation','trainer_certification','operating_licence','insurance','permit','approved_procedure','equipment_certification','other')),
  CONSTRAINT training_regulatory_requirement_status_chk CHECK (status IN ('active','inactive'))
);

CREATE TABLE IF NOT EXISTS training_accreditation_records (
  id varchar(36) PRIMARY KEY,
  requirement_id varchar(36) NOT NULL REFERENCES training_regulatory_requirements(id) ON DELETE CASCADE,
  credential_number varchar(120),
  issuing_authority varchar(240) NOT NULL,
  issued_date date,
  valid_from date NOT NULL,
  valid_until date,
  evidence_reference varchar(500) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'pending',
  verification_notes text,
  verified_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  created_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_accreditation_status_chk CHECK (status IN ('pending','verified','rejected','revoked','superseded')),
  CONSTRAINT training_accreditation_dates_chk CHECK (valid_until IS NULL OR valid_until >= valid_from),
  CONSTRAINT training_accreditation_issued_chk CHECK (issued_date IS NULL OR issued_date <= valid_from),
  CONSTRAINT training_accreditation_verification_chk CHECK (status <> 'verified' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS training_session_compliance_reviews (
  id varchar(36) PRIMARY KEY,
  session_id varchar(36) NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  status varchar(20) NOT NULL DEFAULT 'blocked',
  blockers jsonb NOT NULL DEFAULT '[]'::jsonb,
  reviewed_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_session_compliance_status_chk CHECK (status IN ('ready','blocked')),
  CONSTRAINT training_session_compliance_ready_chk CHECK (status <> 'ready' OR jsonb_array_length(blockers) = 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS training_regulatory_requirement_code_uidx ON training_regulatory_requirements(requirement_code);
CREATE INDEX IF NOT EXISTS training_regulatory_requirement_service_status_idx ON training_regulatory_requirements(service_id, status);
CREATE INDEX IF NOT EXISTS training_regulatory_requirement_review_idx ON training_regulatory_requirements(review_due_date);
CREATE INDEX IF NOT EXISTS training_accreditation_requirement_idx ON training_accreditation_records(requirement_id);
CREATE INDEX IF NOT EXISTS training_accreditation_status_validity_idx ON training_accreditation_records(status, valid_until);
CREATE INDEX IF NOT EXISTS training_accreditation_credential_idx ON training_accreditation_records(credential_number);
CREATE UNIQUE INDEX IF NOT EXISTS training_accreditation_one_verified_uidx ON training_accreditation_records(requirement_id) WHERE status = 'verified';
CREATE UNIQUE INDEX IF NOT EXISTS training_session_compliance_session_uidx ON training_session_compliance_reviews(session_id);
CREATE INDEX IF NOT EXISTS training_session_compliance_status_idx ON training_session_compliance_reviews(status);
CREATE INDEX IF NOT EXISTS training_session_compliance_reviewed_idx ON training_session_compliance_reviews(reviewed_at);

CREATE OR REPLACE FUNCTION enforce_training_session_regulatory_compliance()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  missing_requirements text;
BEGIN
  IF NEW.status = 'in_progress' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'in_progress') THEN
    SELECT string_agg(r.title, '; ' ORDER BY r.requirement_code)
      INTO missing_requirements
      FROM training_regulatory_requirements r
     WHERE r.status = 'active'
       AND r.mandatory = true
       AND (r.service_id IS NULL OR r.service_id = NEW.service_id)
       AND NOT EXISTS (
         SELECT 1
           FROM training_accreditation_records a
          WHERE a.requirement_id = r.id
            AND a.status = 'verified'
            AND a.valid_from <= CURRENT_DATE
            AND (a.valid_until IS NULL OR a.valid_until >= CURRENT_DATE)
       );

    IF missing_requirements IS NOT NULL THEN
      RAISE EXCEPTION 'Training session cannot start; regulatory compliance blockers: %', missing_requirements;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS training_session_regulatory_compliance_trg ON training_sessions;
CREATE TRIGGER training_session_regulatory_compliance_trg
BEFORE INSERT OR UPDATE OF status, service_id ON training_sessions
FOR EACH ROW
EXECUTE FUNCTION enforce_training_session_regulatory_compliance();

COMMIT;
