import { requirePermission } from "@/lib/require-auth";
import { canEditVehicles } from "@/lib/auth";
import { VehicleRegistryView } from "@/components/VehicleRegistryView";
export const dynamic = "force-dynamic";
export default async function VehiclesPage() {
 const user = await requirePermission("vehicles");
 return <VehicleRegistryView organizationId={user.organizationId} editable={canEditVehicles(user)} />;
}
