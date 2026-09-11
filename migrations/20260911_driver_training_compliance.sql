BEGIN;

CREATE TABLE IF NOT EXISTS training_compliance_cases (
  id varchar(36) PRIMARY KEY,
  participant_id varchar(36) NOT NULL REFERENCES training_participants(id) ON DELETE CASCADE,
  certificate_id varchar(36) REFERENCES training_certificates(id) ON DELETE SET NULL,
  case_type varchar(30) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'open',
  priority varchar(20) NOT NULL DEFAULT 'medium',
  due_date date,
  assigned_to varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  preferred_channel varchar(20),
  contact_count integer NOT NULL DEFAULT 0,
  last_contacted_at timestamptz,
  next_follow_up_date date,
  notes text,
  created_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_compliance_case_type_chk CHECK (case_type IN ('renewal', 'reassessment', 'licence_expiry', 'high_risk')),
  CONSTRAINT training_compliance_status_chk CHECK (status IN ('open', 'contacted', 'scheduled', 'resolved', 'dismissed')),
  CONSTRAINT training_compliance_priority_chk CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT training_compliance_channel_chk CHECK (preferred_channel IS NULL OR preferred_channel IN ('email', 'phone', 'sms', 'whatsapp', 'in_person')),
  CONSTRAINT training_compliance_contact_count_chk CHECK (contact_count BETWEEN 0 AND 10000)
);

CREATE TABLE IF NOT EXISTS training_compliance_events (
  id varchar(36) PRIMARY KEY,
  case_id varchar(36) NOT NULL REFERENCES training_compliance_cases(id) ON DELETE CASCADE,
  event_type varchar(30) NOT NULL,
  channel varchar(20),
  summary text NOT NULL,
  created_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_compliance_event_type_chk CHECK (event_type IN ('case_opened', 'reminder_prepared', 'contact_recorded', 'status_changed', 'note')),
  CONSTRAINT training_compliance_event_channel_chk CHECK (channel IS NULL OR channel IN ('email', 'phone', 'sms', 'whatsapp', 'in_person')),
  CONSTRAINT training_compliance_event_summary_chk CHECK (char_length(summary) BETWEEN 1 AND 4000)
);

CREATE INDEX IF NOT EXISTS training_compliance_participant_idx ON training_compliance_cases(participant_id);
CREATE INDEX IF NOT EXISTS training_compliance_certificate_idx ON training_compliance_cases(certificate_id);
CREATE INDEX IF NOT EXISTS training_compliance_status_due_idx ON training_compliance_cases(status, due_date);
CREATE INDEX IF NOT EXISTS training_compliance_assigned_idx ON training_compliance_cases(assigned_to);
CREATE INDEX IF NOT EXISTS training_compliance_event_case_created_idx ON training_compliance_events(case_id, created_at);

-- At most one unresolved case of a given type may exist for the same
-- participant/certificate pair. Advisory locks in the application serialize
-- creation; this partial unique index remains the database backstop.
CREATE UNIQUE INDEX IF NOT EXISTS training_compliance_active_case_uidx
  ON training_compliance_cases(participant_id, case_type, COALESCE(certificate_id, ''))
  WHERE status IN ('open', 'contacted', 'scheduled');

COMMIT;
