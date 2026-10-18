import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("organization switcher is privileged, explicit, and does not change tenant sessions", () => {
  const helper = readFileSync("src/lib/platform-oversight.ts", "utf8");
  const switcher = readFileSync("src/app/platform/oversight/OrganizationSwitcher.tsx", "utf8");
  const detail = readFileSync("src/app/platform/oversight/[id]/page.tsx", "utf8");

  assert.match(helper, /export async function listPlatformOrganizationChoices\(\)/);
  assert.match(helper, /listPlatformOrganizationChoices\(\)[\s\S]*?await requirePlatformSuperAdmin\(\)/);
  assert.match(switcher, /aria-label="Active organization oversight scope"/);
  assert.match(switcher, /Active organization · read-only oversight/);
  assert.match(switcher, /router\.push\(\`\/platform\/oversight\/\$\{encodeURIComponent\(nextId\)\}\`\)/);
  assert.match(switcher, /organizations\.some\(\(organization\) => organization\.id === nextId\)/);
  assert.match(switcher, /does not switch user sessions or grant cross-organization operational access/);
  assert.doesNotMatch(switcher, /document\.cookie|localStorage|sessionStorage|rsl_session_token/);
  assert.match(detail, /getPlatformOrganizationOversight\(id\)/);
  assert.match(detail, /OrganizationSwitcher organizations=\{organizations\} activeOrganizationId=\{org\.id\}/);
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
