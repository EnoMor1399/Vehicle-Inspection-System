import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { validateSession } from "@/lib/security";
import { hasPermission } from "@/lib/auth";
import { canAccessDriverTraining, canAccessVehicleInspection } from "@/lib/system-access";
import {
  getOrganizationSubscriptionState,
  hasOrganizationModule,
  type OrganizationModule,
} from "@/lib/organization-access";

const PRIVILEGED_2FA_ROLES = new Set([
  "super_admin",
  "organization_owner",
  "vehicle_inspection_admin",
  "driver_training_admin",
  "admin",
  "operations_manager",
  "supervisor",
]);

type RequireAuthOptions = {
  allowPendingPrivileged2FA?: boolean;
};

function privileged2FAEnforced() {
  return process.env.NODE_ENV === "production"
    && process.env.PRIVILEGED_2FA_ENFORCEMENT?.trim().toLowerCase() !== "off";
}

// Protect server-rendered pages with the same revocable session used by login.
// Production privileged accounts must complete TOTP enrollment before entering
// operational workspaces. Password authentication still succeeds so an
// unenrolled administrator can reach the enrollment screen instead of being
// locked out.
export async function requireAuth(options: RequireAuthOptions = {}) {
  const jar = await cookies();
  const sessionToken = jar.get("rsl_session_token")?.value;
  if (!sessionToken) redirect("/login");

  const session = await validateSession(sessionToken);
  if (!session.valid || !session.userId) redirect("/login");

  const { effectiveUserForRequest, SUPPORT_COOKIE_NAME } = await import("@/lib/support-session");
  const effective = await effectiveUserForRequest(session, jar.get(SUPPORT_COOKIE_NAME)?.value);
  const user = effective.user;
  if (!user.isActive) redirect("/login");
  if (user.mustChangePassword && !effective.support) redirect("/security/change-password");

  if (
    privileged2FAEnforced()
    && !effective.support
    && PRIVILEGED_2FA_ROLES.has(user.role)
    && !user.twoFactorEnabled
    && !options.allowPendingPrivileged2FA
  ) {
    redirect("/security/setup-2fa?required=1");
  }

  const scopeCookie = jar.get("vims_superadmin_operations")?.value;
  if (scopeCookie) {
    const { operationalUserForRequest } = await import("@/lib/super-admin-operations");
    try {
      return await operationalUserForRequest(
        session, sessionToken, scopeCookie,
        jar.get("vims_superadmin_stepup")?.value,
        jar.get("vims_support_token")?.value,
      );
    } catch (error) {
      const requestHeaders = await headers();
      if (requestHeaders.get("x-vims-request-method") === "GET"
        && requestHeaders.get("x-vims-request-path") !== "/platform/operations-expired") {
        redirect("/platform/operations-expired");
      }
      throw error;
    }
  }
  return user;
}

export async function requirePlatformSuperAdmin() {
  // The control plane must never borrow an operational tenant grant. Even a
  // valid 15-minute organization capability cannot authorize platform-wide
  // changes, regardless of which page a Server Action POST originated from.
  if ((await cookies()).has("vims_superadmin_operations")) {
    throw new Error("Exit scoped company operations before platform administration");
  }
  const user = await requireAuth();
  if (user.role !== "super_admin") redirect("/");
  return user;
}

export async function requireOrganizationAccountManager() {
  const user = await requireAuth();
  if (user.role !== "organization_owner" && user.role !== "super_admin") redirect("/");
  return user;
}

export async function requireWorkspaceUser() {
  const user = await requireAuth();
  const organizationState = await getOrganizationSubscriptionState(user.organizationId);
  if (!organizationState.operationalAccess) redirect("/workspace-setup");
  return user;
}

export async function requireInternalUser() {
  const user = await requireWorkspaceUser();
  if (user.role === "organization_owner") redirect("/organization/account");
  if (user.role === "transporter_user") redirect("/portal");
  return user;
}

async function requireOrganizationModuleForUser(
  user: Awaited<ReturnType<typeof requireAuth>>,
  module: OrganizationModule,
) {
  const organizationState = await getOrganizationSubscriptionState(user.organizationId);
  if (!hasOrganizationModule(organizationState, module)) {
    redirect(`/subscription-access?module=${module}`);
  }
  return organizationState;
}

export async function requireVehicleInspectionUser() {
  const user = await requireInternalUser();
  await requireOrganizationModuleForUser(user, "vehicle_inspection");
  if (!canAccessVehicleInspection(user)) redirect("/driver-training");
  return user;
}

export async function requireDriverTrainingUser() {
  const user = await requireInternalUser();
  await requireOrganizationModuleForUser(user, "driver_training");
  if (!canAccessDriverTraining(user)) redirect("/");
  return user;
}

export async function requireOrganizationModule(module: OrganizationModule) {
  const user = await requireInternalUser();
  await requireOrganizationModuleForUser(user, module);
  return user;
}

export async function requirePermission(resource: string) {
  const user = await requireVehicleInspectionUser();
  if (resource === "reports") {
    await requireOrganizationModuleForUser(user, "reports");
  }
  if (!hasPermission(user, resource)) redirect("/");
  return user;
}
