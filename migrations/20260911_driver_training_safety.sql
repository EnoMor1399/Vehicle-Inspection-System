BEGIN;

CREATE TABLE IF NOT EXISTS training_risk_assessments (
  id varchar(36) PRIMARY KEY,
  session_id varchar(36) NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  status varchar(24) NOT NULL DEFAULT 'draft',
  overall_risk varchar(20) NOT NULL DEFAULT 'medium',
  activity_scope text NOT NULL,
  emergency_plan text NOT NULL,
  stop_work_required boolean NOT NULL DEFAULT false,
  notes text,
  assessed_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  assessed_at timestamptz NOT NULL DEFAULT now(),
  approved_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_risk_assessment_status_chk CHECK (status IN ('draft', 'approved', 'blocked', 'superseded')),
  CONSTRAINT training_risk_assessment_overall_risk_chk CHECK (overall_risk IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT training_risk_assessment_approval_chk CHECK (status <> 'approved' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL AND stop_work_required = false))
);

CREATE TABLE IF NOT EXISTS training_safety_hazards (
  id varchar(36) PRIMARY KEY,
  assessment_id varchar(36) NOT NULL REFERENCES training_risk_assessments(id) ON DELETE CASCADE,
  hazard text NOT NULL,
  consequence text NOT NULL,
  likelihood integer NOT NULL,
  severity integer NOT NULL,
  initial_risk_score integer NOT NULL,
  controls text NOT NULL,
  residual_likelihood integer NOT NULL,
  residual_severity integer NOT NULL,
  residual_risk_score integer NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'open',
  owner_id varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  created_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_safety_hazard_likelihood_chk CHECK (likelihood BETWEEN 1 AND 5 AND residual_likelihood BETWEEN 1 AND 5),
  CONSTRAINT training_safety_hazard_severity_chk CHECK (severity BETWEEN 1 AND 5 AND residual_severity BETWEEN 1 AND 5),
  CONSTRAINT training_safety_hazard_score_chk CHECK (initial_risk_score = likelihood * severity AND residual_risk_score = residual_likelihood * residual_severity),
  CONSTRAINT training_safety_hazard_status_chk CHECK (status IN ('open', 'controlled', 'accepted'))
);

CREATE TABLE IF NOT EXISTS training_safety_incidents (
  id varchar(36) PRIMARY KEY,
  incident_number varchar(40) NOT NULL,
  session_id varchar(36) NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  participant_id varchar(36) REFERENCES training_participants(id) ON DELETE SET NULL,
  incident_type varchar(30) NOT NULL,
  severity varchar(20) NOT NULL DEFAULT 'low',
  status varchar(24) NOT NULL DEFAULT 'open',
  occurred_at timestamptz NOT NULL,
  location varchar(300),
  description text NOT NULL,
  immediate_actions text NOT NULL,
  stop_work boolean NOT NULL DEFAULT false,
  owner_id varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  root_cause text,
  corrective_actions text,
  evidence_reference varchar(500),
  closure_review text,
  reported_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  closed_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_safety_incident_type_chk CHECK (incident_type IN ('near_miss', 'unsafe_condition', 'first_aid', 'injury', 'property_damage', 'environmental', 'equipment_failure', 'other')),
  CONSTRAINT training_safety_incident_severity_chk CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT training_safety_incident_status_chk CHECK (status IN ('open', 'investigating', 'corrective_action', 'verification', 'closed')),
  CONSTRAINT training_safety_incident_stop_work_chk CHECK (
    (severity NOT IN ('high', 'critical') AND incident_type NOT IN ('injury', 'equipment_failure')) OR stop_work = true
  ),
  CONSTRAINT training_safety_incident_closure_chk CHECK (
    status <> 'closed' OR (
      root_cause IS NOT NULL
      AND corrective_actions IS NOT NULL
      AND evidence_reference IS NOT NULL
      AND closure_review IS NOT NULL
      AND closed_by IS NOT NULL
      AND closed_at IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS training_risk_assessment_session_uidx ON training_risk_assessments(session_id);
CREATE INDEX IF NOT EXISTS training_risk_assessment_status_idx ON training_risk_assessments(status);
CREATE INDEX IF NOT EXISTS training_risk_assessment_overall_risk_idx ON training_risk_assessments(overall_risk);
CREATE INDEX IF NOT EXISTS training_risk_assessment_assessed_at_idx ON training_risk_assessments(assessed_at);
CREATE INDEX IF NOT EXISTS training_safety_hazard_assessment_status_idx ON training_safety_hazards(assessment_id, status);
CREATE INDEX IF NOT EXISTS training_safety_hazard_residual_risk_idx ON training_safety_hazards(residual_risk_score);
CREATE INDEX IF NOT EXISTS training_safety_hazard_owner_idx ON training_safety_hazards(owner_id);
CREATE UNIQUE INDEX IF NOT EXISTS training_safety_incident_number_uidx ON training_safety_incidents(incident_number);
CREATE INDEX IF NOT EXISTS training_safety_incident_session_status_idx ON training_safety_incidents(session_id, status);
CREATE INDEX IF NOT EXISTS training_safety_incident_severity_idx ON training_safety_incidents(severity);
CREATE INDEX IF NOT EXISTS training_safety_incident_occurred_idx ON training_safety_incidents(occurred_at);
CREATE INDEX IF NOT EXISTS training_safety_incident_owner_idx ON training_safety_incidents(owner_id);

COMMIT;
