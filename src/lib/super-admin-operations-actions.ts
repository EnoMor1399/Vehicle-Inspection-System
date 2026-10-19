import "server-only";

import { cookies, headers } from "next/headers";
import { validateSession, verifyTwoFactorToken } from "@/lib/security";
import { decryptField } from "@/lib/field-encryption";
import { getOrganizationSubscriptionState } from "@/lib/organization-access";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { clientIpFromHeaders } from "@/lib/request-context";
import {
  mintOperationsCapability, verifyOperationsCapability,
  OPERATION_COOKIE_NAME, STEP_UP_COOKIE_NAME,
  OPERATION_TTL_SECONDS, STEP_UP_TTL_SECONDS,
} from "@/lib/super-admin-operations-token";
import { isValidOrganizationId } from "@/lib/organization-id";

async function actorSession() {
  const jar = await cookies();
  if (jar.has("vims_support_token")) {
    throw new Error("Exit read-only support mode first");
  }
  const loginToken = jar.get("rsl_session_token")?.value;
  if (!loginToken) throw new Error("Sign in again to continue");
  const session = await validateSession(loginToken);
  const user = session.user;
  if (!session.valid || !session.sessionId || !session.userId || !user
    || user.role !== "super_admin" || !user.isActive
    || !user.twoFactorEnabled || !user.twoFactorSecret || user.mustChangePassword) {
    throw new Error("An active Super Administrator with MFA is required");
  }
  return { session, user, loginToken, jar };
}

async function verifyFreshMFA(
  actor: Awaited<ReturnType<typeof actorSession>>,
  code: string,
) {
  if (typeof code !== "string" || !/^\d{6,8}$/.test(code.trim())) {
    throw new Error("Enter a valid authenticator code");
  }
  const ip = clientIpFromHeaders(await headers());
  const attempt = await rateLimit("twoFactor", `operations:${actor.user.id}:${ip}`);
  if (!attempt.allowed) throw new Error("Too many verification attempts. Try again later");
  const valid = await verifyTwoFactorToken(
    decryptField(actor.user.twoFactorSecret!), code.trim(),
  );
  if (!valid) throw new Error("The authenticator code was not accepted");
}

async function targetOrganization(organizationId: string) {
  if (!isValidOrganizationId(organizationId)) throw new Error("Invalid organization ID");
  const state = await getOrganizationSubscriptionState(organizationId);
  if (!state.operationalAccess || !state.organization) {
    throw new Error("This subscriber's workspace is not operational and verified");
  }
  return state.organization;
}

export async function beginSuperAdminOperations(input: {
  organizationId: string;
  reason: string;
  authenticationCode: string;
  confirmation: string;
}) {
  const actor = await actorSession();
  if (actor.jar.has(OPERATION_COOKIE_NAME)) {
    throw new Error("Exit the current operations session before starting another");
  }
  const organization = await targetOrganization(input.organizationId);
  const reason = typeof input.reason === "string"
    ? input.reason.trim().replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 500) : "";
  if (reason.length < 12) throw new Error("Provide an operations reason of at least 12 characters");
  if (input.confirmation?.trim() !== `OPERATE ${organization.name}`) {
    throw new Error("Type the requested organization confirmation exactly");
  }
  await verifyFreshMFA(actor, input.authenticationCode);

  const requestHeaders = await headers();
  // Record authorization BEFORE issuing a capability. Never enable
  // cross-organization writes when the hash-chained audit is unavailable.
  await logAudit({
    organizationId: organization.id,
    userId: actor.user.id, userName: actor.user.name,
    action: "login", entityType: "super_admin_operation",
    summary: "Super Admin entered time-limited cross-organization operations mode",
    after: {
      actorId: actor.user.id, organizationId: organization.id, reason,
      expiresInSeconds: OPERATION_TTL_SECONDS,
    },
    ipAddress: clientIpFromHeaders(requestHeaders),
    required: true,
  });

  const token = mintOperationsCapability({
    purpose: "operate", actorId: actor.user.id,
    sessionId: actor.session.sessionId!, organizationId: organization.id,
    sessionToken: actor.loginToken,
  });
  actor.jar.set(OPERATION_COOKIE_NAME, token, {
    path: "/", httpOnly: true, sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    // Keep the signed marker after its embedded 15-min expiration so stale
    // workspaces FAIL CLOSED rather than silently writing into the login tenant.
    maxAge: 31 * 24 * 60 * 60,
  });
  actor.jar.set(STEP_UP_COOKIE_NAME, "", {
    path: "/", maxAge: 0, httpOnly: true, sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
  return { ok: true, destination: "/", organizationName: organization.name };
}

export async function authorizeSensitiveSuperAdminActions(input: {
  authenticationCode: string;
  confirmation: string;
}) {
  const actor = await actorSession();
  const signedToken = actor.jar.get(OPERATION_COOKIE_NAME)?.value || "";
  const active = verifyOperationsCapability({
    token: signedToken, purpose: "operate",
    actorId: actor.user.id, sessionId: actor.session.sessionId!,
    sessionToken: actor.loginToken,
  });
  if (!active) throw new Error("Your operations session has expired");
  const organization = await targetOrganization(active.organizationId);
  if (input.confirmation?.trim() !== `AUTHORIZE ${organization.name}`) {
    throw new Error("Type the sensitive-action confirmation exactly");
  }
  await verifyFreshMFA(actor, input.authenticationCode);

  await logAudit({
    organizationId: organization.id,
    userId: actor.user.id, userName: actor.user.name,
    action: "approve", entityType: "super_admin_operation",
    summary: "Super Admin approved high-risk operations with fresh MFA",
    after: { actorId: actor.user.id, organizationId: organization.id, expiresInSeconds: STEP_UP_TTL_SECONDS },
    ipAddress: clientIpFromHeaders(await headers()),
    required: true,
  });

  const token = mintOperationsCapability({
    purpose: "stepup", actorId: actor.user.id,
    sessionId: actor.session.sessionId!, organizationId: organization.id,
    sessionToken: actor.loginToken,
  });
  actor.jar.set(STEP_UP_COOKIE_NAME, token, {
    path: "/", httpOnly: true, sameSite: "strict",
    secure: process.env.NODE_ENV === "production", maxAge: STEP_UP_TTL_SECONDS,
  });
  return { ok: true, expiresInSeconds: STEP_UP_TTL_SECONDS };
}

export async function endSuperAdminOperations() {
  const jar = await cookies();
  const rawCapability = jar.get(OPERATION_COOKIE_NAME)?.value;
  const loginToken = jar.get("rsl_session_token")?.value;
  let targetOrganizationId: string | null = null;

  try {
    if (loginToken && rawCapability) {
      const session = await validateSession(loginToken);
      if (session.valid && session.sessionId && session.userId && session.user?.role === "super_admin") {
        const token = verifyOperationsCapability({
          token: rawCapability, purpose: "operate",
          actorId: session.userId, sessionId: session.sessionId,
          sessionToken: loginToken,
        });
        if (token) targetOrganizationId = token.organizationId;
        if (targetOrganizationId) await logAudit({
          organizationId: targetOrganizationId,
          userId: session.userId, userName: session.user.name,
          action: "logout", entityType: "super_admin_operation",
          summary: "Super Admin exited cross-organization operations mode",
          after: { actorId: session.userId, organizationId: targetOrganizationId },
          ipAddress: clientIpFromHeaders(await headers()), required: true,
        });
      }
    }
  } finally {
    // Always let an administrator escape an expired/corrupt mode.
    for (const name of [OPERATION_COOKIE_NAME, STEP_UP_COOKIE_NAME]) {
      jar.set(name, "", {
        path: "/", maxAge: 0, httpOnly: true, sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
      });
    }
  }
  return { ok: true, destination: targetOrganizationId
    ? `/platform/oversight/${encodeURIComponent(targetOrganizationId)}` : "/platform/oversight" };
}
