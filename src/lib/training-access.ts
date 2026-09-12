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

const TRAINING_MANAGE_ROLES = new Set([
  "super_admin",
  "admin",
  "operations_manager",
  "supervisor",
  "instructor",
  "inspector",
  "data_entry",
]);

const TRAINING_USER_ADMIN_ROLES = new Set([
  "super_admin",
  "admin",
  "operations_manager",
  "supervisor",
  "inspector",
  "data_entry",
]);

const TRAINING_ASSESSMENT_REVIEW_ROLES = new Set([
  "super_admin",
  "admin",
  "operations_manager",
  "supervisor",
]);

function explicitPermission(user: TrainingUser, key: string) {
  if (!user.permissions || typeof user.permissions !== "object") return undefined;
  if (user.permissions["*"]) return true;
  return user.permissions[key];
}

export function canViewTraining(user: TrainingUser) {
  if (!canAccessDriverTraining(user)) return false;
  const explicit = explicitPermission(user, "training");
  if (explicit !== undefined) return Boolean(explicit);
  return TRAINING_VIEW_ROLES.has(user.role);
}

export function canManageTraining(user: TrainingUser) {
  if (!canAccessDriverTraining(user)) return false;
  const explicit = explicitPermission(user, "training_manage");
  if (explicit !== undefined) return Boolean(explicit);
  if (!canViewTraining(user)) return false;
  return TRAINING_MANAGE_ROLES.has(user.role);
}

export function canManageTrainingUsers(user: TrainingUser) {
  if (!canAccessDriverTraining(user)) return false;
  if (!canViewTraining(user)) return false;
  return TRAINING_USER_ADMIN_ROLES.has(user.role) || user.permissions?.["*"] === true;
}

export function canReviewTrainingAssessments(user: TrainingUser) {
  if (!canAccessDriverTraining(user)) return false;
  const explicit = explicitPermission(user, "training_assessment_review");
  if (explicit !== undefined) return Boolean(explicit);
  if (!canViewTraining(user)) return false;
  return TRAINING_ASSESSMENT_REVIEW_ROLES.has(user.role);
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
