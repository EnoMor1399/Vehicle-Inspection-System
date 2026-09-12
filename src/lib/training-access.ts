type TrainingUser = {
  role: string;
  permissions?: Record<string, boolean> | null;
};

const TRAINING_VIEW_ROLES = new Set([
  "super_admin",
  "admin",
  "operations_manager",
  "supervisor",
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
  const explicit = explicitPermission(user, "training");
  if (explicit !== undefined) return Boolean(explicit);
  return TRAINING_VIEW_ROLES.has(user.role);
}

export function canManageTraining(user: TrainingUser) {
  const explicit = explicitPermission(user, "training_manage");
  if (explicit !== undefined) return Boolean(explicit);
  if (!canViewTraining(user)) return false;
  return TRAINING_MANAGE_ROLES.has(user.role);
}

export function canReviewTrainingAssessments(user: TrainingUser) {
  const explicit = explicitPermission(user, "training_assessment_review");
  if (explicit !== undefined) return Boolean(explicit);
  if (!canViewTraining(user)) return false;
  return TRAINING_ASSESSMENT_REVIEW_ROLES.has(user.role);
}
