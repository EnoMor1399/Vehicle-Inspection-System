import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const selectedDashboard = read("src/app/platform/oversight/[id]/page.tsx");
const selectedModule = read("src/app/platform/oversight/[id]/section/[section]/page.tsx");
const dashboard = read("src/components/ExecutiveDashboardView.tsx");

test("selected organization uses original Executive Dashboard visual hierarchy, not generic oversight", () => {
  for (const text of [
    "Executive Dashboard", "Core operating metrics", "Total Vehicles",
    "Active Fleet", "Inspection outcome trend", "Operational attention",
    "Detailed performance analytics", "Today’s pre-trip inspections",
  ]) assert.ok(dashboard.includes(text), `Missing original dashboard section: ${text}`);
  assert.match(selectedDashboard, /getPlatformOrganizationOversight\(id\)/);
  assert.match(selectedDashboard, /<ExecutiveDashboardView[\s\S]*?organizationId=\{oversight\.organization\.id\}/);
  assert.match(dashboard, /computeDashboardStats\(organizationId\)/);
  assert.match(dashboard, /getMonthlyTrend\(organizationId\)/);
  assert.doesNotMatch(selectedDashboard, /OrganizationSwitcher|Platform Oversight Centre/);
});

test("every native high-traffic module reuses existing VIMS presentation", () => {
  for (const [slug, name] of [
    ["vehicles", "VehicleRegistryView"],
    ["transporters", "TransportersWorkspaceView"],
    ["inspections", "InspectionRegistryView"],
    ["daily-inspections", "DailyInspectionWorkspaceView"],
    ["scheduling", "InspectionSchedulingView"],
    ["stations", "InspectionStationsView"],
    ["training", "DriverTrainingWorkspaceView"],
    ["reports", "ReportsWorkspaceView"],
    ["audit", "AuditWorkspaceView"],
    ["compliance", "ComplianceWorkspaceView"],
    ["maintenance-risk", "PredictiveMaintenanceView"],
    ["documents", "DocumentsWorkspaceView"],
    ["users", "UsersWorkspaceView"],
  ]) {
    assert.ok(selectedModule.includes(`case "${slug}"`), `No selected-company case for ${slug}`);
    assert.ok(selectedModule.includes(`<${name}`), `Native VIMS presentation not reused for ${slug}`);
  }
  assert.match(selectedModule, /getPlatformOrganizationOversight\(id\)/);
  assert.match(selectedModule, /if \(!overview\) notFound\(\)/);
  assert.match(selectedModule, /<ClassicScopedModuleView/);
});

test("cross-organization pages prevent operational edits and original-tenant document links", () => {
  assert.match(selectedModule, /<VehicleRegistryView organizationId=\{organizationId\} editable=\{false\} readOnly/);
  assert.match(selectedModule, /<InspectionRegistryView organizationId=\{organizationId\} editable=\{false\} readOnly/);
  assert.match(selectedModule, /<DocumentsWorkspaceView organizationId=\{organizationId\} readOnly/);
  assert.match(selectedModule, /<UsersWorkspaceView organizationId=\{organizationId\} canManage=\{false\}/);
  assert.match(read("src/components/VehicleRegistryView.tsx"), /eq\(transporters\.organizationId, organizationId\)/);
  assert.match(read("src/components/InspectionSchedulingView.tsx"), /eq\(locations\.organizationId, organizationId\)/);
  assert.match(read("src/components/UsersWorkspaceView.tsx"), /\.from\(locations\)\.where\(eq\(locations\.organizationId, organizationId\)\)/);
  assert.match(read("src/app/documents/DocumentsList.tsx"), /!readOnly && <DocumentActions/);
  assert.match(read("src/components/DocumentsWorkspaceView.tsx"), /url: readOnly \? sql<string \| null>`null` : documents\.url/);
  assert.match(read("src/components/ExecutiveDashboardView.tsx"), /!readOnly && <Link/);
  assert.match(read("src/app/transporters/TransportersList.tsx"), /readOnly \? <span/);
});

test("regular signed-in users continue to use their native VIMS pages", () => {
  for (const [path,view] of [
    ["src/app/page.tsx","ExecutiveDashboardView"],
    ["src/app/vehicles/page.tsx","VehicleRegistryView"],
    ["src/app/transporters/page.tsx","TransportersWorkspaceView"],
    ["src/app/inspections/page.tsx","InspectionRegistryView"],
    ["src/app/daily-inspections/page.tsx","DailyInspectionWorkspaceView"],
    ["src/app/schedule/page.tsx","InspectionSchedulingView"],
    ["src/app/locations/page.tsx","InspectionStationsView"],
    ["src/app/driver-training/page.tsx","DriverTrainingWorkspaceView"],
    ["src/app/reports/page.tsx","ReportsWorkspaceView"],
  ]) {
    const source=read(path);
    assert.match(source, /require(VehicleInspectionUser|Permission|InternalUser)\(/);
    assert.ok(source.includes(`<${view}`), `Native tenant page ${path} no longer renders ${view}`);
  }
});
