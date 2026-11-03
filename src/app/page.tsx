import { cookies } from "next/headers";
import { validateSession } from "@/lib/security";
import { requireVehicleInspectionUser } from "@/lib/require-auth";
import { ExecutiveDashboardView } from "@/components/ExecutiveDashboardView";
import { VimsLandingPage } from "@/components/marketing/VimsLandingPage";
import { listSubscriptionPlans } from "@/lib/organization-control-plane";

export const dynamic = "force-dynamic";

// Signed-in operators retain the existing dashboard. Public visitors see the
// VIMS marketing homepage and active subscription packages instead of an auth error.
export default async function DashboardPage() {
  const sessionToken = (await cookies()).get("rsl_session_token")?.value;
  if (sessionToken) {
    const session = await validateSession(sessionToken);
    if (session.valid && session.user?.isActive) {
      const user = await requireVehicleInspectionUser();
      return <ExecutiveDashboardView organizationId={user.organizationId} />;
    }
  }
  const plans = await listSubscriptionPlans();
  return <VimsLandingPage plans={plans} />;
}
