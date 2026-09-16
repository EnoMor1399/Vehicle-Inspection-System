ALTER TABLE training_assessments
  ADD COLUMN IF NOT EXISTS road_sign_score numeric(5,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'training_assessment_theory_score_chk'
  ) THEN
    ALTER TABLE training_assessments
      ADD CONSTRAINT training_assessment_theory_score_chk
      CHECK (theory_score IS NULL OR (theory_score >= 0 AND theory_score <= 100));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'training_assessment_road_sign_score_chk'
  ) THEN
    ALTER TABLE training_assessments
      ADD CONSTRAINT training_assessment_road_sign_score_chk
      CHECK (road_sign_score IS NULL OR (road_sign_score >= 0 AND road_sign_score <= 100));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'training_assessment_practical_score_chk'
  ) THEN
    ALTER TABLE training_assessments
      ADD CONSTRAINT training_assessment_practical_score_chk
      CHECK (practical_score IS NULL OR (practical_score >= 0 AND practical_score <= 100));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'training_assessment_overall_score_chk'
  ) THEN
    ALTER TABLE training_assessments
      ADD CONSTRAINT training_assessment_overall_score_chk
      CHECK (overall_score IS NULL OR (overall_score >= 0 AND overall_score <= 100));
  END IF;
END $$;

COMMENT ON COLUMN training_assessments.theory_score IS
  'Paper-based theory examination score out of 100.';
COMMENT ON COLUMN training_assessments.road_sign_score IS
  'Paper-based road-sign examination score out of 100.';
COMMENT ON COLUMN training_assessments.practical_score IS
  'Assessment performance score out of 100 derived from the digital driving assessment.';
COMMENT ON COLUMN training_assessments.overall_score IS
  'Total performance score out of 100: equal-weight average of theory, road signs, and assessment performance.';
