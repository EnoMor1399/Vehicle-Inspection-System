import { requirePermission } from "@/lib/require-auth";
import { PredictiveMaintenanceView } from "@/components/PredictiveMaintenanceView";
export const dynamic = "force-dynamic";
export default async function PredictiveMaintenancePage() {
 const user = await requirePermission("reports");
 return <PredictiveMaintenanceView organizationId={user.organizationId} />;
}
