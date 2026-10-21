import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  canSeeTransporterPortalNavigation,
  isTransporterPortalAdministratorRole,
} from "../src/lib/transporter-portal-access";

const read = (path: string) => readFileSync(path, "utf8");

test("Transporter Portal appears for Vehicle Inspection Admin and Super Admin only", () => {
  assert.equal(canSeeTransporterPortalNavigation("super_admin", []), true);
  assert.equal(canSeeTransporterPortalNavigation("vehicle_inspection_admin", ["transporters"]), true);
  assert.equal(canSeeTransporterPortalNavigation("admin", ["transporters"]), true);
  assert.equal(canSeeTransporterPortalNavigation("admin", []), false);
  assert.equal(canSeeTransporterPortalNavigation("vehicle_inspection_admin", []), false);
  for (const role of ["driver_training_admin", "operations_manager", "inspector", "supervisor", "data_entry", "transporter_user", "viewer", "organization_owner"]) {
    assert.equal(canSeeTransporterPortalNavigation(role, ["transporters"]), false, role);
  }
  assert.equal(isTransporterPortalAdministratorRole("super_admin"), true);
  assert.equal(isTransporterPortalAdministratorRole("vehicle_inspection_admin"), true);
  assert.equal(isTransporterPortalAdministratorRole("admin"), true);
  assert.equal(isTransporterPortalAdministratorRole("driver_training_admin"), false);
});

test("sidebar lists transporter portal beside Transporters and preserves transporter-user workspace", () => {
  const shell = read("src/components/AppShell.tsx");
  assert.match(shell, /href: "\/transporters", label: "Transporters"/);
  assert.match(shell, /href: "\/portal", label: "Transporter Portal", icon: Truck, transporterPortalAdminOnly: true/);
  assert.match(shell, /if \(item\.transporterPortalAdminOnly\)/);
  assert.match(shell, /canSeeTransporterPortalNavigation\(userRole, allowedResources\)/);
  assert.match(shell, /const TRANSPORTER_NAV_GROUPS/);
  assert.match(shell, /href: "\/portal", label: "Transporter Portal"/);
  assert.doesNotMatch(shell, /href: "\/portal", label: "Transporter Portal", icon: Truck, superAdminOnly: true/);
});

test("page checks real role plus transporter permission before giving a directory", () => {
  const page = read("src/app/portal/page.tsx");
  const view = read("src/components/TransporterPortalWorkspace.tsx");
  assert.match(page, /await getCurrentUser\(\)/);
  assert.match(page, /isTransporterPortalAdministratorRole\(user\.role\)/);
  assert.match(page, /hasPermission\(user, "transporters"\)/);
  assert.match(page, /user\.role !== "transporter_user" && !mayManagePortal/);
  assert.match(page, /requestedTransporterId=\{mayManagePortal \? params\.transporterId : null\}/);
  assert.match(view, /const transporterId = isPortalManager \? selectedTransporterId : user\.transporterId/);
  assert.match(view, /eq\(transporters\.organizationId, organizationId\)/);
  assert.match(view, /eq\(vehicles\.organizationId, organizationId\)/);
  assert.match(view, /eq\(inspections\.organizationId, organizationId\)/);
  assert.match(view, /eq\(dailyInspections\.organizationId, organizationId\)/);
  assert.match(view, /eq\(vehicles\.transporterId, matchedTransporter\.id\)/);
});

test("selected-company Super Admin portal uses real analytics scoped by authorized organization ID", () => {
  const route = read("src/app/platform/oversight/[id]/section/[section]/page.tsx");
  assert.match(route, /const overview = await getPlatformOrganizationOversight\(id\)/);
  assert.match(route, /organizationId = overview\.organization\.id/);
  assert.match(route, /case "transporter-portal"/);
  assert.match(route, /<TransporterPortalWorkspace/);
  assert.match(route, /organizationId=\{organizationId\}/);
  assert.match(route, /readOnlyOversight/);
  const view = read("src/components/TransporterPortalWorkspace.tsx");
  assert.match(view, /directoryHref.*transporterId=/);
  assert.match(view, /readOnlyOversight \?/);
});
