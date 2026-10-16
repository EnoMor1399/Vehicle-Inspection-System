-- Refuse to guess when a legacy Administrator has simultaneous domain scope.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM users
     WHERE role = 'admin'
       AND COALESCE((permissions->>'training')::boolean, false) = true
       AND COALESCE((permissions->>'vehicle_inspection')::boolean, true) = true
  ) THEN
    RAISE EXCEPTION 'Cannot migrate legacy Administrator with both Vehicle Inspection and Driver Training access';
  END IF;
END
$$;

-- Existing training-only administrators become Driver Training Administrators.
UPDATE users
   SET role = 'driver_training_admin',
       permissions = jsonb_set(
         jsonb_set(COALESCE(permissions, '{}'::jsonb) - '*', '{vehicle_inspection}', 'false'::jsonb, true),
         '{training}',
         'true'::jsonb,
         true
       ),
       location_id = NULL,
       transporter_id = NULL,
       updated_at = now()
 WHERE role = 'admin'
   AND COALESCE((permissions->>'training')::boolean, false) = true
   AND COALESCE((permissions->>'vehicle_inspection')::boolean, true) = false;

-- Remaining legacy administrators are Vehicle Inspection Administrators.
UPDATE users
   SET role = 'vehicle_inspection_admin',
       permissions = jsonb_set(
         jsonb_set(COALESCE(permissions, '{}'::jsonb) - '*', '{vehicle_inspection}', 'true'::jsonb, true),
         '{training}',
         'false'::jsonb,
         true
       ),
       updated_at = now()
 WHERE role = 'admin';

-- Every ordinary internal account must belong to exactly one operational
-- domain. Only Super Administrator can span both.
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_single_operational_domain_chk;

ALTER TABLE users
  ADD CONSTRAINT users_single_operational_domain_chk
  CHECK (
    role = 'super_admin'
    OR (
      NOT COALESCE((permissions->>'*')::boolean, false)
      AND COALESCE((permissions->>'vehicle_inspection')::boolean, true)
          <> COALESCE((permissions->>'training')::boolean, false)
    )
  );

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_role_domain_chk;

ALTER TABLE users
  ADD CONSTRAINT users_role_domain_chk
  CHECK (
    role NOT IN (
      'vehicle_inspection_admin',
      'driver_training_admin',
      'inspector',
      'instructor',
      'transporter_user'
    )
    OR (
      role IN ('vehicle_inspection_admin', 'inspector', 'transporter_user')
      AND COALESCE((permissions->>'vehicle_inspection')::boolean, true) = true
      AND COALESCE((permissions->>'training')::boolean, false) = false
    )
    OR (
      role IN ('driver_training_admin', 'instructor')
      AND COALESCE((permissions->>'vehicle_inspection')::boolean, true) = false
      AND COALESCE((permissions->>'training')::boolean, false) = true
    )
  );
