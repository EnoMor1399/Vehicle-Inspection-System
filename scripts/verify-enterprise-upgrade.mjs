import "dotenv/config";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

function normalizePostgresSslMode(value) {
  try {
    const url = new URL(value);
    if (url.searchParams.get("sslmode")?.toLowerCase() === "require") {
      url.searchParams.set("sslmode", "verify-full");
    }
    return url.toString();
  } catch {
    return value;
  }
}

const requiredTables = [
  "training_sessions",
  "training_participants",
  "training_assessments",
  "training_certificates",
  "training_compliance_cases",
  "training_compliance_events",
  "training_instructor_profiles",
  "training_session_readiness",
  "training_attendance_signoffs",
  "training_evidence_records",
  "training_session_feedback",
  "training_quality_findings",
  "training_quality_events",
  "training_curricula",
  "training_curriculum_versions",
  "training_session_curricula",
  "training_matrix_requirements",
  "training_resources",
  "training_resource_allocations",
  "training_requests",
  "training_request_events",
  "training_development_plans",
  "training_development_actions",
  "training_risk_assessments",
  "training_safety_hazards",
  "training_safety_incidents",
  "training_quotations",
  "training_quotation_items",
  "training_regulatory_requirements",
  "training_accreditation_records",
  "training_session_compliance_reviews",
  "training_communication_preferences",
  "training_outbound_messages",
  "training_communication_events",
  "rate_limit_buckets",
  "inspection_appointments",
  "organizations",
  "subscription_plans",
  "organization_subscriptions",
  "organization_invitations",
  "organization_onboarding_requests",
];

const requiredAuditColumns = [
  "previous_hash",
  "event_hash",
];

const requiredCoreTenantTables = [
  "daily_inspections",
  "webhooks",
  "locations",
  "transporters",
  "vehicles",
  "rfid_tags",
  "inspections",
  "inspection_appointments",
  "documents",
  "audit_logs",
  "notifications",
  "import_jobs",
  "api_keys",
  "signatures",
  "security_events",
];

const requiredTrainingTenantTables = [
  "training_sessions",
  "training_participants",
  "training_assessments",
  "training_certificates",
  "training_compliance_cases",
  "training_compliance_events",
  "training_requests",
  "training_request_events",
  "training_quotations",
  "training_quotation_items",
  "training_communication_preferences",
  "training_outbound_messages",
  "training_communication_events",
  "training_curricula",
  "training_curriculum_versions",
  "training_session_curricula",
  "training_matrix_requirements",
  "training_development_plans",
  "training_development_actions",
  "training_attendance_signoffs",
  "training_evidence_records",
  "training_resources",
  "training_resource_allocations",
  "training_session_feedback",
  "training_quality_findings",
  "training_quality_events",
  "training_instructor_profiles",
  "training_session_readiness",
  "training_risk_assessments",
  "training_safety_hazards",
  "training_safety_incidents",
  "training_regulatory_requirements",
  "training_accreditation_records",
  "training_session_compliance_reviews",
];

const requiredTenantTables = [
  ...requiredCoreTenantTables,
  ...requiredTrainingTenantTables,
];

const requiredTenantTriggers = [
  "users_tenant_reference_guard",
  "vehicle_tenant_reference_guard",
  "rfid_tenant_reference_guard",
  "inspection_tenant_reference_guard",
  "appointment_tenant_reference_guard",
  "daily_inspection_tenant_reference_guard",
  "document_tenant_reference_guard",
  "training_sessions_tenant_reference_guard",
  "training_participants_tenant_reference_guard",
  "training_assessments_tenant_reference_guard",
  "training_certificates_tenant_reference_guard",
  "training_requests_tenant_reference_guard",
  "training_quotations_tenant_reference_guard",
  "training_curricula_tenant_reference_guard",
  "training_instructor_profiles_tenant_reference_guard",
  "training_risk_assessments_tenant_reference_guard",
  "training_safety_incidents_tenant_reference_guard",
];

const requiredAssessmentColumns = [
  "assessment_version",
  "theory_score",
  "road_sign_score",
  "practical_score",
  "overall_score",
  "criteria_ratings",
  "criteria_comments",
  "section_scores",
  "scored_points",
  "maximum_points",
  "classification",
  "critical_violations",
  "qualitative_feedback",
  "development_plan",
  "final_recommendation",
  "driver_acknowledged",
  "driver_comments",
  "review_status",
  "reviewer_id",
  "assessor_signature",
  "reviewer_signature",
  "review_comments",
  "reviewed_at",
];

const requiredIndexes = [
  "login_attempt_email_failed_created_idx",
  "login_attempt_ip_failed_created_idx",
  "session_user_active_activity_idx",
  "audit_entity_created_idx",
  "audit_user_created_idx",
  "audit_event_hash_idx",
  "rate_limit_reset_idx",
  "notification_user_unread_created_idx",
  "training_session_reference_uidx",
  "training_session_status_start_idx",
  "training_participant_session_idx",
  "training_assessment_participant_idx",
  "training_assessment_classification_idx",
  "training_assessment_recommendation_idx",
  "training_assessment_review_status_idx",
  "training_assessment_reviewer_idx",
  "training_certificate_number_uidx",
  "training_certificate_verification_uidx",
  "training_compliance_participant_idx",
  "training_compliance_certificate_idx",
  "training_compliance_status_due_idx",
  "training_compliance_assigned_idx",
  "training_compliance_event_case_created_idx",
  "training_compliance_active_case_uidx",
  "training_instructor_user_uidx",
  "training_instructor_code_uidx",
  "training_instructor_status_idx",
  "training_instructor_cert_expiry_idx",
  "training_instructor_medical_expiry_idx",
  "training_readiness_session_uidx",
  "training_readiness_status_idx",
  "training_readiness_reviewed_idx",
  "training_attendance_participant_session_uidx",
  "training_attendance_session_status_idx",
  "training_attendance_participant_idx",
  "training_attendance_confirmed_idx",
  "training_evidence_scope_reference_uidx",
  "training_evidence_session_idx",
  "training_evidence_participant_idx",
  "training_evidence_status_idx",
  "training_evidence_type_idx",
  "training_feedback_session_idx",
  "training_feedback_participant_idx",
  "training_feedback_rating_idx",
  "training_quality_session_idx",
  "training_quality_status_due_idx",
  "training_quality_severity_idx",
  "training_quality_owner_idx",
  "training_quality_event_finding_created_idx",
  "training_curriculum_code_uidx",
  "training_curriculum_service_idx",
  "training_curriculum_status_idx",
  "training_curriculum_owner_idx",
  "training_curriculum_version_uidx",
  "training_curriculum_version_status_idx",
  "training_curriculum_review_due_idx",
  "training_curriculum_effective_idx",
  "training_curriculum_one_approved_uidx",
  "training_session_curriculum_session_uidx",
  "training_session_curriculum_version_idx",
  "training_matrix_requirement_key_uidx",
  "training_matrix_service_idx",
  "training_matrix_scope_idx",
  "training_resource_code_uidx",
  "training_resource_type_status_idx",
  "training_resource_location_idx",
  "training_resource_service_due_idx",
  "training_resource_inspection_due_idx",
  "training_resource_allocation_resource_session_idx",
  "training_resource_active_session_uidx",
  "training_resource_allocation_resource_status_idx",
  "training_resource_allocation_session_status_idx",
  "training_request_number_uidx",
  "training_request_status_created_idx",
  "training_request_service_idx",
  "training_request_client_idx",
  "training_request_reviewer_idx",
  "training_request_scheduled_session_uidx",
  "training_request_event_request_created_idx",
  "training_development_participant_idx",
  "training_development_status_target_idx",
  "training_development_priority_idx",
  "training_development_owner_idx",
  "training_development_assessment_idx",
  "training_development_action_plan_status_idx",
  "training_development_action_due_idx",
  "training_development_action_type_idx",
  "training_risk_assessment_session_uidx",
  "training_risk_assessment_status_idx",
  "training_risk_assessment_overall_risk_idx",
  "training_risk_assessment_assessed_at_idx",
  "training_safety_hazard_assessment_status_idx",
  "training_safety_hazard_residual_risk_idx",
  "training_safety_hazard_owner_idx",
  "training_safety_incident_number_uidx",
  "training_safety_incident_session_status_idx",
  "training_safety_incident_severity_idx",
  "training_safety_incident_occurred_idx",
  "training_safety_incident_owner_idx",
  "training_quotation_number_uidx",
  "training_quotation_request_version_uidx",
  "training_quotation_request_status_idx",
  "training_quotation_valid_until_idx",
  "training_quotation_one_accepted_request_uidx",
  "training_quotation_item_quotation_idx",
  "training_quotation_item_type_idx",
  "training_regulatory_requirement_code_uidx",
  "training_regulatory_requirement_service_status_idx",
  "training_regulatory_requirement_review_idx",
  "training_accreditation_requirement_idx",
  "training_accreditation_status_validity_idx",
  "training_accreditation_credential_idx",
  "training_accreditation_one_verified_uidx",
  "training_session_compliance_session_uidx",
  "training_session_compliance_status_idx",
  "training_session_compliance_reviewed_idx",
  "training_comm_pref_participant_uidx",
  "training_comm_pref_channel_idx",
  "training_comm_pref_dnc_idx",
  "training_outbound_participant_idx",
  "training_outbound_session_idx",
  "training_outbound_certificate_idx",
  "training_outbound_status_idx",
  "training_outbound_queue_idx",
  "training_comm_event_message_created_idx",
  "inspection_appointment_scheduled_idx",
  "inspection_appointment_location_scheduled_idx",
  "inspection_appointment_status_scheduled_idx",
  "inspection_appointment_vehicle_scheduled_idx",
  "inspection_appointment_inspector_scheduled_idx",
  "inspection_appointment_linked_inspection_idx",
  "organization_slug_idx",
  "organization_status_idx",
  "subscription_plan_code_idx",
  "organization_subscription_org_idx",
  "organization_onboarding_status_idx",
  "user_organization_idx",
  "user_organization_role_idx",
  "system_settings_organization_uidx",
  "location_organization_code_uidx",
  "vehicle_organization_reg_uidx",
  "rfid_organization_tag_uidx",
  "inspection_organization_number_uidx",
  "inspection_appointment_organization_number_uidx",
  "inspection_organization_date_idx",
  "document_organization_owner_idx",
  "audit_organization_created_idx",
  "training_sessions_organization_idx",
  "training_participants_organization_idx",
  "training_assessments_organization_idx",
  "training_certificates_organization_idx",
  "training_requests_organization_idx",
  "training_curricula_organization_idx",
  "training_instructor_profiles_organization_idx",
  "training_safety_incidents_organization_idx",
];

const redundantIndexes = ["session_token_idx", "api_key_hash_idx"];

const client = new pg.Client({
  connectionString: normalizePostgresSslMode(databaseUrl),
  application_name: "vims-db-upgrade-verifier",
  connectionTimeoutMillis: 15_000,
  statement_timeout: 30_000,
});

await client.connect();
try {
  const readiness = await client.query(
    "SELECT current_database() AS database_name, current_user AS role_name, current_setting('server_version_num')::int AS server_version_num",
  );

  const tableResult = await client.query(
    `SELECT tablename
       FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename = ANY($1::text[])`,
    [requiredTables],
  );
  const presentTables = new Set(tableResult.rows.map((row) => row.tablename));
  const missingTables = requiredTables.filter((name) => !presentTables.has(name));

  const tenantColumnResult = await client.query(
    `SELECT table_name, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND column_name = 'organization_id'
        AND table_name = ANY($1::text[])`,
    [requiredTenantTables],
  );
  const tenantColumnMap = new Map(
    tenantColumnResult.rows.map((row) => [row.table_name, {
      isNullable: row.is_nullable,
      columnDefault: row.column_default,
    }]),
  );
  const missingTenantColumns = requiredTenantTables.filter((name) => !tenantColumnMap.has(name));
  const nullableTenantColumns = requiredTenantTables.filter(
    (name) => tenantColumnMap.get(name)?.isNullable !== "NO",
  );
  const tenantColumnsWithDefaults = requiredTenantTables.filter(
    (name) => tenantColumnMap.get(name)?.columnDefault != null,
  );

  const tenantTriggerResult = await client.query(
    `SELECT tgname
       FROM pg_trigger
      WHERE NOT tgisinternal
        AND tgname = ANY($1::text[])`,
    [requiredTenantTriggers],
  );
  const presentTenantTriggers = new Set(tenantTriggerResult.rows.map((row) => row.tgname));
  const missingTenantTriggers = requiredTenantTriggers.filter(
    (name) => !presentTenantTriggers.has(name),
  );

  const assessmentColumnResult = await client.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'training_assessments'
        AND column_name = ANY($1::text[])`,
    [requiredAssessmentColumns],
  );
  const presentAssessmentColumns = new Set(assessmentColumnResult.rows.map((row) => row.column_name));
  const missingAssessmentColumns = requiredAssessmentColumns.filter((name) => !presentAssessmentColumns.has(name));

  const auditColumnResult = await client.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'audit_logs'
        AND column_name = ANY($1::text[])`,
    [requiredAuditColumns],
  );
  const presentAuditColumns = new Set(auditColumnResult.rows.map((row) => row.column_name));
  const missingAuditColumns = requiredAuditColumns.filter((name) => !presentAuditColumns.has(name));

  const { rows } = await client.query(
    `SELECT indexname
       FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = ANY($1::text[])`,
    [[...requiredIndexes, ...redundantIndexes]],
  );

  const present = new Set(rows.map((row) => row.indexname));
  const missing = requiredIndexes.filter((name) => !present.has(name));
  const redundantStillPresent = redundantIndexes.filter((name) => present.has(name));

  const roleResult = await client.query(
    `SELECT e.enumlabel
       FROM pg_type t
       JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE t.typname = 'user_role'
        AND e.enumlabel = ANY($1::text[])`,
    [["vehicle_inspection_admin", "driver_training_admin", "organization_owner"]],
  );
  const presentDomainRoles = new Set(roleResult.rows.map((row) => row.enumlabel));
  const requiredDomainRoles = ["vehicle_inspection_admin", "driver_training_admin", "organization_owner"];
  const missingDomainRoles = requiredDomainRoles.filter(
    (role) => !presentDomainRoles.has(role),
  );

  const constraintResult = await client.query(
    `SELECT conname
       FROM pg_constraint
      WHERE conrelid = 'users'::regclass
        AND conname = ANY($1::text[])`,
    [["users_single_operational_domain_chk", "users_role_domain_chk"]],
  );
  const presentDomainConstraints = new Set(constraintResult.rows.map((row) => row.conname));
  const missingDomainConstraints = ["users_single_operational_domain_chk", "users_role_domain_chk"].filter(
    (name) => !presentDomainConstraints.has(name),
  );

  const separationResult = await client.query(
    `SELECT
       count(*) FILTER (WHERE role = 'admin')::int AS legacy_admins,
       count(*) FILTER (
         WHERE role NOT IN ('super_admin', 'organization_owner')
           AND COALESCE((permissions->>'vehicle_inspection')::boolean, true)
             = COALESCE((permissions->>'training')::boolean, false)
       )::int AS invalid_domain_assignments
       FROM users`,
  );
  const separation = separationResult.rows[0] || { legacy_admins: 0, invalid_domain_assignments: 0 };

  const organizationResult = await client.query(
    `SELECT
       count(*) FILTER (WHERE id = '00000000-0000-4000-8000-000000000101')::int AS rsl_org_rows,
       count(*) FILTER (
         WHERE id = '00000000-0000-4000-8000-000000000101'
           AND status = 'active'
           AND operational_access_enabled = true
           AND data_isolation_verified_at IS NOT NULL
       )::int AS rsl_ready_rows
       FROM organizations`,
  );
  const organizationState = organizationResult.rows[0] || { rsl_org_rows: 0, rsl_ready_rows: 0 };

  const tenantAssignmentResult = await client.query(
    `SELECT
       count(*) FILTER (WHERE organization_id IS NULL)::int AS users_without_org,
       (SELECT count(*)::int FROM system_settings WHERE organization_id IS NULL) AS settings_without_org,
       (SELECT count(*)::int FROM subscription_plans WHERE is_active = true) AS active_plans
       FROM users`,
  );
  const tenantAssignment = tenantAssignmentResult.rows[0] || {
    users_without_org: 0,
    settings_without_org: 0,
    active_plans: 0,
  };

  const metadata = readiness.rows[0];
  console.log(
    JSON.stringify({
      database: metadata?.database_name ?? "unknown",
      serverVersionNum: metadata?.server_version_num ?? null,
      requiredTablesVerified: requiredTables.length - missingTables.length,
      requiredTablesExpected: requiredTables.length,
      assessmentColumnsVerified: requiredAssessmentColumns.length - missingAssessmentColumns.length,
      assessmentColumnsExpected: requiredAssessmentColumns.length,
      auditColumnsVerified: requiredAuditColumns.length - missingAuditColumns.length,
      auditColumnsExpected: requiredAuditColumns.length,
      requiredIndexesVerified: requiredIndexes.length - missing.length,
      requiredIndexesExpected: requiredIndexes.length,
      redundantIndexesRemaining: redundantStillPresent.length,
      administrationRolesVerified: requiredDomainRoles.length - missingDomainRoles.length,
      administrationRolesExpected: requiredDomainRoles.length,
      administrationConstraintsVerified: 2 - missingDomainConstraints.length,
      administrationConstraintsExpected: 2,
      legacyAdministratorsRemaining: Number(separation.legacy_admins || 0),
      invalidDomainAssignments: Number(separation.invalid_domain_assignments || 0),
      rslOrganizationRows: Number(organizationState.rsl_org_rows || 0),
      rslOperationalReadyRows: Number(organizationState.rsl_ready_rows || 0),
      usersWithoutOrganization: Number(tenantAssignment.users_without_org || 0),
      settingsWithoutOrganization: Number(tenantAssignment.settings_without_org || 0),
      activeSubscriptionPlans: Number(tenantAssignment.active_plans || 0),
      tenantColumnsVerified: requiredTenantTables.length - missingTenantColumns.length,
      tenantColumnsExpected: requiredTenantTables.length,
      nullableTenantColumns: nullableTenantColumns.length,
      tenantColumnsWithDefaults: tenantColumnsWithDefaults.length,
      tenantTriggersVerified: requiredTenantTriggers.length - missingTenantTriggers.length,
      tenantTriggersExpected: requiredTenantTriggers.length,
    }),
  );

  if (
    missingTables.length > 0
    || missingAssessmentColumns.length > 0
    || missingAuditColumns.length > 0
    || missing.length > 0
    || redundantStillPresent.length > 0
    || missingDomainRoles.length > 0
    || missingDomainConstraints.length > 0
    || Number(separation.legacy_admins || 0) > 0
    || Number(separation.invalid_domain_assignments || 0) > 0
    || Number(organizationState.rsl_org_rows || 0) !== 1
    || Number(organizationState.rsl_ready_rows || 0) !== 1
    || Number(tenantAssignment.users_without_org || 0) > 0
    || Number(tenantAssignment.settings_without_org || 0) > 0
    || Number(tenantAssignment.active_plans || 0) < 3
    || missingTenantColumns.length > 0
    || nullableTenantColumns.length > 0
    || tenantColumnsWithDefaults.length > 0
    || missingTenantTriggers.length > 0
  ) {
    if (missingTables.length > 0) console.error(`Missing required tables: ${missingTables.join(", ")}`);
    if (missingAssessmentColumns.length > 0) console.error(`Missing Driver Training assessment columns: ${missingAssessmentColumns.join(", ")}`);
    if (missingAuditColumns.length > 0) console.error(`Missing audit integrity columns: ${missingAuditColumns.join(", ")}`);
    if (missing.length > 0) console.error(`Missing required indexes: ${missing.join(", ")}`);
    if (redundantStillPresent.length > 0) console.error(`Redundant indexes still present: ${redundantStillPresent.join(", ")}`);
    if (missingDomainRoles.length > 0) console.error(`Missing administration roles: ${missingDomainRoles.join(", ")}`);
    if (missingDomainConstraints.length > 0) console.error(`Missing administration constraints: ${missingDomainConstraints.join(", ")}`);
    if (Number(separation.legacy_admins || 0) > 0) console.error(`Legacy Administrator accounts remaining: ${separation.legacy_admins}`);
    if (Number(separation.invalid_domain_assignments || 0) > 0) console.error(`Invalid non-super cross/no-domain assignments: ${separation.invalid_domain_assignments}`);
    if (Number(organizationState.rsl_org_rows || 0) !== 1) console.error("RSL organization seed is missing or duplicated");
    if (Number(organizationState.rsl_ready_rows || 0) !== 1) console.error("RSL organization is not operationally ready");
    if (Number(tenantAssignment.users_without_org || 0) > 0) console.error(`Users without organization: ${tenantAssignment.users_without_org}`);
    if (Number(tenantAssignment.settings_without_org || 0) > 0) console.error(`Settings rows without organization: ${tenantAssignment.settings_without_org}`);
    if (Number(tenantAssignment.active_plans || 0) < 3) console.error(`Expected at least 3 active subscription plans, found ${tenantAssignment.active_plans}`);
    if (missingTenantColumns.length > 0) console.error(`Missing organization_id columns: ${missingTenantColumns.join(", ")}`);
    if (nullableTenantColumns.length > 0) console.error(`Nullable organization_id columns: ${nullableTenantColumns.join(", ")}`);
    if (tenantColumnsWithDefaults.length > 0) console.error(`Tenant columns still using compatibility defaults: ${tenantColumnsWithDefaults.join(", ")}`);
    if (missingTenantTriggers.length > 0) console.error(`Missing tenant reference guards: ${missingTenantTriggers.join(", ")}`);
    process.exitCode = 1;
  } else {
    console.log("Enterprise database upgrade verification passed.");
  }
} finally {
  await client.end();
}
