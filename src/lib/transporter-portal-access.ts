// Transporter portal management is part of Vehicle Inspection administration.
// Do not include Driver Training-only administrators or operational staff.
// A Transporter Portal User may see only their linked transporter profile.
export const TRANSPORTER_PORTAL_ADMIN_ROLES = [
  "super_admin", "vehicle_inspection_admin", "admin",
] as const;

export function isTransporterPortalAdministratorRole(role: string): boolean {
  return (TRANSPORTER_PORTAL_ADMIN_ROLES as readonly string[]).includes(role);
}

export function canSeeTransporterPortalNavigation(
  role: string | null | undefined,
  allowedResources: readonly string[],
): boolean {
  if (role === "super_admin") return true;
  return (role === "vehicle_inspection_admin" || role === "admin")
    && allowedResources.includes("transporters");
}
