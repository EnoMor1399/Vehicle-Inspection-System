export type SystemAccessUser = {
  role: string;
  permissions?: Record<string, boolean> | null;
};

export const VEHICLE_INSPECTION_ACCESS_KEY = "vehicle_inspection";
export const DRIVER_TRAINING_ACCESS_KEY = "training";

function permissionsFor(user: SystemAccessUser): Record<string, boolean> | null {
  return user.permissions && typeof user.permissions === "object" ? user.permissions : null;
}

export function canAccessVehicleInspection(user: SystemAccessUser): boolean {
  const permissions = permissionsFor(user);
  if (permissions?.["*"] === true) return true;

  const explicit = permissions?.[VEHICLE_INSPECTION_ACCESS_KEY];
  if (explicit !== undefined) return Boolean(explicit);

  // Vehicle Inspection is the legacy VIMS workspace. Existing accounts keep
  // that access unless an administrator explicitly separates the account.
  return true;
}

export function canAccessDriverTraining(user: SystemAccessUser): boolean {
  const permissions = permissionsFor(user);
  if (permissions?.["*"] === true) return true;

  const explicit = permissions?.[DRIVER_TRAINING_ACCESS_KEY];
  if (explicit !== undefined) return Boolean(explicit);

  // Preserve explicit fine-grained training grants created before the access
  // area selector existed.
  if (permissions?.training_manage === true || permissions?.training_assessment_review === true) {
    return true;
  }

  // Super Administrators retain cross-workspace oversight by default. Every
  // other account must be deliberately assigned to Driver Training.
  return user.role === "super_admin";
}

export function accessAreaLabel(user: SystemAccessUser): string {
  const vehicleInspection = canAccessVehicleInspection(user);
  const driverTraining = canAccessDriverTraining(user);
  if (vehicleInspection && driverTraining) return "Both systems";
  if (driverTraining) return "Driver Training";
  if (vehicleInspection) return "Vehicle Inspection";
  return "No system access";
}
