import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { validateSession } from "@/lib/security";
import { hasPermission } from "@/lib/auth";
import { canAccessVehicleInspection } from "@/lib/system-access";

const PRIVILEGED_2FA_ROLES = new Set(["super_admin", "admin", "operations_manager", "supervisor"]);

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

export async function requireInternalUser() {
  const user = await requireAuth();
  if (user.role === "transporter_user") redirect("/portal");
  return user;
}

export async function requireVehicleInspectionUser() {
  const user = await requireInternalUser();
  if (!canAccessVehicleInspection(user)) redirect("/driver-training");
  return user;
}

export async function requirePermission(resource: string) {
  const user = await requireVehicleInspectionUser();
  if (!hasPermission(user, resource)) redirect("/");
  return user;
}
