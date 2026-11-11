/**
 * Validates measured brake-test efficiency as a percentage (0-100) with
 * maximum two decimal places. Never silently rounds or fabricates readings.
 * A blank, unmeasured component remains NULL in the inspection record.
 *
 * This intentionally does not determine PASS/FAIL. The approved inspection
 * standard and the inspector's signed checklist govern that decision.
 */
export function parseBrakeEfficiencyPercent(
  value: string | undefined,
  label: string,
): string | null {
  if (value == null || value.trim() === "") return null;
  const trimmed = value.trim();
  if (!/^(?:0|[1-9]\d{0,2})(?:\.\d{1,2})?$/.test(trimmed)) {
    throw new Error(`${label} must be a percentage from 0 to 100 with up to two decimal places`);
  }
  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount < 0 || amount > 100) {
    throw new Error(`${label} must be between 0% and 100%`);
  }
  return amount.toFixed(2);
}
