import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(path, "utf8");

test("platform Super Admin can inspect chosen organization account without owner impersonation", () => {
  const route = source("src/app/platform/organizations/[id]/account/page.tsx");
  const account = source("src/app/organization/account/page.tsx");
  assert.match(route, /await requirePlatformSuperAdmin\(\)/);
  assert.match(route, /isValidOrganizationId\(id\)/);
  assert.match(route, /getOrganizationAccountSnapshot\(id\)/);
  assert.match(route, /OrganizationAccountContent organizationId=\{id\} platformAdmin/);
  assert.match(account, /getOrganizationAccountSnapshot\(organizationId\)/);
  assert.match(account, /listOrganizationInvitations\(organizationId\)/);
  assert.match(account, /getOrganizationCapacitySnapshot\(organizationId\)/);
});

test("navigation selects correct company account and signed operational path remains available", () => {
  const nav = source("src/components/AppShell.tsx");
  const scope = source("src/lib/super-admin-operations-token.ts");
  assert.match(nav, /href === "\/organization\/account"/);
  assert.match(nav, /activeOversightOrganizationId/);
  assert.match(nav, /platform\/organizations\/\$\{encodeURIComponent\(activeOversightOrganizationId\)\}\/account/);
  assert.match(scope, /"\/organization\/account"/);
});

test("tenant account updates cannot use untrusted organization hints under owner session", () => {
  const actions = source("src/app/organization/account/actions.ts");
  const forms = source("src/app/organization/account/OrganizationAccountForms.tsx");
  assert.match(actions, /targetOrganizationId/);
  assert.match(actions, /await requirePlatformSuperAdmin\(\)/);
  assert.match(actions, /return \{ actor, organizationId: actor\.organizationId, isPlatform: false \}/);
  assert.match(actions, /organizationId,\s*\.\.\.parsed\.data/);
  assert.match(actions, /updateSettings\(/);
  assert.match(actions, /logAudit\(/);
  assert.match(forms, /name="targetOrganizationId"/);
});
