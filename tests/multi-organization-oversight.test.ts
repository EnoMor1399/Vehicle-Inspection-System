import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("sidebar is the only organization selector and never impersonates a tenant", () => {
  const helper = readFileSync("src/lib/platform-oversight.ts", "utf8");
  const shell = readFileSync("src/components/AppShell.tsx", "utf8");
  const detail = readFileSync("src/app/platform/oversight/[id]/page.tsx", "utf8");
  const platformOverview = readFileSync("src/app/platform/oversight/page.tsx", "utf8");
  const scopedModule = readFileSync("src/app/platform/oversight/[id]/section/[section]/page.tsx", "utf8");

  assert.match(helper, /export async function listPlatformOrganizationChoices\\(\\)/);
  assert.match(helper, /listPlatformOrganizationChoices\\(\\)[\\s\\S]*?await requirePlatformSuperAdmin\\(\\)/);
  assert.match(shell, /aria-label="Switch organization in the sidebar"/);
  assert.match(shell, /const canSelectOrganization = isSuperAdmin && !supportContext/);
  assert.match(shell, /organizationChoices\\.some\\(\\(organization\\) => organization\\.id === organizationId\\)/);
  assert.match(shell, /router\\.push\\(\\`\\/platform\\/oversight\\/\\$\\{encodeURIComponent\\(organizationId\\)\\}\\`\\)/);
  assert.doesNotMatch(shell, /label: "Platform Oversight Centre"/);
  assert.match(shell, /href: "\\/", label: "Dashboard"/);
  assert.doesNotMatch(shell, /document\\.cookie\\s*=|localStorage\\.setItem/);

  assert.match(detail, /getPlatformOrganizationOversight\\(id\\)/);
  assert.doesNotMatch(detail, /OrganizationSwitcher|Switch organization|All organisations|Manage subscription & workspace/);
  assert.match(detail, /<AssetInventory organizationId=\\{org\\.id\\} inventory=\\{inventory\\} \\/>/);
  assert.doesNotMatch(scopedModule, /Organization overview<\\/|<ArrowLeft/);
  assert.match(platformOverview, /title="Platform Overview"/);
  assert.doesNotMatch(platformOverview, /Platform Oversight Centre|Open oversight/);
  assert.match(platformOverview, /organization selector in the sidebar/);
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
