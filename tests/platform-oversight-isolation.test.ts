import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

test("Super Admin platform overview is gated and presents only aggregated data", () => {
  const source = read("src/lib/platform-oversight.ts");
  const page = read("src/app/platform/oversight/page.tsx");
  assert.match(source, /getPlatformOversightOverview\(\)\s*\{\s*await requirePlatformSuperAdmin\(\)/);
  assert.match(source, /getPlatformOrganizationOversight\(organizationId: string\)\s*\{\s*await requirePlatformSuperAdmin\(\)/);
  assert.match(page, /getPlatformOversightOverview/);
  assert.match(page, /title="Platform Overview"/);
  assert.doesNotMatch(page, /Platform Oversight Centre/);
  assert.match(source, /\.groupBy\(table\.organizationId\)/);
  assert.match(source, /eq\(securityEvents\.resolved, false\)/);
  assert.doesNotMatch(source, /\.update\(|\.delete\(|\.insert\(/);
});

test("organization oversight read model filters every operational and security resource", () => {
  const source = read("src/lib/platform-oversight.ts");
  assert.match(source, /eq\(organizations\.id, organizationId\)/);
  for (const table of [
    "users", "vehicles", "inspections", "auditLogs", "securityEvents",
    "locations", "transporters", "documents", "trainingSessions",
  ]) {
    assert.match(source, new RegExp(`eq\\(${table}\\.organizationId, org\\.id\\)`));
  }
  assert.match(source, /where\(eq\(table\.organizationId, organizationId\)\)/);
  assert.match(source, /limit\(200\)/);
  assert.match(source, /limit\(20\)/);
  assert.match(source, /return null;/);
});

test("overarching navigation and account support remain Super Admin-only", () => {
  const nav = read("src/components/AppShell.tsx");
  const orgs = read("src/app/platform/organizations/page.tsx");
  const detail = read("src/app/platform/oversight/[id]/page.tsx");
  const support = read("src/app/platform/account-support/page.tsx");
  // Dashboard uses the selected organization; platform administration is
  // reached using the protected Subscriber Companies and support buttons.
  assert.match(nav, /href: "\/", label: "Dashboard"/);
  assert.match(nav, /href: "\/platform\/organizations".*superAdminOnly: true/);
  assert.match(nav, /href: "\/platform\/account-support".*superAdminOnly: true/);
  assert.match(nav, /canSelectOrganization = isSuperAdmin && !supportContext/);
  assert.doesNotMatch(nav, /label: "Platform Oversight Centre"/);
  assert.match(orgs, /href="\/platform\/oversight"/);
  assert.match(detail, /getPlatformOrganizationOversight\(id\)/);
  assert.match(detail, /getPlatformOrganizationAssetInventory\(id/);
  assert.doesNotMatch(detail, /OrganizationSwitcher|platform\/account-support\?organizationId=/);
  assert.match(support, /actor\.role !== "super_admin"/);
  assert.match(support, /eq\(users\.organizationId, organizationFilter\)/);
});


test("resource previews include tenant-scoped training, stations, transporter and document metadata", () => {
  const view = read("src/app/platform/oversight/[id]/page.tsx");
  for (const section of ["Stations", "Transporter companies", "Driver training sessions", "Document inventory"]) {
    assert.ok(view.includes(section), `Missing resource section: ${section}`);
  }
  assert.match(view, /file contents are not exposed/);
});
