export const SYSTEM_SETTINGS_SERVER_FIELDS = [
  "id",
  "defaultStationId",
  "updatedAt",
  "updatedBy",
] as const;

export type SystemSettingsServerField = (typeof SYSTEM_SETTINGS_SERVER_FIELDS)[number];

/**
 * Remove database-only/system-controlled settings fields before serializing a
 * settings row to an editable client form or returning it from a read action.
 *
 * The strict update schema intentionally rejects these fields, so keeping this
 * projection at the server/client boundary prevents persisted metadata from
 * being echoed back as an update payload.
 */
export function toEditableSystemSettings<T extends object>(
  settings: T
): Omit<T, SystemSettingsServerField> {
  const editable = { ...settings } as Record<string, unknown>;
  for (const field of SYSTEM_SETTINGS_SERVER_FIELDS) {
    delete editable[field];
  }
  return editable as Omit<T, SystemSettingsServerField>;
}
