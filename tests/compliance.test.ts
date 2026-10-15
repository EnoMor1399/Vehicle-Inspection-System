import assert from "node:assert/strict";
import test from "node:test";
import { classifyExpiry, daysUntil, earliestExpiry } from "../src/lib/compliance";

const now = new Date("2026-10-15T12:00:00.000Z");

test("daysUntil compares calendar dates", () => {
  assert.equal(daysUntil("2026-10-15", now), 0);
  assert.equal(daysUntil("2026-10-20", now), 5);
  assert.equal(daysUntil("2026-10-10", now), -5);
});

test("classifyExpiry distinguishes overdue, due soon and current", () => {
  assert.deepEqual(classifyExpiry("2026-10-10", 30, now), {
    state: "overdue",
    days: -5,
    label: "5d overdue",
  });
  assert.equal(classifyExpiry("2026-10-20", 30, now).state, "due_soon");
  assert.equal(classifyExpiry("2027-01-20", 30, now).state, "current");
  assert.equal(classifyExpiry(null, 30, now).state, "unknown");
});

test("earliestExpiry returns the nearest recorded obligation", () => {
  const result = earliestExpiry([
    { label: "Insurance", value: "2026-12-01" },
    { label: "Roadworthy", value: "2026-10-18" },
    { label: "Road Fund", value: "2026-11-15" },
  ], now);

  assert.equal(result?.label, "Roadworthy");
  assert.equal(result?.status.days, 3);
});
