import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = (path: string) => readFileSync(path, "utf8");

test("support sessions are actor-bound, time-limited, and cannot mint a target login", () => {
  const support = src("src/lib/support-session.ts");
  const actions = src("src/app/platform/account-support/support-actions.ts");
  assert.match(support, /SUPPORT_TTL_SECONDS = 15 \* 60/);
  assert.match(support, /SUPPORT_GUARD_COOKIE_SECONDS = 31 \* 24 \* 60 \* 60/);
  assert.match(support, /actorSessionId, session\.sessionId/);
  assert.match(support, /actorUserId, session\.userId/);
  assert.match(support, /supportSessions\.expiresAt/);
  assert.match(support, /supportSessions\.endedAt/);
  assert.match(support, /record\.target\.role === "super_admin"/);
  assert.match(actions, /verifyTwoFactorToken/);
  assert.match(actions, /rateLimit\("twoFactor"/);
  assert.match(actions, /getOrganizationSubscriptionState/);
  assert.match(actions, /actorSessionId: original\.sessionId/);
  assert.match(actions, /tokenHash/);
  assert.match(actions, /maxAge: SUPPORT_GUARD_COOKIE_SECONDS/);
  assert.doesNotMatch(actions, /createSession\(/);
});

test("middleware and server authorization reject support-mode writes", () => {
  const proxy = src("src/proxy.ts");
  const helper = src("src/lib/support-session.ts");
  const auth = src("src/lib/auth.ts");
  const required = src("src/lib/require-auth.ts");

  assert.match(proxy, /request\.cookies\.has\("vims_support_token"\)/);
  assert.match(proxy, /!\["GET", "HEAD"\]\.includes\(request\.method\)/);
  assert.match(proxy, /pathname === "\/api\/support-session\/end"/);
  assert.match(proxy, /"x-vims-request-method", request\.method/);
  assert.match(helper, /Support sessions are read-only/);
  assert.match(helper, /resolveSupportSession\(supportToken, session\)/);
  assert.match(auth, /effectiveUserForRequest/);
  assert.match(required, /effectiveUserForRequest/);
});

test("account support records actor, target, reason and expiry in database", () => {
  const migration = src("migrations/20261017_super_admin_support_sessions.sql");
  const runner = src("scripts/apply-enterprise-upgrade.mjs");
  assert.match(runner, /20261017_super_admin_support_sessions\.sql/);
  for (const field of ["actor_user_id", "actor_session_id", "target_user_id",
    "organization_id", "reason", "expires_at", "ended_at"]) {
    assert.ok(migration.includes(field), `Missing support field ${field}`);
  }
  const actions = src("src/app/platform/account-support/support-actions.ts");
  assert.match(actions, /actorUserId: actor\.id/);
  assert.match(actions, /targetUserId: target\.id/);
  assert.match(actions, /organizationId: target\.organizationId/);
  assert.match(actions, /finishUserSupportView/);
});

test("support view is visibly identified and has explicit same-origin exit", () => {
  const shell = src("src/components/AppShell.tsx");
  const layout = src("src/app/layout.tsx");
  const exit = src("src/app/api/support-session/end/route.ts");
  assert.match(shell, /Read-only support view:/);
  assert.match(shell, /supportContext\.actorName/);
  assert.match(shell, /supportContext\.targetName/);
  assert.match(shell, /Exit support view/);
  assert.match(layout, /getActiveSupportContext/);
  assert.match(exit, /request\.headers\.get\("origin"\)/);
  assert.match(exit, /finishUserSupportView\(\)/);
  assert.match(exit, /response\.cookies\.set/);
});

test("platform password reset requires fresh MFA and revokes sessions", () => {
  const action = src("src/app/platform/organizations/super-admin-account-recovery.ts");
  const ui = src("src/app/platform/account-support/AccountRecoveryControls.tsx");
  assert.match(action, /actor\.role !== "super_admin"/);
  assert.match(action, /verifyTwoFactorToken/);
  assert.match(action, /rateLimit\("twoFactor"/);
  assert.match(action, /target\.role === "super_admin"/);
  assert.match(action, /update\(sessions\)/);
  assert.match(ui, /superAdminResetUserPassword\(resetTarget\.id, resetCode\)/);
});

test("administrative resets mandate password rotation and persist security evidence atomically", () => {
  const schema = src("src/db/schema.ts");
  const migration = src("migrations/20261017_super_admin_support_sessions.sql");
  const reset = src("src/app/platform/organizations/super-admin-account-recovery.ts");
  const auth = src("src/lib/auth.ts");
  const requirement = src("src/lib/require-auth.ts");
  const signIn = src("src/lib/session.ts");
  const login = src("src/app/login/AuthForm.tsx");
  const action = src("src/app/security/change-password/actions.ts");
  const page = src("src/app/security/change-password/page.tsx");

  assert.match(schema, /mustChangePassword: boolean\("must_change_password"\)/);
  assert.match(migration, /ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password/);
  assert.match(reset, /mustChangePassword: true/);
  assert.match(reset, /tx\.insert\(securityEvents\)/);
  assert.match(reset, /actorUserId: actor\.id/);
  assert.match(auth, /effective\.user\.mustChangePassword/);
  assert.match(requirement, /redirect\("\/security\/change-password"\)/);
  assert.match(signIn, /passwordChangeRequired: Boolean\(result\.user\.mustChangePassword\)/);
  assert.match(login, /res\.passwordChangeRequired/);
  assert.match(action, /verifyPassword\(input\.currentPassword, fresh\.passwordHash\)/);
  assert.match(action, /mustChangePassword: false/);
  assert.match(action, /update\(sessions\)/);
  assert.match(action, /ne\(sessions\.id, session\.sessionId/);
  assert.match(page, /ChangePasswordForm/);
  assert.doesNotMatch(reset, /twoFactorEnabled: false/);
});
