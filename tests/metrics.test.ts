import test from "node:test";
import assert from "node:assert/strict";
import { calculateFleetReadiness } from "../src/lib/metrics";

test("fleet readiness excludes decommissioned vehicles from the denominator", () => {
  assert.deepEqual(
    calculateFleetReadiness({ total: 10, active: 4, passed: 3, decommissioned: 1 }),
    { readyVehicles: 7, eligibleVehicles: 9, fleetReadinessRate: 78 }
  );
});

test("fleet readiness cannot exceed 100 percent even with inconsistent counts", () => {
  assert.deepEqual(
    calculateFleetReadiness({ total: 10, active: 10, passed: 5, decommissioned: 0 }),
    { readyVehicles: 10, eligibleVehicles: 10, fleetReadinessRate: 100 }
  );
});

test("fleet readiness handles an entirely decommissioned fleet", () => {
  assert.deepEqual(
    calculateFleetReadiness({ total: 4, active: 0, passed: 0, decommissioned: 4 }),
    { readyVehicles: 0, eligibleVehicles: 0, fleetReadinessRate: 0 }
  );
});
