import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const shell = readFileSync("src/components/AppShell.tsx", "utf8");
const layout = readFileSync("src/app/layout.tsx", "utf8");
const oversight = readFileSync("src/lib/platform-oversight.ts", "utf8");

test("the Super Admin organization selector lives in the sidebar branding area", () => {
  const sidebar = shell.slice(
    shell.indexOf('aria-label="Primary navigation"'),
    shell.indexOf('<nav className="flex-1 overflow-y-auto'),
  );
  const topbar = shell.slice(shell.indexOf('<header className='));

  assert.match(sidebar, /aria-label="Switch organization in the sidebar"/);
  assert.match(sidebar, /activeOversightOrganization\?\.name \?\? "VIMS Enterprise"/);
  assert.match(sidebar, /organizationChoices\.map\(\(organization\) => \(/);
  assert.match(sidebar, /Read-only oversight/);
  assert.doesNotMatch(topbar, /Select organization for read-only oversight/);
  assert.doesNotMatch(topbar, /organizationChoices\.map/);
});

test("switching a company navigates only to guarded organization oversight", () => {
  assert.match(shell, /const canSelectOrganization = isSuperAdmin && !supportContext/);
  assert.match(shell, /if \(!canSelectOrganization\) return/);
  assert.match(shell, /organizationChoices\.some\(\(organization\) => organization\.id === organizationId\)/);
  assert.match(shell, /router\.push\(\`\/platform\/oversight\/\$\{encodeURIComponent\(organizationId\)\}\`\)/);
  assert.doesNotMatch(shell, /document\.cookie\s*=|localStorage\.setItem|sessionStorage\.setItem/);
  assert.match(layout, /if \(user\.role === "super_admin"\)/);
  assert.match(layout, /organizationChoices = await listPlatformOrganizationChoices\(\)/);
  assert.match(oversight, /listPlatformOrganizationChoices\(\)[\s\S]*?await requirePlatformSuperAdmin\(\)/);
});

test("existing organization branding is unchanged for non-Super Admin users", () => {
  const sidebar = shell.slice(
    shell.indexOf('aria-label="Primary navigation"'),
    shell.indexOf('<nav className="flex-1 overflow-y-auto'),
  );
  assert.match(sidebar, /canSelectOrganization \? \(/);
  assert.match(sidebar, /src=\{branding\.logoUrl\}/);
  assert.match(sidebar, /\{branding\.companyName\}/);
  assert.match(sidebar, /\{branding\.tagline\}/);
});
