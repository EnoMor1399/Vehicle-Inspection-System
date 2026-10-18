import { requirePermission } from "@/lib/require-auth";
import { canManageLocations } from "@/lib/auth";
import { InspectionStationsView } from "@/components/InspectionStationsView";
export const dynamic = "force-dynamic";
export default async function LocationsPage() {
 const user = await requirePermission("locations");
 return <InspectionStationsView organizationId={user.organizationId} canManage={canManageLocations(user)} />;
}
