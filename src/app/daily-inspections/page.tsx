import { requirePermission } from "@/lib/require-auth";
import { DailyInspectionWorkspaceView } from "@/components/DailyInspectionWorkspaceView";
export const dynamic = "force-dynamic";
export default async function DailyInspectionsPage() {
 const user = await requirePermission("inspections");
 return <DailyInspectionWorkspaceView organizationId={user.organizationId} />;
}
