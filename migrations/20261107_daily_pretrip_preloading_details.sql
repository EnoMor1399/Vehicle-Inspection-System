-- VIMS pre-trip / pre-loading inspection details.
-- Additive JSONB column: old daily inspections continue to load unchanged.
-- New checklist responses are stored inside the existing checklist JSONB.
ALTER TABLE daily_inspections
  ADD COLUMN IF NOT EXISTS preloading_details jsonb NOT NULL DEFAULT '{}'::jsonb;
