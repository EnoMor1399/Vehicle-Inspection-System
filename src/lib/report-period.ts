const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function parseDateOnly(value: string, field: string) {
  if (!DATE_ONLY.test(value)) throw new Error(`${field} must use YYYY-MM-DD format`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${field} is not a valid calendar date`);
  }
  return parsed;
}

export function validateReportDateRange(input: {
  startDate?: string | null;
  endDate?: string | null;
}) {
  const startDate = input.startDate?.trim() || null;
  const endDate = input.endDate?.trim() || null;

  if (!startDate && !endDate) {
    return {
      startDate: null,
      endDate: null,
      start: null,
      endExclusive: null,
    };
  }

  if (!startDate || !endDate) {
    throw new Error("Choose both a start date and an end date");
  }

  const start = parseDateOnly(startDate, "Start date");
  const end = parseDateOnly(endDate, "End date");
  if (start.getTime() > end.getTime()) {
    throw new Error("Start date cannot be after end date");
  }

  const endExclusive = new Date(end.getTime() + 86_400_000);
  const maxSpanDays = 3660;
  if ((endExclusive.getTime() - start.getTime()) / 86_400_000 > maxSpanDays) {
    throw new Error("Custom report ranges cannot exceed 10 years");
  }

  return { startDate, endDate, start, endExclusive };
}

export function reportPeriodLabel(startDate?: string | null, endDate?: string | null) {
  if (!startDate && !endDate) return "All time";
  if (!startDate || !endDate) return "Custom period";

  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  if (startDate === endDate) return formatter.format(start);
  return `${formatter.format(start)} – ${formatter.format(end)}`;
}
