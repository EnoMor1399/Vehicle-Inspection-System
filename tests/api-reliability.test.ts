import test from "node:test";
import assert from "node:assert/strict";
import {
  API_MAX_OFFSET,
  parseApiPagination,
} from "../src/lib/api-pagination";
import {
  API_KEY_USAGE_REFRESH_MS,
  shouldRefreshApiKeyUsage,
} from "../src/lib/api-key-usage";
import {
  assessInspectionOutcome,
  deriveVehicleStatusAfterInspection,
} from "../src/lib/inspection-policy";

test("API pagination uses safe defaults and valid explicit values", () => {
  assert.deepEqual(parseApiPagination(new URLSearchParams()), { ok: true, limit: 50, offset: 0 });
  assert.deepEqual(
    parseApiPagination(new URLSearchParams({ limit: "25", offset: "125" })),
    { ok: true, limit: 25, offset: 125 }
  );
});

test("API pagination rejects malformed and abusive database offsets", () => {
  for (const params of [
    new URLSearchParams({ limit: "NaN" }),
    new URLSearchParams({ limit: "0" }),
    new URLSearchParams({ limit: "101" }),
    new URLSearchParams({ offset: "-1" }),
    new URLSearchParams({ offset: String(API_MAX_OFFSET + 1) }),
  ]) {
    const parsed = parseApiPagination(params);
    assert.equal(parsed.ok, false);
  }
});

test("API key usage metadata is throttled instead of written on every request", () => {
  const now = new Date("2026-08-31T20:00:00.000Z");
  assert.equal(shouldRefreshApiKeyUsage(null, now), true);
  assert.equal(
    shouldRefreshApiKeyUsage(new Date(now.getTime() - API_KEY_USAGE_REFRESH_MS + 1), now),
    false
  );
  assert.equal(
    shouldRefreshApiKeyUsage(new Date(now.getTime() - API_KEY_USAGE_REFRESH_MS), now),
    true
  );
});

test("inspection policy prevents PASS with failures and conditional pass with critical defects", () => {
  const failed = assessInspectionOutcome("pass", [{
    items: [{ name: "Service brake", result: "fail" as const, severity: "major" as const }],
  }]);
  assert.equal(failed.ok, false);
  assert.equal(failed.failedCount, 1);

  const criticalConditional = assessInspectionOutcome("conditional_pass", [{
    items: [{ name: "Steering linkage", result: "fail" as const, severity: "critical" as const }],
  }]);
  assert.equal(criticalConditional.ok, false);
  assert.equal(criticalConditional.criticalFailedCount, 1);

  const validConditional = assessInspectionOutcome("conditional_pass", [{
    items: [{ name: "Marker lamp", result: "fail" as const, severity: "minor" as const }],
  }]);
  assert.equal(validConditional.ok, true);
});

test("inspection workflow derives fleet status without bypassing approval", () => {
  assert.equal(deriveVehicleStatusAfterInspection("pass", "completed", true), "under_inspection");
  assert.equal(deriveVehicleStatusAfterInspection("pass", "approved", true), "passed");
  assert.equal(deriveVehicleStatusAfterInspection("pass", "completed", false), "passed");
  assert.equal(deriveVehicleStatusAfterInspection("fail", "completed", true), "failed");
  assert.equal(deriveVehicleStatusAfterInspection("conditional_pass", "approved", true), "under_inspection");
  assert.equal(deriveVehicleStatusAfterInspection("pass", "draft", false), null);
  assert.equal(deriveVehicleStatusAfterInspection("pass", "in_progress", false), "under_inspection");
});
