import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = (path: string) => readFileSync(path, "utf8");

test("content centre is Super Admin only at page and server action boundaries", () => {
  const page = src("src/app/platform/content/page.tsx");
  const actions = src("src/app/platform/content/actions.ts");
  const navigation = src("src/components/AppShell.tsx");
  assert.match(page, /requirePlatformSuperAdmin\(\)/);
  assert.equal((actions.match(/await requirePlatformSuperAdmin\(\)/g) || []).length, 2);
  assert.match(navigation, /href: "\/platform\/content"[^\n]*superAdminOnly: true/);
});

test("published site content is not confused with drafts and has optimistic revision checking", () => {
  const helper = src("src/lib/platform-content.ts");
  const action = src("src/app/platform/content/actions.ts");
  const schema = src("src/db/schema.ts");
  const migration = src("migrations/20261017_platform_content_centre.sql");
  assert.match(helper, /publishedText: platformContent\.publishedText/);
  assert.doesNotMatch(helper.slice(helper.indexOf("export async function getPublishedPlatformContent"),helper.indexOf("export async function listPlatformContentDrafts")), /draftText: platformContent\.draftText/);
  assert.match(action, /eq\(platformContent\.revision, input\.revision\)/);
  assert.match(action, /Concurrent update detected/);
  assert.match(action, /input\.operation === "restore"/);
  assert.match(action, /logAudit/);
  assert.match(schema, /export const platformContent = pgTable/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS platform_content/);
  assert.match(src("scripts/apply-enterprise-upgrade.mjs"), /20261017_platform_content_centre\.sql/);
});

test("published copy appears across subscriber onboarding and platform access screens", () => {
  for (const page of [
    "src/app/login/page.tsx",
    "src/app/subscribe/page.tsx",
    "src/app/workspace-setup/page.tsx",
    "src/app/subscription-access/page.tsx",
  ]) {
    assert.match(src(page), /getPublishedPlatformContent/);
  }
  assert.match(src("src/app/subscribe/page.tsx"), /copy\["subscribe\.headline"\]/);
  assert.match(src("src/app/login/page.tsx"), /copy\["login\.headline"\]/);
  assert.match(src("src/app/workspace-setup/page.tsx"), /copy\["workspace\.setup_title"\]/);
});

test("subscription packages preserve subscriber entitlements and active billing snapshots", () => {
  const source = src("src/app/platform/content/actions.ts");
  const ui = src("src/app/platform/content/ContentCentreForms.tsx");
  assert.match(source, /subscriptionPlans/);
  assert.match(source, /organizationSubscriptions/);
  assert.match(source, /before\.modules\.some/);
  assert.match(source, /input\.maxUsers < before\.maxUsers/);
  assert.match(source, /input\.maxStations < before\.maxStations/);
  assert.match(source, /input\.maxVehicles < before\.maxVehicles/);
  assert.match(source, /input\.maxInspectionsPerMonth < before\.maxInspectionsPerMonth/);
  assert.match(source, /disabledFeature/);
  assert.match(source, /!input\.isActive/);
  assert.match(source, /input\.billingCycle !== before\.billingCycle/);
  assert.match(source, /input\.currency !== before\.currency/);
  assert.match(source, /logAudit/);
  assert.match(ui, /Save package/);
  assert.match(ui, /Create package/);
  assert.match(ui, /name="modules"/);
  assert.match(ui, /name="features"/);
});
