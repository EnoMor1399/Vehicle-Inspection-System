import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = (path: string) => readFileSync(path, "utf8");

test("workspace preflight shows owner and plan-specific administrator requirements", () => {
  const control = src("src/lib/organization-control-plane.ts");
  const page = src("src/app/platform/organizations/[id]/page.tsx");
  const ui = src("src/app/platform/organizations/[id]/ActivationReadinessControls.tsx");

  assert.match(control, /getOrganizationActivationReadiness/);
  assert.match(control, /eq\(users\.organizationId, organizationId\)/);
  assert.match(control, /activeCount\("organization_owner"\)/);
  assert.match(control, /activeCount\("vehicle_inspection_admin"\)/);
  assert.match(control, /activeCount\("driver_training_admin"\)/);
  assert.match(control, /periodAllowsAccess\(subscription\.subscription\)/);
  assert.match(page, /getOrganizationActivationReadiness\(id\)/);
  assert.match(page, /<ActivationReadinessControls/);
  assert.match(ui, /disabled=\{activating \|\| !readiness\.canAttemptActivation\}/);
  assert.match(ui, /Activation requirements/);
  assert.match(ui, /ownerInvitationStatus/);
});

test("subscriber workspace activation errors are inline, and never bypass tenant verification", () => {
  const actions = src("src/app/platform/organizations/actions.ts");
  const control = src("src/lib/organization-control-plane.ts");

  assert.match(actions, /useActionState|PlatformOrganizationActionState/);
  assert.match(actions, /activateSubscriberWorkspace\([\s\S]*_previous: PlatformOrganizationActionState/);
  assert.match(actions, /catch \(error\)[\s\S]*Unable to activate the subscriber workspace/);
  assert.match(control, /Activate an Organization Owner account before enabling operations/);
  assert.match(control, /Create a Vehicle Inspection Administrator before enabling Vehicle Inspection/);
  assert.match(control, /verifyTenantDataPlaneReadiness\(\)/);
  assert.match(control, /operationalAccessEnabled: true/);
});

test("owner invitation reissue never mints or elevates a user account", () => {
  const actions = src("src/app/platform/organizations/actions.ts");
  const control = src("src/lib/organization-control-plane.ts");
  const ui = src("src/app/platform/organizations/[id]/ActivationReadinessControls.tsx");

  assert.match(actions, /requirePlatformSuperAdmin\(\)/);
  assert.match(actions, /reissueSubscriberOwnerInvitation/);
  assert.match(control, /pg_advisory_xact_lock\(hashtext/);
  assert.match(control, /reissueOrganizationOwnerInvitation/);
  assert.match(control, /eq\(users\.role, "organization_owner"\)/);
  assert.match(control, /existingUser/);
  assert.match(control, /subscription\.row\.seats/);
  assert.match(control, /tx\.update\(organizationInvitations\)\.set\(\{ revokedAt: new Date\(\) \}\)/);
  assert.match(control, /tx\.insert\(organizationInvitations\)\.values/);
  assert.match(control, /role: "organization_owner"/);
  const reissueCode = control.slice(
    control.indexOf("export async function reissueOrganizationOwnerInvitation"),
    control.indexOf("export async function activateOrganizationWorkspace"),
  );
  assert.doesNotMatch(reissueCode, /tx\.insert\(users\)|tx\.update\(users\)/);
  assert.match(ui, /Reissue one-time owner invitation/);
  assert.match(ui, /Copy owner invitation link/);
});

test("VIMS invitations use configured SMTP and distinguish acceptance from delivery", () => {
  const mail = src("src/lib/invitation-mail.ts");
  const platform = src("src/app/platform/organizations/actions.ts");
  const organization = src("src/app/organization/account/actions.ts");
  const account = src("src/app/platform/organizations/[id]/ActivationReadinessControls.tsx");
  assert.match(mail, /process\.env\.SMTP_HOST/);
  assert.match(mail, /process\.env\.SMTP_PORT/);
  assert.match(mail, /process\.env\.SMTP_USER/);
  assert.match(mail, /process\.env\.SMTP_PASSWORD/);
  assert.match(mail, /process\.env\.SMTP_FROM/);
  assert.match(mail, /process\.env\.NEXT_PUBLIC_APP_URL/);
  assert.match(mail, /requireTLS: smtpPort !== 465/);
  assert.match(mail, /info\.accepted\.some/);
  assert.match(mail, /inbox delivery is not yet confirmed/);
  assert.match(platform, /await sendWorkspaceInvitationEmail/);
  assert.match(organization, /await sendWorkspaceInvitationEmail/);
  assert.match(account, /ownerInvitationEmailInUse/);
  assert.match(account, /name="email"/);
});

test("the owner replacement email must be unregistered and reissue remains audited", () => {
  const source = src("src/lib/organization-control-plane.ts");
  const action = src("src/app/platform/organizations/actions.ts");
  assert.match(source, /ownerInvitationEmailInUse/);
  assert.match(source, /input\.email\?\.trim\(\)\.toLowerCase\(\) \|\| priorInvite\.email/);
  assert.match(source, /where\(eq\(users\.email, email\)\)/);
  assert.match(source, /This email is already registered in VIMS/);
  assert.match(action, /smtpAccepted: delivery\.accepted/);
  assert.match(action, /recipient: result\.recipientEmail/);
});
