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
];

const requiredIndexes = [
  "login_attempt_email_failed_created_idx",
  "login_attempt_ip_failed_created_idx",
  "session_user_active_activity_idx",
  "audit_entity_created_idx",
  "audit_user_created_idx",
  "notification_user_unread_created_idx",
  "training_session_reference_uidx",
  "training_session_status_start_idx",
  "training_participant_session_idx",
  "training_assessment_participant_idx",
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

  const metadata = readiness.rows[0];
  console.log(
    JSON.stringify({
      database: metadata?.database_name ?? "unknown",
      serverVersionNum: metadata?.server_version_num ?? null,
      requiredTablesVerified: requiredTables.length - missingTables.length,
      requiredTablesExpected: requiredTables.length,
      requiredIndexesVerified: requiredIndexes.length - missing.length,
      requiredIndexesExpected: requiredIndexes.length,
      redundantIndexesRemaining: redundantStillPresent.length,
    }),
  );

  if (missingTables.length > 0 || missing.length > 0 || redundantStillPresent.length > 0) {
    if (missingTables.length > 0) console.error(`Missing required tables: ${missingTables.join(", ")}`);
    if (missing.length > 0) console.error(`Missing required indexes: ${missing.join(", ")}`);
    if (redundantStillPresent.length > 0) console.error(`Redundant indexes still present: ${redundantStillPresent.join(", ")}`);
    process.exitCode = 1;
  } else {
    console.log("Enterprise database upgrade verification passed.");
  }
} finally {
  await client.end();
}
