import { requirePermission } from "@/lib/require-auth";
import { canManageInspections } from "@/lib/auth";
import { InspectionSchedulingView } from "@/components/InspectionSchedulingView";
export const dynamic = "force-dynamic";
export default async function SchedulePage() {
  const user = await requirePermission("inspections");
  return <InspectionSchedulingView organizationId={user.organizationId} canSchedule={canManageInspections(user)} />;
}
