import { createHash } from "crypto";

function stableValue(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (Array.isArray(value)) return value.map((item) => stableValue(item));
  if (typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableValue(item)]),
  );
}

export function canonicalAuditPayload(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

export function hashAuditPayload(value: unknown): string {
  return createHash("sha256").update(canonicalAuditPayload(value)).digest("hex");
}
