import assert from "node:assert/strict";
import test from "node:test";
import { reportPeriodLabel, validateReportDateRange } from "../src/lib/report-period";

test("report date range accepts all-time exports", () => {
  const range = validateReportDateRange({});
  assert.equal(range.start, null);
  assert.equal(range.endExclusive, null);
});

test("report date range includes the complete end date", () => {
  const range = validateReportDateRange({ startDate: "2026-10-01", endDate: "2026-10-31" });
  assert.equal(range.start?.toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(range.endExclusive?.toISOString(), "2026-11-01T00:00:00.000Z");
});

test("report date range rejects incomplete and reversed periods", () => {
  assert.throws(() => validateReportDateRange({ startDate: "2026-10-01" }), /both a start date and an end date/);
  assert.throws(
    () => validateReportDateRange({ startDate: "2026-11-01", endDate: "2026-10-01" }),
    /cannot be after/,
  );
});

test("report date range rejects invalid calendar dates", () => {
  assert.throws(
    () => validateReportDateRange({ startDate: "2026-02-30", endDate: "2026-03-01" }),
    /valid calendar date/,
  );
});

test("report period label is readable", () => {
  assert.equal(reportPeriodLabel(null, null), "All time");
  assert.equal(reportPeriodLabel("2026-10-01", "2026-10-31"), "01 Oct 2026 – 31 Oct 2026");
});
