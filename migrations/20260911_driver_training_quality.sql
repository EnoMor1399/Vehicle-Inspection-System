BEGIN;

CREATE TABLE IF NOT EXISTS training_session_feedback (
  id varchar(36) PRIMARY KEY,
  session_id varchar(36) NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  participant_id varchar(36) REFERENCES training_participants(id) ON DELETE SET NULL,
  respondent_type varchar(24) NOT NULL,
  content_rating integer NOT NULL,
  instructor_rating integer NOT NULL,
  practical_rating integer NOT NULL,
  safety_rating integer NOT NULL,
  overall_rating integer NOT NULL,
  would_recommend boolean,
  comments text,
  improvement_suggestions text,
  anonymous boolean NOT NULL DEFAULT false,
  submitted_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_feedback_respondent_chk CHECK (respondent_type IN ('participant', 'client', 'instructor', 'observer')),
  CONSTRAINT training_feedback_ratings_chk CHECK (
    content_rating BETWEEN 1 AND 5
    AND instructor_rating BETWEEN 1 AND 5
    AND practical_rating BETWEEN 1 AND 5
    AND safety_rating BETWEEN 1 AND 5
    AND overall_rating BETWEEN 1 AND 5
  ),
  CONSTRAINT training_feedback_comments_chk CHECK (comments IS NULL OR char_length(comments) <= 4000),
  CONSTRAINT training_feedback_improvements_chk CHECK (improvement_suggestions IS NULL OR char_length(improvement_suggestions) <= 4000)
);

CREATE INDEX IF NOT EXISTS training_feedback_session_idx ON training_session_feedback(session_id, created_at);
CREATE INDEX IF NOT EXISTS training_feedback_participant_idx ON training_session_feedback(participant_id);
CREATE INDEX IF NOT EXISTS training_feedback_rating_idx ON training_session_feedback(overall_rating);

CREATE TABLE IF NOT EXISTS training_quality_findings (
  id varchar(36) PRIMARY KEY,
  session_id varchar(36) NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  participant_id varchar(36) REFERENCES training_participants(id) ON DELETE SET NULL,
  source varchar(30) NOT NULL,
  category varchar(40) NOT NULL,
  severity varchar(20) NOT NULL DEFAULT 'medium',
  status varchar(24) NOT NULL DEFAULT 'open',
  title varchar(220) NOT NULL,
  description text NOT NULL,
  root_cause text,
  action_plan text,
  owner_id varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  due_date date,
  closure_evidence text,
  effectiveness_review text,
  created_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  closed_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_quality_source_chk CHECK (source IN ('feedback', 'assessment', 'evidence', 'readiness', 'incident', 'audit', 'management_review')),
  CONSTRAINT training_quality_category_chk CHECK (category IN ('training_content', 'instructor', 'safety', 'equipment', 'attendance', 'assessment', 'documentation', 'client_service', 'other')),
  CONSTRAINT training_quality_severity_chk CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT training_quality_status_chk CHECK (status IN ('open', 'in_progress', 'verification', 'closed', 'dismissed')),
  CONSTRAINT training_quality_title_chk CHECK (char_length(title) BETWEEN 3 AND 220),
  CONSTRAINT training_quality_description_chk CHECK (char_length(btrim(description)) BETWEEN 5 AND 4000),
  CONSTRAINT training_quality_closure_chk CHECK (
    status <> 'closed'
    OR (
      root_cause IS NOT NULL AND char_length(btrim(root_cause)) >= 5
      AND action_plan IS NOT NULL AND char_length(btrim(action_plan)) >= 5
      AND closure_evidence IS NOT NULL AND char_length(btrim(closure_evidence)) >= 5
      AND effectiveness_review IS NOT NULL AND char_length(btrim(effectiveness_review)) >= 5
      AND closed_by IS NOT NULL
      AND closed_at IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS training_quality_session_idx ON training_quality_findings(session_id, created_at);
CREATE INDEX IF NOT EXISTS training_quality_status_due_idx ON training_quality_findings(status, due_date);
CREATE INDEX IF NOT EXISTS training_quality_severity_idx ON training_quality_findings(severity);
CREATE INDEX IF NOT EXISTS training_quality_owner_idx ON training_quality_findings(owner_id, status);

CREATE TABLE IF NOT EXISTS training_quality_events (
  id varchar(36) PRIMARY KEY,
  finding_id varchar(36) NOT NULL REFERENCES training_quality_findings(id) ON DELETE CASCADE,
  event_type varchar(30) NOT NULL,
  summary text NOT NULL,
  created_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_quality_event_type_chk CHECK (event_type IN ('created', 'progress_updated', 'status_changed', 'verification', 'closed', 'note')),
  CONSTRAINT training_quality_event_summary_chk CHECK (char_length(btrim(summary)) BETWEEN 1 AND 4000)
);

CREATE INDEX IF NOT EXISTS training_quality_event_finding_created_idx ON training_quality_events(finding_id, created_at);

COMMIT;
