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

  assert.match(page, /\bCreate\b/);
  assert.match(page, /Active & upcoming sessions/);
  assert.doesNotMatch(page, /QUICK_WORKSPACES/);
  assert.doesNotMatch(page, /Service portfolio/);
  assert.doesNotMatch(page, /Training & assessment services/);
});

test("Assessment workspace keeps core controls while collapsing secondary follow-up content", () => {
  const page = readFileSync("src/app/driver-training/assessments/page.tsx", "utf8");

  assert.match(page, /Performance ratings/);
  assert.match(page, /Critical safety violations/);
  assert.match(page, /Qualitative trainer feedback/);
  assert.match(page, /Corrective action \/ development plan/);
  assert.match(page, /Driver acknowledgement/);
  assert.match(page, /Finalize assessment/);
  assert.doesNotMatch(page, /Safety behaviour observations/);
  assert.doesNotMatch(page, /Vehicle handling observations/);
  assert.doesNotMatch(page, /Communication & professional behaviour/);
  assert.doesNotMatch(page, /Additional assessment remarks/);
});

test("Assessment review queue focuses on pending work instead of duplicating review history", () => {
  const page = readFileSync("src/app/driver-training/assessments/review/page.tsx", "utf8");

  assert.match(page, /Pending independent reviews/);
  assert.doesNotMatch(page, /Recent review decisions/);
  assert.doesNotMatch(page, /Your own assessments/);
});
