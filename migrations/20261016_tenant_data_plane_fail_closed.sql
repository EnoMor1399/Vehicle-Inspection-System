-- Final tenant cutover: remove the temporary RSL compatibility default.
-- Apply only after the tenant-aware application is live and healthy.
-- From this point onward every operational write must provide organization_id
-- explicitly; missing tenant context fails at the database boundary.

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
    'security_events',
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
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN organization_id DROP DEFAULT',
      table_name
    );
  END LOOP;
END
$$;
