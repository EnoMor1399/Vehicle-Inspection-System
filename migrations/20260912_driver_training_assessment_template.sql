BEGIN;

ALTER TABLE training_assessments
  ADD COLUMN IF NOT EXISTS assessment_version varchar(20) NOT NULL DEFAULT 'driver-v1',
  ADD COLUMN IF NOT EXISTS criteria_ratings jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS criteria_comments jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS section_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS scored_points integer,
  ADD COLUMN IF NOT EXISTS maximum_points integer,
  ADD COLUMN IF NOT EXISTS classification varchar(30),
  ADD COLUMN IF NOT EXISTS critical_violations jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS qualitative_feedback jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS development_plan jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS final_recommendation varchar(50),
  ADD COLUMN IF NOT EXISTS driver_acknowledged boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS driver_comments text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'training_assessment_points_chk'
  ) THEN
    ALTER TABLE training_assessments
      ADD CONSTRAINT training_assessment_points_chk CHECK (
        (scored_points IS NULL AND maximum_points IS NULL)
        OR (scored_points IS NOT NULL AND maximum_points IS NOT NULL AND scored_points >= 0 AND maximum_points > 0 AND scored_points <= maximum_points)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'training_assessment_classification_chk'
  ) THEN
    ALTER TABLE training_assessments
      ADD CONSTRAINT training_assessment_classification_chk CHECK (
        classification IS NULL OR classification IN ('excellent', 'very_good', 'satisfactory', 'needs_improvement', 'unsatisfactory')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'training_assessment_recommendation_chk'
  ) THEN
    ALTER TABLE training_assessments
      ADD CONSTRAINT training_assessment_recommendation_chk CHECK (
        final_recommendation IS NULL OR final_recommendation IN (
          'highly_competent',
          'competent',
          'competent_with_development_needs',
          'requires_coaching',
          'requires_retraining',
          'not_yet_competent',
          'unsafe_pending_corrective_action'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS training_assessment_classification_idx
  ON training_assessments(classification, assessed_at DESC);

CREATE INDEX IF NOT EXISTS training_assessment_recommendation_idx
  ON training_assessments(final_recommendation, assessed_at DESC);

COMMIT;
