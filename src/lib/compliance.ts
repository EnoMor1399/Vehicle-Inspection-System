export type ComplianceState = "overdue" | "due_soon" | "current" | "unknown";

export type ComplianceExpiry = {
  state: ComplianceState;
  days: number | null;
  label: string;
};

function asDateOnly(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const raw = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function utcDateOnly(value: Date): Date {
  return new Date(`${value.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

export function daysUntil(value: string | Date | null | undefined, now = new Date()): number | null {
  const target = asDateOnly(value);
  if (!target) return null;
  const current = utcDateOnly(now);
  return Math.round((target.getTime() - current.getTime()) / 86_400_000);
}

export function classifyExpiry(
  value: string | Date | null | undefined,
  warningDays = 30,
  now = new Date(),
): ComplianceExpiry {
  const days = daysUntil(value, now);
  if (days === null) return { state: "unknown", days: null, label: "Not recorded" };
  if (days < 0) return { state: "overdue", days, label: `${Math.abs(days)}d overdue` };
  if (days <= warningDays) return { state: "due_soon", days, label: days === 0 ? "Due today" : `Due in ${days}d` };
  return { state: "current", days, label: `${days}d remaining` };
}

export function earliestExpiry(
  values: Array<{ label: string; value: string | Date | null | undefined }>,
  now = new Date(),
): { label: string; value: string | Date; status: ComplianceExpiry } | null {
  const ranked = values
    .filter((item): item is { label: string; value: string | Date } => Boolean(item.value))
    .map((item) => ({ ...item, status: classifyExpiry(item.value, 60, now) }))
    .filter((item) => item.status.days !== null)
    .sort((a, b) => (a.status.days ?? Number.MAX_SAFE_INTEGER) - (b.status.days ?? Number.MAX_SAFE_INTEGER));

  return ranked[0] || null;
}
