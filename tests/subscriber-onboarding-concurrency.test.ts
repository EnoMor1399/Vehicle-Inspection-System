import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/lib/organization-control-plane.ts", "utf8");

function section(start: string, end: string) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Missing function boundaries: ${start}`);
  return source.slice(a, b);
}

test("subscriber approval is serialized and status rechecked in the transaction", () => {
  const approve = section("export async function convertOnboardingRequest(", "export async function createOrganizationAdministratorInvitation(");
  assert.match(approve, /pg_advisory_xact_lock\(hashtext\(\$\{input.requestId\}\)\)/);
  assert.match(approve, /currentRequest/);
  assert.match(approve, /\["pending", "reviewing", "approved"\]/);
  assert.ok(approve.indexOf("currentRequest") < approve.indexOf("tx.insert(organizations)"));
  assert.match(approve, /status: "converted"/);
});

test("administrator invitations serialize seat reservation and block repeat emails", () => {
  const invite = section("export async function createOrganizationAdministratorInvitation(", "export async function getInvitationByToken(");
  assert.match(invite, /await db.transaction\(async \(tx\) =>/);
  assert.match(invite, /pg_advisory_xact_lock\(hashtext\(\$\{input.organizationId\}\)\)/);
  assert.match(invite, /existingUsers/);
  assert.match(invite, /outstanding/);
  assert.match(invite, /sameEmailInvitation/);
  assert.match(invite, /gt\(organizationInvitations.expiresAt, new Date\(\)\)/);
  assert.match(invite, /subscription user limit has been reached/);
  assert.match(invite, /requiredModule/);
  assert.match(invite, /tokenHash: invitationHash\(token\)/);
});

test("claiming an invitation rechecks current role, org and plan under a transaction lock", () => {
  const accept = section("export async function acceptOrganizationInvitation(", "export async function listOrganizationInvitations(");
  assert.match(accept, /pg_advisory_xact_lock\(hashtext\(\$\{row.invitation.organizationId\}\)\)/);
  assert.match(accept, /fresh/);
  assert.match(accept, /fresh.expired/);
  assert.match(accept, /invitation.revokedAt/);
  assert.match(accept, /organization.status === "suspended"/);
  assert.match(accept, /entitlement.plan.modules.includes\("driver_training"\)/);
  assert.match(accept, /entitlement.plan.modules.includes\("vehicle_inspection"\)/);
  assert.match(accept, /const \[claimed\] = await tx/);
  assert.match(accept, /isNull\(organizationInvitations.acceptedAt\)/);
  assert.match(accept, /isNull\(organizationInvitations.revokedAt\)/);
  assert.match(accept, /if \(!claimed\)/);
  assert.ok(accept.indexOf("if (!claimed)") < accept.indexOf("tx.insert(users)"));
});

test("dashboard counts only invitations that have not expired", () => {
  const account = section("export async function getOrganizationAccountSnapshot(", "export async function createOnboardingRequest(");
  assert.match(account, /gt\(organizationInvitations.expiresAt, new Date\(\)\)/);
});
