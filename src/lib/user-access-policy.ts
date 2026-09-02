export const USER_ROLES = [
  "super_admin",
  "admin",
  "operations_manager",
  "supervisor",
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
  admin: 90,
  operations_manager: 70,
  supervisor: 60,
  compliance_officer: 55,
  auditor: 50,
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

  const actorRank = ROLE_RANK[actorRole];
  if (ROLE_RANK[targetRole] > actorRank) {
    return { ok: false, message: "You cannot modify an account with a higher role than your own" };
  }
  if (ROLE_RANK[requestedRole] > actorRank) {
    return { ok: false, message: "You cannot assign a role with higher privileges than your own" };
  }
  if (targetRole === "super_admin" || requestedRole === "super_admin") {
    return { ok: false, message: "Only a Super Administrator can modify Super Administrator access" };
  }

  return { ok: true };
}
