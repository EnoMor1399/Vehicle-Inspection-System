-- VIMS Driver Training tenant data-plane isolation.
-- Existing Driver Training records belong to the legacy RSL organization.
-- Every new training record must carry an explicit organization boundary.

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'training_sessions',
    'training_participants',
    'training_assessments',
    'training_certificates',
    'training_compliance_cases',
    'training_compliance_events',
    'training_requests',
    'training_request_events',
    'training_quotations',
    'training_quotation_items',
    'training_communication_preferences',
    'training_outbound_messages',
    'training_communication_events',
    'training_curricula',
    'training_curriculum_versions',
    'training_session_curricula',
    'training_matrix_requirements',
    'training_development_plans',
    'training_development_actions',
    'training_attendance_signoffs',
    'training_evidence_records',
    'training_resources',
    'training_resource_allocations',
    'training_session_feedback',
    'training_quality_findings',
    'training_quality_events',
    'training_instructor_profiles',
    'training_session_readiness',
    'training_risk_assessments',
    'training_safety_hazards',
    'training_safety_incidents',
    'training_regulatory_requirements',
    'training_accreditation_records',
    'training_session_compliance_reviews'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS organization_id varchar(36)', table_name);
    EXECUTE format(
      'UPDATE %I SET organization_id = %L WHERE organization_id IS NULL',
      table_name,
      '00000000-0000-4000-8000-000000000101'
    );
    EXECUTE format('ALTER TABLE %I ALTER COLUMN organization_id SET NOT NULL', table_name);

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

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I(organization_id)',
      table_name || '_organization_idx',
      table_name
    );
  END LOOP;
END
$$;

-- Business identifiers are unique inside an organization, not globally.
DROP INDEX IF EXISTS training_session_reference_uidx;
CREATE UNIQUE INDEX training_session_reference_uidx
  ON training_sessions(organization_id, reference_number);

DROP INDEX IF EXISTS training_certificate_number_uidx;
CREATE UNIQUE INDEX training_certificate_number_uidx
  ON training_certificates(organization_id, certificate_number);

DROP INDEX IF EXISTS training_request_number_uidx;
CREATE UNIQUE INDEX training_request_number_uidx
  ON training_requests(organization_id, request_number);

DROP INDEX IF EXISTS training_quotation_number_uidx;
CREATE UNIQUE INDEX training_quotation_number_uidx
  ON training_quotations(organization_id, quotation_number);

DROP INDEX IF EXISTS training_curriculum_code_uidx;
CREATE UNIQUE INDEX training_curriculum_code_uidx
  ON training_curricula(organization_id, code);

DROP INDEX IF EXISTS training_matrix_requirement_key_uidx;
CREATE UNIQUE INDEX training_matrix_requirement_key_uidx
  ON training_matrix_requirements(organization_id, requirement_key);

DROP INDEX IF EXISTS training_resource_code_uidx;
CREATE UNIQUE INDEX training_resource_code_uidx
  ON training_resources(organization_id, resource_code);

DROP INDEX IF EXISTS training_instructor_code_uidx;
CREATE UNIQUE INDEX training_instructor_code_uidx
  ON training_instructor_profiles(organization_id, instructor_code);

DROP INDEX IF EXISTS training_safety_incident_number_uidx;
CREATE UNIQUE INDEX training_safety_incident_number_uidx
  ON training_safety_incidents(organization_id, incident_number);

DROP INDEX IF EXISTS training_regulatory_requirement_code_uidx;
CREATE UNIQUE INDEX training_regulatory_requirement_code_uidx
  ON training_regulatory_requirements(organization_id, requirement_code);

-- Keep certificate verification codes globally unique because they are public
-- verification tokens and must resolve to exactly one certificate.

DROP TRIGGER IF EXISTS training_sessions_tenant_reference_guard ON training_sessions;
CREATE TRIGGER training_sessions_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, transporter_id, location_id, instructor_id, created_by
ON training_sessions
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'transporter_id', 'transporters',
  'location_id', 'locations',
  'instructor_id', 'users',
  'created_by', 'users'
);

DROP TRIGGER IF EXISTS training_participants_tenant_reference_guard ON training_participants;
CREATE TRIGGER training_participants_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, session_id, created_by
ON training_participants
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'session_id', 'training_sessions',
  'created_by', 'users'
);

DROP TRIGGER IF EXISTS training_assessments_tenant_reference_guard ON training_assessments;
CREATE TRIGGER training_assessments_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, participant_id, session_id, assessor_id, reviewer_id
ON training_assessments
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'participant_id', 'training_participants',
  'session_id', 'training_sessions',
  'assessor_id', 'users',
  'reviewer_id', 'users'
);

DROP TRIGGER IF EXISTS training_certificates_tenant_reference_guard ON training_certificates;
CREATE TRIGGER training_certificates_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, participant_id, session_id, issued_by
ON training_certificates
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'participant_id', 'training_participants',
  'session_id', 'training_sessions',
  'issued_by', 'users'
);

DROP TRIGGER IF EXISTS training_compliance_cases_tenant_reference_guard ON training_compliance_cases;
CREATE TRIGGER training_compliance_cases_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, participant_id, certificate_id, assigned_to, created_by
ON training_compliance_cases
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'participant_id', 'training_participants',
  'certificate_id', 'training_certificates',
  'assigned_to', 'users',
  'created_by', 'users'
);

DROP TRIGGER IF EXISTS training_compliance_events_tenant_reference_guard ON training_compliance_events;
CREATE TRIGGER training_compliance_events_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, case_id, created_by
ON training_compliance_events
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'case_id', 'training_compliance_cases',
  'created_by', 'users'
);

DROP TRIGGER IF EXISTS training_requests_tenant_reference_guard ON training_requests;
CREATE TRIGGER training_requests_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, location_id, requested_by, reviewed_by, scheduled_session_id
ON training_requests
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'location_id', 'locations',
  'requested_by', 'users',
  'reviewed_by', 'users',
  'scheduled_session_id', 'training_sessions'
);

DROP TRIGGER IF EXISTS training_request_events_tenant_reference_guard ON training_request_events;
CREATE TRIGGER training_request_events_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, request_id, created_by
ON training_request_events
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'request_id', 'training_requests',
  'created_by', 'users'
);

DROP TRIGGER IF EXISTS training_quotations_tenant_reference_guard ON training_quotations;
CREATE TRIGGER training_quotations_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, request_id, prepared_by, approved_by
ON training_quotations
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'request_id', 'training_requests',
  'prepared_by', 'users',
  'approved_by', 'users'
);

DROP TRIGGER IF EXISTS training_quotation_items_tenant_reference_guard ON training_quotation_items;
CREATE TRIGGER training_quotation_items_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, quotation_id
ON training_quotation_items
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'quotation_id', 'training_quotations'
);

DROP TRIGGER IF EXISTS training_communication_preferences_tenant_reference_guard ON training_communication_preferences;
CREATE TRIGGER training_communication_preferences_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, participant_id, consent_recorded_by
ON training_communication_preferences
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'participant_id', 'training_participants',
  'consent_recorded_by', 'users'
);

DROP TRIGGER IF EXISTS training_outbound_messages_tenant_reference_guard ON training_outbound_messages;
CREATE TRIGGER training_outbound_messages_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, participant_id, session_id, certificate_id, prepared_by, approved_by
ON training_outbound_messages
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'participant_id', 'training_participants',
  'session_id', 'training_sessions',
  'certificate_id', 'training_certificates',
  'prepared_by', 'users',
  'approved_by', 'users'
);

DROP TRIGGER IF EXISTS training_communication_events_tenant_reference_guard ON training_communication_events;
CREATE TRIGGER training_communication_events_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, message_id, created_by
ON training_communication_events
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'message_id', 'training_outbound_messages',
  'created_by', 'users'
);

DROP TRIGGER IF EXISTS training_curricula_tenant_reference_guard ON training_curricula;
CREATE TRIGGER training_curricula_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, owner_id, created_by
ON training_curricula
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'owner_id', 'users',
  'created_by', 'users'
);

DROP TRIGGER IF EXISTS training_curriculum_versions_tenant_reference_guard ON training_curriculum_versions;
CREATE TRIGGER training_curriculum_versions_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, curriculum_id, created_by, approved_by
ON training_curriculum_versions
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'curriculum_id', 'training_curricula',
  'created_by', 'users',
  'approved_by', 'users'
);

DROP TRIGGER IF EXISTS training_session_curricula_tenant_reference_guard ON training_session_curricula;
CREATE TRIGGER training_session_curricula_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, session_id, curriculum_version_id, assigned_by
ON training_session_curricula
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'session_id', 'training_sessions',
  'curriculum_version_id', 'training_curriculum_versions',
  'assigned_by', 'users'
);

DROP TRIGGER IF EXISTS training_matrix_requirements_tenant_reference_guard ON training_matrix_requirements;
CREATE TRIGGER training_matrix_requirements_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, created_by
ON training_matrix_requirements
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'created_by', 'users'
);

DROP TRIGGER IF EXISTS training_development_plans_tenant_reference_guard ON training_development_plans;
CREATE TRIGGER training_development_plans_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, participant_id, source_assessment_id, owner_id, completed_by, created_by
ON training_development_plans
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'participant_id', 'training_participants',
  'source_assessment_id', 'training_assessments',
  'owner_id', 'users',
  'completed_by', 'users',
  'created_by', 'users'
);

DROP TRIGGER IF EXISTS training_development_actions_tenant_reference_guard ON training_development_actions;
CREATE TRIGGER training_development_actions_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, plan_id, completed_by, created_by
ON training_development_actions
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'plan_id', 'training_development_plans',
  'completed_by', 'users',
  'created_by', 'users'
);

DROP TRIGGER IF EXISTS training_attendance_signoffs_tenant_reference_guard ON training_attendance_signoffs;
CREATE TRIGGER training_attendance_signoffs_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, participant_id, session_id, confirmed_by, created_by
ON training_attendance_signoffs
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'participant_id', 'training_participants',
  'session_id', 'training_sessions',
  'confirmed_by', 'users',
  'created_by', 'users'
);

DROP TRIGGER IF EXISTS training_evidence_records_tenant_reference_guard ON training_evidence_records;
CREATE TRIGGER training_evidence_records_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, session_id, participant_id, captured_by, verified_by
ON training_evidence_records
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'session_id', 'training_sessions',
  'participant_id', 'training_participants',
  'captured_by', 'users',
  'verified_by', 'users'
);

DROP TRIGGER IF EXISTS training_resources_tenant_reference_guard ON training_resources;
CREATE TRIGGER training_resources_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, location_id, created_by
ON training_resources
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'location_id', 'locations',
  'created_by', 'users'
);

DROP TRIGGER IF EXISTS training_resource_allocations_tenant_reference_guard ON training_resource_allocations;
CREATE TRIGGER training_resource_allocations_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, resource_id, session_id, allocated_by
ON training_resource_allocations
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'resource_id', 'training_resources',
  'session_id', 'training_sessions',
  'allocated_by', 'users'
);

DROP TRIGGER IF EXISTS training_session_feedback_tenant_reference_guard ON training_session_feedback;
CREATE TRIGGER training_session_feedback_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, session_id, participant_id, submitted_by
ON training_session_feedback
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'session_id', 'training_sessions',
  'participant_id', 'training_participants',
  'submitted_by', 'users'
);

DROP TRIGGER IF EXISTS training_quality_findings_tenant_reference_guard ON training_quality_findings;
CREATE TRIGGER training_quality_findings_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, session_id, participant_id, owner_id, created_by, closed_by
ON training_quality_findings
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'session_id', 'training_sessions',
  'participant_id', 'training_participants',
  'owner_id', 'users',
  'created_by', 'users',
  'closed_by', 'users'
);

DROP TRIGGER IF EXISTS training_quality_events_tenant_reference_guard ON training_quality_events;
CREATE TRIGGER training_quality_events_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, finding_id, created_by
ON training_quality_events
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'finding_id', 'training_quality_findings',
  'created_by', 'users'
);

DROP TRIGGER IF EXISTS training_instructor_profiles_tenant_reference_guard ON training_instructor_profiles;
CREATE TRIGGER training_instructor_profiles_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, user_id, created_by
ON training_instructor_profiles
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'user_id', 'users',
  'created_by', 'users'
);

DROP TRIGGER IF EXISTS training_session_readiness_tenant_reference_guard ON training_session_readiness;
CREATE TRIGGER training_session_readiness_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, session_id, reviewed_by
ON training_session_readiness
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'session_id', 'training_sessions',
  'reviewed_by', 'users'
);

DROP TRIGGER IF EXISTS training_risk_assessments_tenant_reference_guard ON training_risk_assessments;
CREATE TRIGGER training_risk_assessments_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, session_id, assessed_by, approved_by
ON training_risk_assessments
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'session_id', 'training_sessions',
  'assessed_by', 'users',
  'approved_by', 'users'
);

DROP TRIGGER IF EXISTS training_safety_hazards_tenant_reference_guard ON training_safety_hazards;
CREATE TRIGGER training_safety_hazards_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, assessment_id, owner_id, created_by
ON training_safety_hazards
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'assessment_id', 'training_risk_assessments',
  'owner_id', 'users',
  'created_by', 'users'
);

DROP TRIGGER IF EXISTS training_safety_incidents_tenant_reference_guard ON training_safety_incidents;
CREATE TRIGGER training_safety_incidents_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, session_id, participant_id, owner_id, reported_by, closed_by
ON training_safety_incidents
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'session_id', 'training_sessions',
  'participant_id', 'training_participants',
  'owner_id', 'users',
  'reported_by', 'users',
  'closed_by', 'users'
);

DROP TRIGGER IF EXISTS training_regulatory_requirements_tenant_reference_guard ON training_regulatory_requirements;
CREATE TRIGGER training_regulatory_requirements_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, created_by
ON training_regulatory_requirements
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'created_by', 'users'
);

DROP TRIGGER IF EXISTS training_accreditation_records_tenant_reference_guard ON training_accreditation_records;
CREATE TRIGGER training_accreditation_records_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, requirement_id, verified_by, created_by
ON training_accreditation_records
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'requirement_id', 'training_regulatory_requirements',
  'verified_by', 'users',
  'created_by', 'users'
);

DROP TRIGGER IF EXISTS training_session_compliance_reviews_tenant_reference_guard ON training_session_compliance_reviews;
CREATE TRIGGER training_session_compliance_reviews_tenant_reference_guard
BEFORE INSERT OR UPDATE OF organization_id, session_id, reviewed_by
ON training_session_compliance_reviews
FOR EACH ROW
EXECUTE FUNCTION vims_enforce_tenant_references(
  'session_id', 'training_sessions',
  'reviewed_by', 'users'
);

-- Verify the RSL backfill before any subscriber workspace can be enabled.
DO $$
DECLARE
  table_name text;
  missing_count bigint;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'training_sessions',
    'training_participants',
    'training_assessments',
    'training_certificates',
    'training_compliance_cases',
    'training_compliance_events',
    'training_requests',
    'training_request_events',
    'training_quotations',
    'training_quotation_items',
    'training_communication_preferences',
    'training_outbound_messages',
    'training_communication_events',
    'training_curricula',
    'training_curriculum_versions',
    'training_session_curricula',
    'training_matrix_requirements',
    'training_development_plans',
    'training_development_actions',
    'training_attendance_signoffs',
    'training_evidence_records',
    'training_resources',
    'training_resource_allocations',
    'training_session_feedback',
    'training_quality_findings',
    'training_quality_events',
    'training_instructor_profiles',
    'training_session_readiness',
    'training_risk_assessments',
    'training_safety_hazards',
    'training_safety_incidents',
    'training_regulatory_requirements',
    'training_accreditation_records',
    'training_session_compliance_reviews'
  ]
  LOOP
    EXECUTE format('SELECT count(*) FROM %I WHERE organization_id IS NULL', table_name)
      INTO missing_count;
    IF missing_count <> 0 THEN
      RAISE EXCEPTION 'Tenant backfill incomplete for %: % rows without organization', table_name, missing_count;
    END IF;
  END LOOP;
END
$$;
