import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file: string) => readFileSync(file, "utf8");

test("role-scoped navigation keeps all operational entry points while collapsing secondary groups", () => {
  const nav = read("src/components/AppShell.tsx");
  assert.match(nav, /collapsible\?: boolean/);
  assert.match(nav, /group\.collapsible \? \(/);
  assert.match(nav, /defaultOpen=\{groupHasCurrentPage\}/);
  assert.match(nav, /aria-current=\{active \? "page"/);
  assert.match(nav, /item\.superAdminOnly/);
  assert.match(nav, /item\.organizationOwnerOnly/);
  assert.match(nav, /allowed\.has\(item\.resource\)/);
  for (const route of [
    "/vehicles", "/transporters", "/inspections", "/daily-inspections",
    "/schedule", "/locations", "/driver-training", "/reports", "/compliance",
    "/predictive", "/powerbi", "/rfid", "/users", "/documents",
    "/notifications", "/import", "/settings", "/audit",
    "/platform/organizations", "/organization/account", "/api-docs",
    "/guide", "/portal", "/apps",
  ]) {
    assert.ok(nav.includes(`href: "${route}"`), `Navigation route missing: ${route}`);
  }
});

test("advanced visual analytics remain accessible without overwhelming the initial dashboard", () => {
  const page = read("src/app/page.tsx");
  assert.match(page, /<details className="group mt-6/);
  assert.match(page, /Detailed performance analytics/);
  assert.match(page, /Show insights/);
  assert.match(page, /Hide insights/);
  for (const feature of [
    "TrendChart", "StationChart", "TransporterChart", "DefectsChart",
    "CategoryPie", "InspectorChart", "RegionHeatMap", "YearlyComparisonChart",
    "Today’s pre-trip inspections", "Operational attention", "New Inspection",
  ]) {
    assert.ok(page.includes(feature), `Existing dashboard functionality missing: ${feature}`);
  }
});

test("sign-in removes promotional card clutter but keeps authentication and registration path", () => {
  const page = read("src/app/login/page.tsx");
  assert.match(page, /<AuthForm allowSignUp=\{allowPublicSignup\}/);
  assert.match(page, /href="\/subscribe"/);
  assert.match(page, /Authorized access only/);
  assert.doesNotMatch(page, /<Feature icon=/);
  assert.doesNotMatch(page, /function Feature\(/);
});

test("subscriber onboarding keeps plan comparisons and the complete request form", () => {
  const page = read("src/app/subscribe/page.tsx");
  const form = read("src/app/subscribe/SubscribeForm.tsx");
  assert.match(page, /Compare plans and prices/);
  assert.match(page, /<details/);
  assert.match(page, /<SubscribeForm plans=/);
  assert.match(page, /tenant isolation checks/);
  for (const field of [
    "companyName", "contactName", "contactEmail", "contactPhone",
    "country", "industry", "estimatedUsers", "estimatedVehicles",
    "desiredPlanCode", "requestedModules", "notes", "website",
  ]) {
    assert.ok(form.includes(`name="${field}"`), `Subscriber form field missing: ${field}`);
  }
  assert.match(form, /submitSubscriptionRequest/);
});
