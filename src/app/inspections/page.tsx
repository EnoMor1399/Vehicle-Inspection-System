import { requirePermission } from "@/lib/require-auth";
import { canManageInspections } from "@/lib/auth";
import { InspectionRegistryView } from "@/components/InspectionRegistryView";
export const dynamic = "force-dynamic";
export default async function InspectionsPage() {
 const user = await requirePermission("inspections");
 return <InspectionRegistryView organizationId={user.organizationId} editable={canManageInspections(user)} />;
}
