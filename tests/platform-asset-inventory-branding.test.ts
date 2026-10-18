import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const inventory = readFileSync("src/lib/platform-asset-inventory.ts", "utf8");
const view = readFileSync("src/app/platform/oversight/[id]/AssetInventory.tsx", "utf8");
const detail = readFileSync("src/app/platform/oversight/[id]/section/[section]/page.tsx", "utf8");

test("asset inventory is Super Admin only, fail-closed and tenant-scoped in every branch", () => {
  assert.match(inventory, /await requirePlatformSuperAdmin\(\)/);
  assert.match(inventory, /where\(eq\(organizations\.id, organizationId\)\)/);
  assert.match(inventory, /if \(!org\) return null/);
  for (const table of ["vehicles v", "locations l", "rfid_tags r",
    "transporters t", "documents d", "training_sessions s"]) {
    assert.ok(inventory.includes(`FROM ${table}`), `Missing scoped asset source ${table}`);
  }
  // Locations appear twice to preserve one predicate for stations and one
  // for their listed equipment. No branch may use a global table scan.
  const scopes = inventory.match(/WHERE [a-z]\.organization_id = \$\{organizationId\}/g) || [];
  assert.equal(scopes.length, 7);
  assert.doesNotMatch(inventory, /db\.insert\(|db\.update\(|db\.delete\(|\.execute\(sql`\s*(?:INSERT|UPDATE|DELETE)/i);
});

test("complete asset inventory exposes precise metadata with stable pagination", () => {
  for (const category of ["vehicle", "station", "equipment", "rfid", "transporter", "document", "training"]) {
    assert.match(inventory, new RegExp(`"${category}"`));
  }
  assert.match(inventory, /ASSET_PAGE_SIZE = 50/);
  assert.match(inventory, /ORDER BY assets\.kind ASC, assets\.name ASC, assets\.id ASC/);
  assert.match(inventory, /LIMIT \$\{ASSET_PAGE_SIZE\} OFFSET \$\{offset\}/);
  assert.match(inventory, /POSITION\(/);
  assert.match(view, /Organization asset and resource inventory/);
  assert.match(view, /Asset \/ resource name/);
  assert.match(view, /asset\.identifier/);
  assert.match(view, /asset\.alternateIdentifier/);
  assert.match(view, /asset\.status/);
  assert.match(view, /asset\.assetType/);
  assert.match(view, /Page \{inventory\.page\} of \{inventory\.totalPages\}/);
  assert.match(detail, /getPlatformOrganizationAssetInventory\(organizationId/);
  assert.match(detail, /<AssetInventory organizationId=\{organizationId\} inventory=\{inventory\}/);
});

test("install metadata and icons use tenant-neutral VIMS application identity", () => {
  const manifest = JSON.parse(readFileSync("public/manifest.json", "utf8"));
  const layout = readFileSync("src/app/layout.tsx", "utf8");
  const icon = readFileSync("src/app/pwa/icon/[size]/route.tsx", "utf8");
  const sw = readFileSync("public/sw.js", "utf8");
  const installer = readFileSync("src/components/PWAInstallCentre.tsx", "utf8");
  assert.equal(manifest.name, "Vehicle Inspection Management System");
  assert.equal(manifest.short_name, "VIMS");
  assert.equal(manifest.id, "/");
  assert.match(layout, /title: "Vehicle Inspection Management System"/);
  assert.match(layout, /title: "VIMS"/);
  assert.match(icon, />\s*VIMS\s*<\/div>/);
  assert.doesNotMatch(icon, />\s*RSL\s*<\/div>/);
  assert.match(sw, /vims-v5-static/);
  assert.match(sw, /manifest\.json\?v=5/);
  assert.match(installer, /Confirm the name “VIMS”/);
  assert.doesNotMatch(installer, /Confirm the name “RSL VIMS”/);
});
