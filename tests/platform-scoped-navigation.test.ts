import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  scopedOrganizationHref, SCOPED_NAV_SECTIONS, SCOPED_SECTION_DETAILS,
} from "../src/lib/platform-oversight-navigation";
import { isValidOrganizationId, ORGANIZATION_ID_PATTERN } from "../src/lib/organization-id";

const shell = readFileSync("src/components/AppShell.tsx", "utf8");
const scopedPage = readFileSync("src/app/platform/oversight/[id]/section/[section]/page.tsx", "utf8");
const server = readFileSync("src/lib/platform-scoped-module-records.ts", "utf8");

const id = "49ed5e8b-c357-4da0-b099-a83c4f911111";

test("shared organization UUID validator admits every selected subscriber and blocks malformed IDs", () => {
  const realRslId = "00000000-0000-4000-8000-000000000101";
  const otherTenantId = "e2e10000-0000-4000-8000-000000000001";
  for (const value of [realRslId, otherTenantId, id]) {
    assert.equal(isValidOrganizationId(value), true, `Valid organization ${value} should not produce 404`);
    assert.equal(ORGANIZATION_ID_PATTERN.test(value), true);
  }
  for (const value of [
    "rsl", "e2e10000-0000-4000-000000000001", "", "not-an-id",
    "00000000-0000-4000-8000-000000000101/section/vehicles", null, undefined,
  ]) assert.equal(isValidOrganizationId(value), false);

  // All protected loaders must validate the same full 8-4-4-4-12 ID.
  for (const loader of [
    "src/lib/platform-oversight.ts",
    "src/lib/platform-asset-inventory.ts",
    "src/lib/platform-scoped-module-records.ts",
  ]) {
    const source = readFileSync(loader, "utf8");
    assert.match(source, /import \{ isValidOrganizationId \} from "@\/lib\/organization-id"/);
    assert.match(source, /if \(!isValidOrganizationId\(organizationId\)\)/);
  }
});

test("every operational navigation button maps to a protected organization-specific destination", () => {
  for (const [href, section] of Object.entries(SCOPED_NAV_SECTIONS)) {
    assert.equal(
      scopedOrganizationHref(id, href),
      `/platform/oversight/${id}/section/${section}`,
      `Missing scoped route for ${href}`,
    );
    assert.ok(Object.prototype.hasOwnProperty.call(SCOPED_SECTION_DETAILS, section));
  }
  assert.equal(scopedOrganizationHref(id, "/"), `/platform/oversight/${id}`);
  // Platform-wide tools and generic help do not impersonate a tenant.
  for (const path of [
    "/platform/oversight", "/platform/organizations", "/platform/account-support",
    "/platform/content", "/platform/notices", "/platform/payments",
    "/apps", "/api-docs", "/guide",
  ]) assert.equal(scopedOrganizationHref(id, path), path);
});

test("sidebar retains the organization across scoped routes and does not send Super Admin to original operational routes", () => {
  assert.match(shell, /href=\{scopedNavigationHref\(item\.href\)\}/);
  assert.match(shell, /href === "\/" \|\| href in SCOPED_NAV_SECTIONS/);
  assert.match(shell, /sessionStorage\.setItem\(LAST_OVERSIGHT_ORG_KEY, organizationId\)/);
  assert.match(shell, /organizationChoices\.some\(\(organization\) => organization\.id === id\)/);
  assert.match(shell, /currentPageIsScoped/);
  assert.match(shell, /href=\{scopedNavigationHref\("\/notifications"\)\}/);
  assert.match(shell, /!activeOversightOrganizationId && notificationUnreadCount > 0/);
  assert.match(shell, /Organization-scoped view/);
  assert.match(shell, /operationContext\) return href/);
  assert.match(shell, /Organization selection retained · this page is platform-wide/);
});

test("scoped module pages require privileged, validated, organization-specific reads", () => {
  assert.match(scopedPage, /if \(!isScopedSection\(section\)\)[\s\S]*?notFound\(\)/);
  assert.match(scopedPage, /getPlatformOrganizationOversight\(id\)/);
  assert.match(scopedPage, /listPlatformScopedModuleRecords\(organizationId, section, currentPage\)/);
  assert.match(scopedPage, /getPlatformOrganizationAssetInventory\(organizationId/);
  assert.match(server, /await requirePlatformSuperAdmin\(\)/);
  for (const name of [
    "inspections", "dailyInspections", "inspectionAppointments", "vehicles",
    "users", "auditLogs", "securityEvents", "importJobs",
  ]) assert.match(server, new RegExp(`eq\\(${name}\\.organizationId, organizationId\\)`));
  assert.doesNotMatch(server, /db\.insert\(|db\.update\(|db\.delete\(/);
  assert.match(server, /SCOPED_MODULE_PAGE_SIZE = 40/);
  assert.match(scopedPage, /<VehicleRegistryView/);
  assert.match(scopedPage, /<TransportersWorkspaceView/);
  assert.match(scopedPage, /<InspectionRegistryView/);
  assert.match(scopedPage, /<ReportsWorkspaceView/);
  assert.match(scopedPage, /<ClassicScopedModuleView/);
});

test("sidebar preserves existing non-Super Admin links and never authorizes use of browser storage as tenant authority", () => {
  assert.match(shell, /if \(!canSelectOrganization\) return href/);
  assert.match(shell, /role === "super_admin"|userRole === "super_admin"/);
  assert.match(shell, /supportContext/);
  assert.doesNotMatch(server, /sessionStorage|localStorage|document\.cookie/);
  assert.doesNotMatch(scopedPage, /sessionStorage|localStorage|document\.cookie/);
});
