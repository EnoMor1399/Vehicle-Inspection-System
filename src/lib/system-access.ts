export type SystemAccessUser = {
  role: string;
  permissions?: Record<string, boolean> | null;
};

export const VEHICLE_INSPECTION_ACCESS_KEY = "vehicle_inspection";
export const DRIVER_TRAINING_ACCESS_KEY = "training";

export const VEHICLE_INSPECTION_ADMIN_ROLE = "vehicle_inspection_admin";
export const DRIVER_TRAINING_ADMIN_ROLE = "driver_training_admin";

function permissionsFor(user: SystemAccessUser): Record<string, boolean> | null {
  return user.permissions && typeof user.permissions === "object" ? user.permissions : null;
}

export function isVehicleInspectionAdministrationRole(role: string) {
  return role === "super_admin" || role === VEHICLE_INSPECTION_ADMIN_ROLE;
}

export function isDriverTrainingAdministrationRole(role: string) {
  return role === "super_admin" || role === DRIVER_TRAINING_ADMIN_ROLE;
}

export function canAccessVehicleInspection(user: SystemAccessUser): boolean {
  const permissions = permissionsFor(user);
  if (permissions?.["*"] === true) return true;

  const explicit = permissions?.[VEHICLE_INSPECTION_ACCESS_KEY];
  if (explicit !== undefined) return Boolean(explicit);

  if (user.role === "super_admin" || user.role === VEHICLE_INSPECTION_ADMIN_ROLE) return true;
  if (
    user.role === "organization_owner"
    || user.role === DRIVER_TRAINING_ADMIN_ROLE
    || user.role === "instructor"
  ) return false;

  // Existing non-training VIMS accounts predate explicit system assignment.
  // They remain Vehicle Inspection-only until an administrator records a
  // deliberate scope. This fallback is intentionally NOT applied to training
  // administration/instructor roles.
  return true;
}

export function canAccessDriverTraining(user: SystemAccessUser): boolean {
  const permissions = permissionsFor(user);
  if (permissions?.["*"] === true) return true;

  const explicit = permissions?.[DRIVER_TRAINING_ACCESS_KEY];
  if (explicit !== undefined) return Boolean(explicit);

  if (user.role === "super_admin" || user.role === DRIVER_TRAINING_ADMIN_ROLE || user.role === "instructor") {
    return true;
  }
  if (user.role === "organization_owner") return false;

  // Preserve explicitly delegated fine-grained training capabilities on older
  // accounts until they are normalized into a single administration domain.
  if (permissions?.training_manage === true || permissions?.training_assessment_review === true) {
    return true;
  }

  return false;
}

export function hasCrossDomainAccess(user: SystemAccessUser): boolean {
  return canAccessVehicleInspection(user) && canAccessDriverTraining(user);
}

export function accessAreaLabel(user: SystemAccessUser): string {
  const vehicleInspection = canAccessVehicleInspection(user);
  const driverTraining = canAccessDriverTraining(user);
  if (vehicleInspection && driverTraining) return user.role === "super_admin" ? "Enterprise oversight" : "Cross-domain access";
  if (driverTraining) return "Driver Training & Assessment";
  if (vehicleInspection) return "Vehicle Inspection";
  return "No system access";
}
