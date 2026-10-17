-- VIMS tenant data-plane isolation: core operational tables.
-- Existing production data is assigned to the legacy RSL organization.
-- New records require an explicit organization boundary.

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'daily_inspections',
    'webhooks',
    'locations',
    'transporters',
    'vehicles',
    'rfid_tags',
    'inspections',
    'inspection_appointments',
    'documents',
    'audit_logs',
    'notifications',
    'import_jobs',
    'api_keys',
    'signatures',
    'security_events'
  ]
  LOOP
    -- The legacy organization is assigned ONLY to existing rows that need backfill.
    -- A repeated upgrade must never restore an implicit tenant default.
    EXECUTE format(
      'ALTER TABLE %I ADD COLUMN IF NOT EXISTS organization_id varchar(36)',
      table_name
    );
    EXECUTE format(
      'UPDATE %I SET organization_id = %L WHERE organization_id IS NULL',
      table_name,
      '00000000-0000-4000-8000-000000000101'
    );
    EXECUTE format('ALTER TABLE %I ALTER COLUMN organization_id SET NOT NULL', table_name);
    -- Explicit tenant ownership is mandatory on every future write.
    -- Also repairs legacy defaults if this migration is rerun.
    EXECUTE format('ALTER TABLE %I ALTER COLUMN organization_id DROP DEFAULT', table_name);

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = table_name::regclass
        AND conname = table_name || '_organization_id_fkey'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT',
        table_name,
        table_name || '_organization_id_fkey'
      );
    END IF;
  END LOOP;
END
$$;

-- Existing users already carry organization_id. Enforce tenant consistency
-- for location/transporter assignments as part of the operational boundary.
ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_code_unique;
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_registration_number_unique;
ALTER TABLE rfid_tags DROP CONSTRAINT IF EXISTS rfid_tags_tag_uid_unique;
ALTER TABLE inspections DROP CONSTRAINT IF EXISTS inspections_inspection_number_unique;
ALTER TABLE inspection_appointments DROP CONSTRAINT IF EXISTS inspection_appointments_appointment_number_key;

CREATE UNIQUE INDEX IF NOT EXISTS location_organization_code_uidx
  ON locations(organization_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS vehicle_organization_reg_uidx
  ON vehicles(organization_id, registration_number);
CREATE UNIQUE INDEX IF NOT EXISTS rfid_organization_tag_uidx
  ON rfid_tags(organization_id, tag_uid);
CREATE UNIQUE INDEX IF NOT EXISTS inspection_organization_number_uidx
  ON inspections(organization_id, inspection_number);
CREATE UNIQUE INDEX IF NOT EXISTS inspection_appointment_organization_number_uidx
  ON inspection_appointments(organization_id, appointment_number);

CREATE INDEX IF NOT EXISTS daily_insp_organization_idx ON daily_inspections(organization_id);
CREATE INDEX IF NOT EXISTS daily_insp_organization_date_idx ON daily_inspections(organization_id, inspection_date DESC);
CREATE INDEX IF NOT EXISTS webhook_organization_idx ON webhooks(organization_id);
CREATE INDEX IF NOT EXISTS location_organization_idx ON locations(organization_id);
CREATE INDEX IF NOT EXISTS transporter_organization_idx ON transporters(organization_id);
CREATE INDEX IF NOT EXISTS transporter_organization_company_idx ON transporters(organization_id, company_name);
CREATE INDEX IF NOT EXISTS vehicle_organization_idx ON vehicles(organization_id);
CREATE INDEX IF NOT EXISTS vehicle_organization_status_idx ON vehicles(organization_id, status);
CREATE INDEX IF NOT EXISTS rfid_organization_idx ON rfid_tags(organization_id);
CREATE INDEX IF NOT EXISTS inspection_organization_idx ON inspections(organization_id);
CREATE INDEX IF NOT EXISTS inspection_organization_date_idx ON inspections(organization_id, inspection_date DESC);
CREATE INDEX IF NOT EXISTS inspection_organization_result_date_idx ON inspections(organization_id, overall_result, inspection_date DESC);
CREATE INDEX IF NOT EXISTS inspection_appointment_organization_idx ON inspection_appointments(organization_id);
CREATE INDEX IF NOT EXISTS inspection_appointment_organization_scheduled_idx ON inspection_appointments(organization_id, scheduled_at);
CREATE INDEX IF NOT EXISTS document_organization_idx ON documents(organization_id);
CREATE INDEX IF NOT EXISTS document_organization_owner_idx ON documents(organization_id, owner_type, owner_id);
CREATE INDEX IF NOT EXISTS audit_organization_idx ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS audit_organization_created_idx ON audit_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notification_organization_idx ON notifications(organization_id);
CREATE INDEX IF NOT EXISTS notification_organization_created_idx ON notifications(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS import_organization_idx ON import_jobs(organization_id);
CREATE INDEX IF NOT EXISTS import_organization_created_idx ON import_jobs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS api_key_organization_idx ON api_keys(organization_id);
CREATE INDEX IF NOT EXISTS signature_organization_idx ON signatures(organization_id);
CREATE INDEX IF NOT EXISTS security_event_organization_idx ON security_events(organization_id);
CREATE INDEX IF NOT EXISTS security_event_organization_created_idx ON security_events(organization_id, created_at DESC);

-- Generic trigger guard: referenced records must exist and belong to the
-- same organization as the row being written.
CREATE OR REPLACE FUNCTION vims_enforce_tenant_references()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  i integer;
  ref_column text;
  ref_table text;
  ref_id text;
  ref_organization_id text;
BEGIN
  IF NEW.organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id is required for %', TG_TABLE_NAME;
  END IF;

  i := 0;
  WHILE i < TG_NARGS LOOP
    ref_column := TG_ARGV[i];
    ref_table := TG_ARGV[i + 1];
    ref_id := to_jsonb(NEW) ->> ref_column;

    IF ref_id IS NOT NULL AND ref_id <> '' THEN
      EXECUTE format(
        'SELECT organization_id::text FROM %I WHERE id = $1 LIMIT 1',
        ref_table
      )
      INTO ref_organization_id
      USING ref_id;

      IF ref_organization_id IS NULL THEN
        RAISE EXCEPTION 'Referenced % record % was not found', ref_table, ref_id;
      END IF;

      IF ref_organization_id <> NEW.organization_id::text THEN
        RAISE EXCEPTION 'Cross-organization reference rejected on %.% -> %',
          TG_TABLE_NAME, ref_column, ref_table;
      END IF;
    END IF;

    i := i + 2;
  END LOOP;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS users_tenant_reference_guard ON users;
CREATE TRIGGER users_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, location_id, transporter_id
ON users
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'location_id', 'locations',
  'transporter_id', 'transporters'
);

DROP TRIGGER IF EXISTS vehicle_tenant_reference_guard ON vehicles;
CREATE TRIGGER vehicle_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, transporter_id
ON vehicles
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'transporter_id', 'transporters'
);

DROP TRIGGER IF EXISTS rfid_tenant_reference_guard ON rfid_tags;
CREATE TRIGGER rfid_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, vehicle_id, assigned_by
ON rfid_tags
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'vehicle_id', 'vehicles',
  'assigned_by', 'users'
);

DROP TRIGGER IF EXISTS inspection_tenant_reference_guard ON inspections;
CREATE TRIGGER inspection_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, vehicle_id, location_id, inspector_id, supervisor_id
ON inspections
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'vehicle_id', 'vehicles',
  'location_id', 'locations',
  'inspector_id', 'users',
  'supervisor_id', 'users'
);

DROP TRIGGER IF EXISTS appointment_tenant_reference_guard ON inspection_appointments;
CREATE TRIGGER appointment_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, vehicle_id, location_id, assigned_inspector_id, linked_inspection_id, booked_by
ON inspection_appointments
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'vehicle_id', 'vehicles',
  'location_id', 'locations',
  'assigned_inspector_id', 'users',
  'linked_inspection_id', 'inspections',
  'booked_by', 'users'
);

DROP TRIGGER IF EXISTS daily_inspection_tenant_reference_guard ON daily_inspections;
CREATE TRIGGER daily_inspection_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, vehicle_id, driver_id, supervisor_id
ON daily_inspections
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'vehicle_id', 'vehicles',
  'driver_id', 'users',
  'supervisor_id', 'users'
);

DROP TRIGGER IF EXISTS webhook_tenant_reference_guard ON webhooks;
CREATE TRIGGER webhook_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, user_id
ON webhooks
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references('user_id', 'users');

DROP TRIGGER IF EXISTS notification_tenant_reference_guard ON notifications;
CREATE TRIGGER notification_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, user_id
ON notifications
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references('user_id', 'users');

DROP TRIGGER IF EXISTS import_job_tenant_reference_guard ON import_jobs;
CREATE TRIGGER import_job_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, created_by
ON import_jobs
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references('created_by', 'users');

DROP TRIGGER IF EXISTS api_key_tenant_reference_guard ON api_keys;
CREATE TRIGGER api_key_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, user_id
ON api_keys
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references('user_id', 'users');

DROP TRIGGER IF EXISTS signature_tenant_reference_guard ON signatures;
CREATE TRIGGER signature_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, inspection_id, signer_id
ON signatures
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'inspection_id', 'inspections',
  'signer_id', 'users'
);

DROP TRIGGER IF EXISTS audit_tenant_reference_guard ON audit_logs;
CREATE TRIGGER audit_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, user_id
ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references('user_id', 'users');

DROP TRIGGER IF EXISTS security_event_tenant_reference_guard ON security_events;
CREATE TRIGGER security_event_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, user_id, resolved_by
ON security_events
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'user_id', 'users',
  'resolved_by', 'users'
);

-- Polymorphic document owners must also stay inside the organization.
CREATE OR REPLACE FUNCTION vims_enforce_document_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  owner_table text;
  owner_organization_id text;
BEGIN
  IF NEW.uploaded_by IS NOT NULL THEN
    SELECT organization_id::text
      INTO owner_organization_id
      FROM users
     WHERE id = NEW.uploaded_by;

    IF owner_organization_id IS NULL OR owner_organization_id <> NEW.organization_id::text THEN
      RAISE EXCEPTION 'Cross-organization document uploader rejected';
    END IF;
  END IF;

  owner_table := CASE NEW.owner_type
    WHEN 'vehicle' THEN 'vehicles'
    WHEN 'transporter' THEN 'transporters'
    WHEN 'inspection' THEN 'inspections'
    WHEN 'location' THEN 'locations'
    WHEN 'user' THEN 'users'
    ELSE NULL
  END;

  IF owner_table IS NOT NULL THEN
    EXECUTE format(
      'SELECT organization_id::text FROM %I WHERE id = $1 LIMIT 1',
      owner_table
    )
    INTO owner_organization_id
    USING NEW.owner_id;

    IF owner_organization_id IS NULL THEN
      RAISE EXCEPTION 'Document owner % record % was not found', owner_table, NEW.owner_id;
    END IF;

    IF owner_organization_id <> NEW.organization_id::text THEN
      RAISE EXCEPTION 'Cross-organization document owner rejected';
    END IF;
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS document_tenant_reference_guard ON documents;
CREATE TRIGGER document_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, owner_type, owner_id, uploaded_by
ON documents
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_document_tenant();
