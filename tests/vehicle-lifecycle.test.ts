import test from "node:test";
import assert from "node:assert/strict";
import { vehicleCreateSchema, vehiclePatchSchema } from "../src/lib/api-schemas";
import { validateGenericVehicleStatusTransition } from "../src/lib/vehicle-lifecycle";

test("new vehicles cannot be created in inspection-derived or terminal states", () => {
  const base = { registration_number: "GW-1234-26", make: "Toyota" };
  assert.equal(vehicleCreateSchema.safeParse({ ...base, status: "active" }).success, true);
  assert.equal(vehicleCreateSchema.safeParse({ ...base, status: "suspended" }).success, true);
  assert.equal(vehicleCreateSchema.safeParse({ ...base, status: "passed" }).success, false);
  assert.equal(vehicleCreateSchema.safeParse({ ...base, status: "failed" }).success, false);
  assert.equal(vehicleCreateSchema.safeParse({ ...base, status: "decommissioned" }).success, false);
});

test("patch schema still accepts lifecycle requests for policy evaluation", () => {
  assert.equal(vehiclePatchSchema.safeParse({ status: "decommissioned" }).success, true);
  assert.equal(vehiclePatchSchema.safeParse({ transporter_id: null }).success, true);
});

test("generic vehicle updates cannot manufacture inspection outcomes", () => {
  for (const requested of ["under_inspection", "passed", "failed"] as const) {
    const decision = validateGenericVehicleStatusTransition("active", requested);
    assert.equal(decision.ok, false, requested);
  }
});

test("inspection-derived states can only leave through decommissioning", () => {
  assert.equal(validateGenericVehicleStatusTransition("passed", "active").ok, false);
  assert.equal(validateGenericVehicleStatusTransition("failed", "suspended").ok, false);
  assert.equal(validateGenericVehicleStatusTransition("under_inspection", "decommissioned").ok, true);
});

test("decommissioned vehicles are terminal through the generic API", () => {
  assert.equal(validateGenericVehicleStatusTransition("decommissioned", "active").ok, false);
  assert.equal(validateGenericVehicleStatusTransition("decommissioned", "decommissioned").ok, true);
});
