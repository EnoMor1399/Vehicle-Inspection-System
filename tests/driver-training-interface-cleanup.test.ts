import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Driver Training navigation groups related workspaces into fewer controls", () => {
  const nav = readFileSync("src/app/driver-training/DriverTrainingNav.tsx", "utf8");

  assert.match(nav, /label="Operations"/);
  assert.match(nav, /label="Assessments"/);
  assert.match(nav, /href: "\/driver-training\/requests"/);
  assert.match(nav, /href: "\/driver-training\/sessions"/);
  assert.match(nav, /href: "\/driver-training\/participants"/);
  assert.match(nav, /href: "\/driver-training\/assessments\/review"/);
  assert.match(nav, /href: "\/driver-training\/certificates"/);
  assert.doesNotMatch(nav, /description: "Pricing, quotations and commercial controls"/);
});

test("Driver Training overview avoids duplicated quick-access and service-catalogue content", () => {
  const page = readFileSync("src/app/driver-training/page.tsx", "utf8");

  assert.match(page, /Create record/);
  assert.match(page, /Current sessions/);
  assert.match(page, /Scheduled and in-progress programmes\./);
  assert.doesNotMatch(page, /QUICK_WORKSPACES/);
  assert.doesNotMatch(page, /Service portfolio/);
  assert.doesNotMatch(page, /Training & assessment services/);
});

test("Assessment workspace keeps core controls while collapsing secondary follow-up content", () => {
  const page = readFileSync("src/app/driver-training/assessments/page.tsx", "utf8");

  assert.match(page, /Performance Ratings/);
  assert.match(page, /Critical Violations/);
  assert.match(page, /Trainer Feedback/);
  assert.match(page, /Development Plan/);
  assert.match(page, /Driver Acknowledgement/);
  assert.match(page, /Submit Assessment/);
  assert.match(page, /critical violation blocks competence/);
  assert.doesNotMatch(page, /Safety behaviour observations/);
  assert.doesNotMatch(page, /Vehicle handling observations/);
  assert.doesNotMatch(page, /Communication & professional behaviour/);
  assert.doesNotMatch(page, /Additional assessment remarks/);
});

test("Assessment review queue focuses on pending work instead of duplicating review history", () => {
  const page = readFileSync("src/app/driver-training/assessments/review/page.tsx", "utf8");

  assert.match(page, /Pending reviews/);
  assert.doesNotMatch(page, /Recent review decisions/);
  assert.doesNotMatch(page, /Your own assessments/);
});
