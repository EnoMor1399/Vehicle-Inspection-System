import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("sidebar is the only organization selector and never impersonates a tenant", () => {
  const helper = readFileSync("src/lib/platform-oversight.ts", "utf8");
  const shell = readFileSync("src/components/AppShell.tsx", "utf8");
  const detail = readFileSync("src/app/platform/oversight/[id]/page.tsx", "utf8");
  const platformOverview = readFileSync("src/app/platform/oversight/page.tsx", "utf8");
  const scopedModule = readFileSync("src/app/platform/oversight/[id]/section/[section]/page.tsx", "utf8");

  assert.ok(helper.includes("export async function listPlatformOrganizationChoices()"));
  assert.ok(helper.includes("await requirePlatformSuperAdmin()"));
  assert.ok(shell.includes('aria-label="Switch organization in the sidebar"'));
  assert.ok(shell.includes("const canSelectOrganization = isSuperAdmin && !supportContext"));
  assert.ok(shell.includes("organizationChoices.some((organization) => organization.id === organizationId)"));
  assert.ok(shell.includes('router.push(`/platform/oversight/${encodeURIComponent(organizationId)}`)'));
  assert.ok(!shell.includes('label: "Platform Oversight Centre"'));
  assert.ok(shell.includes('href: "/", label: "Dashboard"'));
  assert.ok(!shell.includes("document.cookie ="));
  assert.ok(!shell.includes("localStorage.setItem"));

  assert.ok(detail.includes("getPlatformOrganizationOversight(id)"));
  for (const legacy of [
    "OrganizationSwitcher", "Switch organization", "All organisations",
    "Manage subscription & workspace",
  ]) assert.ok(!detail.includes(legacy), `Unexpected duplicate navigation: ${legacy}`);
  assert.ok(detail.includes("<ExecutiveDashboardView"));
  assert.ok(scopedModule.includes("<VehicleRegistryView"));
  assert.ok(scopedModule.includes("<AssetInventory"));
  assert.ok(!scopedModule.includes("Organization overview"));
  assert.ok(platformOverview.includes('title="Platform Overview"'));
  assert.ok(!platformOverview.includes("Platform Oversight Centre"));
  assert.ok(!platformOverview.includes("Open oversight"));
  assert.ok(platformOverview.includes("organization selector in the sidebar"));
});

test("organization oversight resource queries remain explicitly tenant scoped", () => {
  const helper = readFileSync("src/lib/platform-oversight.ts", "utf8");
  const detailHelper = helper.slice(
    helper.indexOf("export async function getPlatformOrganizationOversight"),
    helper.indexOf("type CountableTable"),
  );

  for (const table of [
    "users", "vehicles", "inspections", "auditLogs", "securityEvents",
    "locations", "transporters", "documents", "trainingSessions",
  ]) {
    assert.ok(
      detailHelper.includes(`.from(${table}).where(eq(${table}.organizationId, org.id))`),
      `Expected ${table} query to filter by the selected organization`,
    );
  }
  assert.match(detailHelper, /scopedCount\(users, org\.id\)/);
  assert.match(detailHelper, /scopedCount\(vehicles, org\.id\)/);
});

test("default app branding is neutral rather than hard-coded to RSL", () => {
  const shell = readFileSync("src/components/AppShell.tsx", "utf8");
  assert.match(shell, /companyName: "VIMS Enterprise"/);
  assert.match(shell, /Multi-Organization Vehicle Inspection Management/);
  assert.doesNotMatch(shell, /companyName: "Road Safety Limited"/);
});
