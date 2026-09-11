BEGIN;

CREATE TABLE IF NOT EXISTS training_development_plans (
  id varchar(36) PRIMARY KEY,
  participant_id varchar(36) NOT NULL REFERENCES training_participants(id) ON DELETE CASCADE,
  source_assessment_id varchar(36) REFERENCES training_assessments(id) ON DELETE SET NULL,
  title varchar(220) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'open',
  priority varchar(20) NOT NULL DEFAULT 'medium',
  competency_gaps jsonb NOT NULL DEFAULT '[]'::jsonb,
  target_date date,
  owner_id varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  verification_summary text,
  completed_at timestamptz,
  completed_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  created_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_development_status_chk CHECK (status IN ('open', 'in_progress', 'verification', 'completed', 'cancelled')),
  CONSTRAINT training_development_priority_chk CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT training_development_gaps_chk CHECK (jsonb_typeof(competency_gaps) = 'array' AND jsonb_array_length(competency_gaps) > 0),
  CONSTRAINT training_development_completion_chk CHECK (status <> 'completed' OR (completed_at IS NOT NULL AND completed_by IS NOT NULL AND verification_summary IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS training_development_actions (
  id varchar(36) PRIMARY KEY,
  plan_id varchar(36) NOT NULL REFERENCES training_development_plans(id) ON DELETE CASCADE,
  action_type varchar(30) NOT NULL,
  description text NOT NULL,
  due_date date,
  status varchar(24) NOT NULL DEFAULT 'pending',
  evidence_reference varchar(500),
  notes text,
  completed_at timestamptz,
  completed_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  created_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_development_action_type_chk CHECK (action_type IN ('coaching', 'retraining', 'reassessment', 'practical_observation', 'mentoring', 'medical_review', 'administrative', 'other')),
  CONSTRAINT training_development_action_status_chk CHECK (status IN ('pending', 'in_progress', 'completed', 'waived')),
  CONSTRAINT training_development_action_completion_chk CHECK (status <> 'completed' OR (completed_at IS NOT NULL AND completed_by IS NOT NULL AND evidence_reference IS NOT NULL)),
  CONSTRAINT training_development_action_waiver_chk CHECK (status <> 'waived' OR notes IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS training_development_participant_idx ON training_development_plans(participant_id, created_at);
CREATE INDEX IF NOT EXISTS training_development_status_target_idx ON training_development_plans(status, target_date);
CREATE INDEX IF NOT EXISTS training_development_priority_idx ON training_development_plans(priority);
CREATE INDEX IF NOT EXISTS training_development_owner_idx ON training_development_plans(owner_id);
CREATE INDEX IF NOT EXISTS training_development_assessment_idx ON training_development_plans(source_assessment_id);
CREATE INDEX IF NOT EXISTS training_development_action_plan_status_idx ON training_development_actions(plan_id, status);
CREATE INDEX IF NOT EXISTS training_development_action_due_idx ON training_development_actions(status, due_date);
CREATE INDEX IF NOT EXISTS training_development_action_type_idx ON training_development_actions(action_type);

COMMIT;
