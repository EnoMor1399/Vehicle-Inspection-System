-- Dedicated Driver Training Instructor account role.
-- This is additive and backward-compatible with existing user_role values.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'instructor';
