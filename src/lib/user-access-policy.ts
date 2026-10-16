export const USER_ROLES = [
  "super_admin",
  "organization_owner",
  "vehicle_inspection_admin",
  "driver_training_admin",
  "admin",
  "operations_manager",
  "supervisor",
  "instructor",
  "inspector",
  "data_entry",
  "auditor",
  "compliance_officer",
  "viewer",
  "transporter_user",
] as const;

export type UserRole = typeof USER_ROLES[number];

const ROLE_RANK: Record<UserRole, number> = {
  super_admin: 100,
  organization_owner: 80,
  vehicle_inspection_admin: 90,
  driver_training_admin: 90,
  admin: 90,
  operations_manager: 70,
  supervisor: 60,
  compliance_officer: 55,
  auditor: 50,
  instructor: 40,
  inspector: 40,
  data_entry: 30,
  viewer: 10,
  transporter_user: 10,
};

export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}

export function validateDelegatedRoleChange(
  actorRole: UserRole,
  targetRole: UserRole,
  requestedRole: UserRole
): { ok: true } | { ok: false; message: string } {
  if (actorRole === "super_admin") return { ok: true };

  if (targetRole === "super_admin" || requestedRole === "super_admin") {
    return { ok: false, message: "Only a Super Administrator can modify Super Administrator access" };
  }
  if (
    targetRole === "organization_owner"
    || requestedRole === "organization_owner"
    || targetRole === "admin"
    || requestedRole === "admin"
    || targetRole === "vehicle_inspection_admin"
    || requestedRole === "vehicle_inspection_admin"
    || targetRole === "driver_training_admin"
    || requestedRole === "driver_training_admin"
  ) {
    return { ok: false, message: "Only a Super Administrator can modify or assign an administration role" };
  }

  const actorRank = ROLE_RANK[actorRole];
  if (ROLE_RANK[targetRole] >= actorRank) {
    return { ok: false, message: "You cannot modify an account with equal or higher privileges than your own" };
  }
  if (ROLE_RANK[requestedRole] >= actorRank) {
    return { ok: false, message: "You cannot assign a role with privileges equal to or higher than your own" };
  }

  return { ok: true };
}
