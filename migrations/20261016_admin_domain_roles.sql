-- Add explicit administration roles in a standalone migration so the
-- enum values are committed before they are used by the assignment migration.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'vehicle_inspection_admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'driver_training_admin';
