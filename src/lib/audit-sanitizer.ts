const MAX_AUDIT_DEPTH = 6;
const MAX_AUDIT_ARRAY_ITEMS = 100;
const MAX_AUDIT_OBJECT_KEYS = 100;
const MAX_AUDIT_STRING_LENGTH = 2_000;
const MAX_AUDIT_PAYLOAD_BYTES = 64_000;
const MAX_AUDIT_PREVIEW_LENGTH = 8_000;

const SENSITIVE_KEY = /(?:password|passcode|secret|token|authorization|cookie|api[_-]?key|key[_-]?hash|two[_-]?factor|private[_-]?key|database[_-]?url|connection[_-]?string)/i;

function cleanString(value: string, maxLength = MAX_AUDIT_STRING_LENGTH): string {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function sanitizeAuditText(
  value: string | null | undefined,
  maxLength: number
): string | null {
  if (!value) return null;
  const cleaned = cleanString(value, Math.max(1, maxLength));
  return cleaned || null;
}

function sanitizeValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return cleanString(value);
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function" || typeof value === "symbol") return undefined;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();

  if (typeof value !== "object") return cleanString(String(value));
  if (depth >= MAX_AUDIT_DEPTH) return "[MAX_DEPTH]";

  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);

  if (Array.isArray(value)) {
    const sanitized = value
      .slice(0, MAX_AUDIT_ARRAY_ITEMS)
      .map((item) => sanitizeValue(item, depth + 1, seen));
    if (value.length > MAX_AUDIT_ARRAY_ITEMS) {
      sanitized.push(`[TRUNCATED ${value.length - MAX_AUDIT_ARRAY_ITEMS} ITEMS]`);
    }
    return sanitized;
  }

  const result: Record<string, unknown> = {};
  const entries = Object.entries(value as Record<string, unknown>);
  for (const [rawKey, rawValue] of entries.slice(0, MAX_AUDIT_OBJECT_KEYS)) {
    const key = cleanString(rawKey, 120) || "field";
    if (SENSITIVE_KEY.test(key)) {
      result[key] = "[REDACTED]";
      continue;
    }
    const sanitized = sanitizeValue(rawValue, depth + 1, seen);
    if (sanitized !== undefined) result[key] = sanitized;
  }
  if (entries.length > MAX_AUDIT_OBJECT_KEYS) {
    result.__truncatedKeys = entries.length - MAX_AUDIT_OBJECT_KEYS;
  }
  return result;
}

export function sanitizeAuditPayload(value: unknown): unknown {
  if (value === undefined) return null;

  const sanitized = sanitizeValue(value, 0, new WeakSet<object>());
  try {
    const serialized = JSON.stringify(sanitized);
    if (serialized.length <= MAX_AUDIT_PAYLOAD_BYTES) return sanitized;
    return {
      truncated: true,
      originalSize: serialized.length,
      preview: serialized.slice(0, MAX_AUDIT_PREVIEW_LENGTH),
    };
  } catch {
    return { dropped: true, reason: "non_serializable" };
  }
}
