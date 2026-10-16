import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { validateSession } from "@/lib/security";
import { hasPermission } from "@/lib/auth";
import { canAccessDriverTraining, canAccessVehicleInspection } from "@/lib/system-access";
import {
  getOrganizationSubscriptionState,
  organizationHasModule,
  type SubscriptionModule,
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

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId));

  if (!user || !user.isActive) redirect("/login");

  if (
    privileged2FAEnforced()
    && PRIVILEGED_2FA_ROLES.has(user.role)
    && !user.twoFactorEnabled
    && !options.allowPendingPrivileged2FA
  ) {
    redirect("/security/setup-2fa?required=1");
  }

  return user;
}

export async function requirePlatformSuperAdmin() {
  const user = await requireAuth();
  if (user.role !== "super_admin") redirect("/");
  return user;
}

export async function requireOrganizationAccountManager() {
  const user = await requireAuth();
  if (user.role !== "organization_owner" && user.role !== "super_admin") redirect("/");
  return user;
}

async function requireWorkspaceContext() {
  const user = await requireAuth();
  const organizationState = await getOrganizationSubscriptionState(user.organizationId);
  if (!organizationState.operationalAccess) redirect("/workspace-setup");
  return { user, organizationState };
}

function moduleUnavailablePath(module: SubscriptionModule) {
  return `/organization/account?notice=module&module=${encodeURIComponent(module)}`;
}

export async function requireWorkspaceUser() {
  return (await requireWorkspaceContext()).user;
}

export async function requireInternalUser() {
  const { user } = await requireWorkspaceContext();
  if (user.role === "organization_owner") redirect("/organization/account");
  if (user.role === "transporter_user") redirect("/portal");
  return user;
}

export async function requireVehicleInspectionUser() {
  const { user, organizationState } = await requireWorkspaceContext();
  if (user.role === "organization_owner") redirect("/organization/account");
  if (user.role === "transporter_user") redirect("/portal");
  if (!organizationHasModule(organizationState, "vehicle_inspection")) {
    redirect(moduleUnavailablePath("vehicle_inspection"));
  }
  if (!canAccessVehicleInspection(user)) redirect("/driver-training");
  return user;
}

export async function requireDriverTrainingUser() {
  const { user, organizationState } = await requireWorkspaceContext();
  if (user.role === "organization_owner") redirect("/organization/account");
  if (user.role === "transporter_user") redirect("/portal");
  if (!organizationHasModule(organizationState, "driver_training")) {
    redirect(moduleUnavailablePath("driver_training"));
  }
  if (!canAccessDriverTraining(user)) redirect("/");
  return user;
}

export async function requireOrganizationModule(module: SubscriptionModule) {
  const { user, organizationState } = await requireWorkspaceContext();
  if (!organizationHasModule(organizationState, module)) {
    redirect(moduleUnavailablePath(module));
  }
  return user;
}

export async function requirePermission(resource: string) {
  const user = await requireVehicleInspectionUser();
  if (!hasPermission(user, resource)) redirect("/");

  if (resource === "reports") {
    const state = await getOrganizationSubscriptionState(user.organizationId);
    if (!organizationHasModule(state, "reports")) {
      redirect(moduleUnavailablePath("reports"));
    }
  }

  return user;
}
