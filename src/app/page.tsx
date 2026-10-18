import { requireVehicleInspectionUser } from "@/lib/require-auth";
import { ExecutiveDashboardView } from "@/components/ExecutiveDashboardView";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireVehicleInspectionUser();
  return <ExecutiveDashboardView organizationId={user.organizationId} />;
}
