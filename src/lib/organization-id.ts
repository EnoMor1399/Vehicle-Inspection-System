// Shared validation for IDs used by the read-only Platform Oversight routes.
// A UUID has five groups of 8-4-4-4-12 hex characters. All Super Admin
// control-plane loaders must use this same parser to avoid inconsistent
// authorization outcomes (for example, a working dashboard and 404 modules).
export const ORGANIZATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidOrganizationId(value: unknown): value is string {
  return typeof value === "string" && ORGANIZATION_ID_PATTERN.test(value);
}
