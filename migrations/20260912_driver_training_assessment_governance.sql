BEGIN;

ALTER TABLE training_assessments
  ADD COLUMN IF NOT EXISTS review_status varchar(24) NOT NULL DEFAULT 'pending_review',
  ADD COLUMN IF NOT EXISTS reviewer_id varchar(36),
  ADD COLUMN IF NOT EXISTS review_comments text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'training_assessment_reviewer_fk'
  ) THEN
    ALTER TABLE training_assessments
      ADD CONSTRAINT training_assessment_reviewer_fk
      FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'training_assessment_review_status_chk'
  ) THEN
    ALTER TABLE training_assessments
      ADD CONSTRAINT training_assessment_review_status_chk
      CHECK (review_status IN ('pending_review', 'approved', 'returned'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS training_assessment_review_status_idx
  ON training_assessments(review_status, assessed_at DESC);

CREATE INDEX IF NOT EXISTS training_assessment_reviewer_idx
  ON training_assessments(reviewer_id, reviewed_at DESC);

COMMIT;
