import assert from "node:assert/strict";
import test from "node:test";
import {
  appointmentStatusLabel,
  canTransitionAppointment,
  capacityLoad,
} from "../src/lib/inspection-scheduling";

test("appointment workflow permits only controlled forward transitions", () => {
  assert.equal(canTransitionAppointment("scheduled", "confirmed"), true);
  assert.equal(canTransitionAppointment("scheduled", "completed"), false);
  assert.equal(canTransitionAppointment("confirmed", "checked_in"), true);
  assert.equal(canTransitionAppointment("checked_in", "in_progress"), true);
  assert.equal(canTransitionAppointment("completed", "scheduled"), false);
});

test("appointment status labels are human readable", () => {
  assert.equal(appointmentStatusLabel("checked_in"), "Checked In");
  assert.equal(appointmentStatusLabel("no_show"), "No Show");
});

test("station capacity load handles configured and unknown capacity", () => {
  assert.deepEqual(capacityLoad(8, 10), {
    booked: 8,
    capacity: 10,
    percent: 80,
    state: "busy",
  });
  assert.equal(capacityLoad(10, 10).state, "full");
  assert.equal(capacityLoad(3, null).state, "unknown");
});
