-- VIMS Vehicle Inspection Section E: component-specific brake test readings.
-- Additive-only migration. Existing inspections, certificates, outcomes and
-- general service/parking brake readings are preserved unchanged.
-- Four nullable columns enable separate reporting for trailer head (tractor)
-- and tanker/flatbed braking systems. A missing reading remains NULL (not 0).
ALTER TABLE inspections
  ADD COLUMN IF NOT EXISTS trailer_head_service_brake_efficiency numeric(5,2),
  ADD COLUMN IF NOT EXISTS trailer_head_parking_brake_efficiency numeric(5,2),
  ADD COLUMN IF NOT EXISTS tanker_flatbed_service_brake_efficiency numeric(5,2),
  ADD COLUMN IF NOT EXISTS tanker_flatbed_parking_brake_efficiency numeric(5,2);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'inspections'::regclass AND conname = 'vims_trailer_head_service_brake_range') THEN
    ALTER TABLE inspections ADD CONSTRAINT vims_trailer_head_service_brake_range
      CHECK (trailer_head_service_brake_efficiency BETWEEN 0 AND 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'inspections'::regclass AND conname = 'vims_trailer_head_parking_brake_range') THEN
    ALTER TABLE inspections ADD CONSTRAINT vims_trailer_head_parking_brake_range
      CHECK (trailer_head_parking_brake_efficiency BETWEEN 0 AND 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'inspections'::regclass AND conname = 'vims_tanker_flatbed_service_brake_range') THEN
    ALTER TABLE inspections ADD CONSTRAINT vims_tanker_flatbed_service_brake_range
      CHECK (tanker_flatbed_service_brake_efficiency BETWEEN 0 AND 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'inspections'::regclass AND conname = 'vims_tanker_flatbed_parking_brake_range') THEN
    ALTER TABLE inspections ADD CONSTRAINT vims_tanker_flatbed_parking_brake_range
      CHECK (tanker_flatbed_parking_brake_efficiency BETWEEN 0 AND 100);
  END IF;
END $$;
