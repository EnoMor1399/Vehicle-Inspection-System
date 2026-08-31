import test from "node:test";
import assert from "node:assert/strict";
import { formatServerTiming, timeOperation } from "../src/lib/performance";

test("Server-Timing formatting sanitizes metric names and preserves durations", () => {
  assert.equal(
    formatServerTiming([
      { name: "Vehicles List", durationMs: 12.34 },
      { name: "vehicles-count", durationMs: 4.56 },
    ], 13.01),
    "vehicles_list;dur=12.3, vehicles_count;dur=4.6, total;dur=13"
  );
});

test("timed operations return the original value with a non-negative duration", async () => {
  const result = await timeOperation("unit_test", async () => ({ ok: true }));
  assert.deepEqual(result.value, { ok: true });
  assert.equal(result.durationMs >= 0, true);
});
