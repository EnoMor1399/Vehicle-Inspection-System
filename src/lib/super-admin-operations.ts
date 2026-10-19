import "server-only";

import { cache } from "react";
import { cookies, headers } from "next/headers";
import { validateSession } from "@/lib/security";
import { getOrganizationSubscriptionState } from "@/lib/organization-access";
import { logAudit } from "@/lib/audit";
import { clientIpFromHeaders } from "@/lib/request-context";
import {
  OPERATION_COOKIE_NAME, STEP_UP_COOKIE_NAME,
  classifyScopedWrite, isAuthorizedOperationPage,
  verifyOperationsCapability,
} from "@/lib/super-admin-operations-token";

type LiveSession = Awaited<ReturnType<typeof validateSession>>;
export type ActiveSuperAdminOperations = {
  actorId: string;
  organizationId: string;
  organizationName: string;
  expiresAt: string;
  stepUpExpiresAt: string | null;
};

const requireOperationAudit = cache(async (
  organizationId: string,
  actorId: string,
  actorName: string,
  path: string,
  risk: "routine" | "high",
  ipAddress: string,
) => {
  // The chained audit intent must persist BEFORE an elevated action executes.
  // Existing entity-level create/update/delete logs provide the outcome.
  // Failure to record the intent refuses the write; never silently skip it.
  await logAudit({
    organizationId, userId: actorId, userName: actorName,
    action: "update", entityType: "super_admin_operation",
    summary: `Authorized Super Admin ${risk} operation request at ${path}`,
    after: { actorId, organizationId, path, risk, intent: true },
    ipAddress, required: true,
  });
});

export async function resolveActiveSuperAdminOperations(
  session: LiveSession,
  rawSessionToken: string,
  signedToken: string | undefined,
  stepUpToken?: string,
  supportToken?: string,
): Promise<ActiveSuperAdminOperations | null> {
  if (!signedToken) return null;
  if (supportToken) throw new Error("Exit read-only support mode before opening operations mode");
  if (!session.valid || !session.sessionId || !session.userId || !session.user
    || session.user.role !== "super_admin" || !session.user.isActive
    || !session.user.twoFactorEnabled) throw new Error("Super Admin operations authorization has expired");

  const capability = verifyOperationsCapability({
    token: signedToken, purpose: "operate", sessionToken: rawSessionToken,
    actorId: session.userId, sessionId: session.sessionId,
  });
  if (!capability) throw new Error("Super Admin operations session expired; exit and activate again");

  const entitlement = await getOrganizationSubscriptionState(capability.organizationId);
  if (!entitlement.operationalAccess || !entitlement.organization) {
    throw new Error("Selected organization is not active or its workspace is not verified");
  }
  const stepUp = stepUpToken ? verifyOperationsCapability({
    token: stepUpToken, purpose: "stepup", sessionToken: rawSessionToken,
    actorId: session.userId, sessionId: session.sessionId,
    organizationId: capability.organizationId,
  }) : null;

  return {
    actorId: session.userId,
    organizationId: capability.organizationId,
    organizationName: entitlement.organization.name,
    expiresAt: new Date(capability.expiresAt).toISOString(),
    stepUpExpiresAt: stepUp ? new Date(stepUp.expiresAt).toISOString() : null,
  };
}

// This is used in the central session resolvers, NOT the browser's selected
// organization hint. It never impersonates a subscriber principal: actor ID,
// role, and permissions are kept, with only the explicitly authenticated
// operational tenant changed for existing tenant-aware functions.
export async function operationalUserForRequest(
  session: LiveSession,
  rawSessionToken: string,
  signedToken?: string,
  stepUpToken?: string,
  supportToken?: string,
) {
  const context = await resolveActiveSuperAdminOperations(
    session, rawSessionToken, signedToken, stepUpToken, supportToken,
  );
  if (!context) return session.user!;

  const requestHeaders = await headers();
  const method = requestHeaders.get("x-vims-request-method") || "GET";
  const path = requestHeaders.get("x-vims-request-path") || "";
  if (!isAuthorizedOperationPage(path)) {
    throw new Error("Leave organization operations mode before using this administration route");
  }
  if (!["GET", "HEAD", "POST"].includes(method)) {
    throw new Error("Request method is not permitted in Super Admin operations mode");
  }
  if (method === "POST") {
    const risk = classifyScopedWrite(path);
    if (risk === "high" && !context.stepUpExpiresAt) {
      throw new Error("Confirm this sensitive action with fresh Super Admin MFA authorization");
    }
    await requireOperationAudit(
      context.organizationId, context.actorId, session.user!.name, path,
      risk, clientIpFromHeaders(requestHeaders),
    );
  }

  return { ...session.user!, organizationId: context.organizationId };
}

export async function getActiveSuperAdminOperations() {
  const jar = await cookies();
  const signedToken = jar.get(OPERATION_COOKIE_NAME)?.value;
  if (!signedToken) return null;
  const sessionToken = jar.get("rsl_session_token")?.value;
  if (!sessionToken) return null;
  const session = await validateSession(sessionToken);
  return resolveActiveSuperAdminOperations(
    session, sessionToken, signedToken,
    jar.get(STEP_UP_COOKIE_NAME)?.value,
    jar.get("vims_support_token")?.value,
  );
}
