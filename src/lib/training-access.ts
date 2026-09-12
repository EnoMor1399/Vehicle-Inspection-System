import { canAccessDriverTraining } from "@/lib/system-access";

type TrainingUser = {
  role: string;
  permissions?: Record<string, boolean> | null;
};

type TrainingAccount = TrainingUser & {
  isActive?: boolean | null;
};

const TRAINING_VIEW_ROLES = new Set([
  "super_admin",
  "admin",
  "operations_manager",
  "supervisor",
  "instructor",
  "inspector",
  "data_entry",
  "auditor",
  "compliance_officer",
]);

// Operational management covers sessions, participants, instruction and assessment capture.
const TRAINING_MANAGE_ROLES = new Set([
  "super_admin",
  "admin",
  "operations_manager",
  "supervisor",
  "instructor",
  "inspector",
  "data_entry",
]);

// Account administration is intentionally narrower than operational management.
const TRAINING_USER_ADMIN_ROLES = new Set([
  "super_admin",
  "admin",
]);

const TRAINING_ASSESSMENT_REVIEW_ROLES = new Set([
  "super_admin",
  "admin",
  "operations_manager",
  "supervisor",
]);

const TRAINING_COMMERCIAL_ROLES = new Set([
  "super_admin",
  "admin",
  "operations_manager",
]);

const TRAINING_CERTIFICATE_ROLES = new Set([
  "super_admin",
  "admin",
  "operations_manager",
  "supervisor",
]);

const TRAINING_COMPLIANCE_ROLES = new Set([
  "super_admin",
  "admin",
  "operations_manager",
  "supervisor",
  "compliance_officer",
]);

const TRAINING_GOVERNANCE_ROLES = new Set([
  "super_admin",
  "admin",
  "operations_manager",
  "supervisor",
  "compliance_officer",
]);

function explicitPermission(user: TrainingUser, key: string) {
  if (!user.permissions || typeof user.permissions !== "object") return undefined;
  if (user.permissions["*"]) return true;
  return user.permissions[key];
}

function canUseTrainingCapability(user: TrainingUser, key: string, roles: Set<string>) {
  if (!canAccessDriverTraining(user)) return false;
  const explicit = explicitPermission(user, key);
  if (explicit !== undefined) return Boolean(explicit);
  if (!canViewTraining(user)) return false;
  return roles.has(user.role);
}

export function canViewTraining(user: TrainingUser) {
  if (!canAccessDriverTraining(user)) return false;
  const explicit = explicitPermission(user, "training");
  if (explicit !== undefined) return Boolean(explicit);
  return TRAINING_VIEW_ROLES.has(user.role);
}

export function canManageTraining(user: TrainingUser) {
  return canUseTrainingCapability(user, "training_manage", TRAINING_MANAGE_ROLES);
}

export function canManageTrainingUsers(user: TrainingUser) {
  if (!canAccessDriverTraining(user) || !canViewTraining(user)) return false;
  const explicit = explicitPermission(user, "training_user_admin");
  if (explicit === false) return false;
  if (explicit === true && (user.role === "super_admin" || user.role === "admin")) return true;
  return TRAINING_USER_ADMIN_ROLES.has(user.role);
}

export function canReviewTrainingAssessments(user: TrainingUser) {
  return canUseTrainingCapability(user, "training_assessment_review", TRAINING_ASSESSMENT_REVIEW_ROLES);
}

export function canManageTrainingCommercials(user: TrainingUser) {
  return canUseTrainingCapability(user, "training_commercials_manage", TRAINING_COMMERCIAL_ROLES);
}

export function canManageTrainingCertificates(user: TrainingUser) {
  return canUseTrainingCapability(user, "training_certificates_manage", TRAINING_CERTIFICATE_ROLES);
}

export function canManageTrainingCompliance(user: TrainingUser) {
  return canUseTrainingCapability(user, "training_compliance_manage", TRAINING_COMPLIANCE_ROLES);
}

export function canManageTrainingGovernance(user: TrainingUser) {
  return canUseTrainingCapability(user, "training_governance_manage", TRAINING_GOVERNANCE_ROLES);
}

export function trainingPermissionsForRole(role: string): Record<string, boolean> {
  return {
    training_manage: TRAINING_MANAGE_ROLES.has(role),
    training_user_admin: TRAINING_USER_ADMIN_ROLES.has(role),
    training_assessment_review: TRAINING_ASSESSMENT_REVIEW_ROLES.has(role),
    training_commercials_manage: TRAINING_COMMERCIAL_ROLES.has(role),
    training_certificates_manage: TRAINING_CERTIFICATE_ROLES.has(role),
    training_compliance_manage: TRAINING_COMPLIANCE_ROLES.has(role),
    training_governance_manage: TRAINING_GOVERNANCE_ROLES.has(role),
  };
}

export function canAdministrativelySelfReviewTrainingAssessment(user: TrainingUser) {
  if (!canReviewTrainingAssessments(user)) return false;
  return user.role === "super_admin" || user.role === "admin";
}

export function canCreateDriverTrainingUsers(user: TrainingUser) {
  if (!canManageTrainingUsers(user)) return false;
  return user.role === "super_admin" || user.role === "admin";
}

export function canServeAsInternalTrainingInstructor(user: TrainingAccount) {
  if (user.isActive !== true) return false;
  if (user.role === "transporter_user") return false;
  return canViewTraining(user);
}
