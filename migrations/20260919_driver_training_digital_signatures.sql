BEGIN;

ALTER TABLE training_assessments
  ADD COLUMN IF NOT EXISTS assessor_signature text,
  ADD COLUMN IF NOT EXISTS reviewer_signature text;

COMMENT ON COLUMN training_assessments.assessor_signature IS
  'PNG data URL captured from the authenticated assessor at assessment submission.';

COMMENT ON COLUMN training_assessments.reviewer_signature IS
  'PNG data URL captured from the authenticated reviewer/supervisor when approving an assessment.';

COMMIT;
