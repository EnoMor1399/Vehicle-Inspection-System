import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  stationAdminSchema,
  transporterAdminSchema,
  vehicleAdminSchema,
} from "../src/lib/admin-entity-policy";

test("vehicle admin policy bounds identity and numeric fields", () => {
  const valid = vehicleAdminSchema.safeParse({
    registrationNumber: "GT-1234-26",
    make: "Toyota",
    manufacturingYear: "2025",
    odometerReading: "12000",
    grossWeight: "3500.50",
    numberOfAxles: "2",
    status: "active",
  });
  assert.equal(valid.success, true);

  assert.equal(vehicleAdminSchema.safeParse({ registrationNumber: "G", make: "Toyota" }).success, false);
  assert.equal(vehicleAdminSchema.safeParse({ registrationNumber: "GT-1", make: "Toyota", odometerReading: "12abc" }).success, false);
  assert.equal(vehicleAdminSchema.safeParse({ registrationNumber: "GT-1", make: "Toyota", grossWeight: "12.123" }).success, false);
  assert.equal(vehicleAdminSchema.safeParse({ registrationNumber: "GT-1", make: "Toyota", numberOfAxles: "0" }).success, false);
});

test("transporter and station policies reject malformed runtime values", () => {
  assert.equal(transporterAdminSchema.safeParse({ companyName: "Acme Transport", email: "ops@example.com" }).success, true);
  assert.equal(transporterAdminSchema.safeParse({ companyName: "A", email: "bad-email" }).success, false);

  assert.equal(stationAdminSchema.safeParse({ name: "Tema Station", code: "TM-01", capacity: 100 }).success, true);
  assert.equal(stationAdminSchema.safeParse({ name: "Tema Station", code: "bad code" }).success, false);
  assert.equal(stationAdminSchema.safeParse({ name: "Tema Station", code: "TM-01", capacity: 10001 }).success, false);
});

test("web vehicle mutation path enforces inspection-controlled lifecycle policy", () => {
  const source = readFileSync("src/app/vehicles/server.ts", "utf8");
  assert.match(source, /New vehicles can start only as active or suspended/);
  assert.match(source, /validateGenericVehicleStatusTransition\(before\.status, requestedStatus\)/);
  assert.match(source, /A decommissioned vehicle cannot be edited/);
  assert.match(source, /validateTransporterReference/);
});

test("transporter detail path requires transporter permission for internal accounts", () => {
  const source = readFileSync("src/app/transporters/server.ts", "utf8");
  assert.match(source, /user\.role === "transporter_user"/);
  assert.match(source, /else if \(!canEditTransporters\(user\)\)/);
});
