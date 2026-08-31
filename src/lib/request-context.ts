export const MAX_USER_AGENT_LENGTH = 512;
export const MAX_REQUEST_ID_LENGTH = 80;

export function normalizeClientIp(value: string | null | undefined): string {
  const first = (value || "").split(",")[0]?.trim();
  if (!first) return "unknown";

  const unwrapped = first.startsWith("[") && first.endsWith("]")
    ? first.slice(1, -1)
    : first;

  if (unwrapped.length > 45 || !/^[0-9a-fA-F:.]+$/.test(unwrapped)) return "unknown";
  return unwrapped.toLowerCase();
}

export function clientIpFromHeaders(headers: { get(name: string): string | null }): string {
  return normalizeClientIp(headers.get("x-forwarded-for") || headers.get("x-real-ip"));
}

export function normalizeUserAgent(value: string | null | undefined): string {
  const normalized = (value || "unknown")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (normalized || "unknown").slice(0, MAX_USER_AGENT_LENGTH);
}

export function normalizeRequestId(value: string | null | undefined, fallback: string): string {
  const candidate = (value || "").trim();
  if (
    candidate.length > 0
    && candidate.length <= MAX_REQUEST_ID_LENGTH
    && /^[A-Za-z0-9._:-]+$/.test(candidate)
  ) {
    return candidate;
  }
  return fallback.slice(0, MAX_REQUEST_ID_LENGTH);
}
