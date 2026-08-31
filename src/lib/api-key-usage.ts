export const API_KEY_USAGE_REFRESH_MS = 5 * 60_000;

export function shouldRefreshApiKeyUsage(
  lastUsedAt: Date | string | null | undefined,
  now: Date = new Date(),
  refreshMs: number = API_KEY_USAGE_REFRESH_MS
): boolean {
  if (!lastUsedAt) return true;

  const previous = lastUsedAt instanceof Date ? lastUsedAt.getTime() : new Date(lastUsedAt).getTime();
  if (!Number.isFinite(previous)) return true;

  const interval = Number.isFinite(refreshMs) && refreshMs > 0 ? refreshMs : API_KEY_USAGE_REFRESH_MS;
  return now.getTime() - previous >= interval;
}
