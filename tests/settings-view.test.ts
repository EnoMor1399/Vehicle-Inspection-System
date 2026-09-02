import test from "node:test";
import assert from "node:assert/strict";
import {
  SYSTEM_SETTINGS_SERVER_FIELDS,
  toEditableSystemSettings,
} from "../src/lib/settings-view";

test("editable settings projection removes server-owned database fields", () => {
  const updatedAt = new Date("2026-09-02T00:00:00Z");
  const editable = toEditableSystemSettings({
    id: "singleton",
    defaultStationId: "station-1",
    updatedAt,
    updatedBy: "user-1",
    companyName: "Road Safety Limited",
    tagline: "Vehicle Inspection Management System",
  });

  assert.deepEqual(editable, {
    companyName: "Road Safety Limited",
    tagline: "Vehicle Inspection Management System",
  });

  for (const field of SYSTEM_SETTINGS_SERVER_FIELDS) {
    assert.equal(field in editable, false, `${field} must not be serialized to the editable form`);
  }
});
