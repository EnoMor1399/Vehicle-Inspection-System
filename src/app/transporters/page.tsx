import { requirePermission } from "@/lib/require-auth";
import { canEditTransporters } from "@/lib/auth";
import { TransportersWorkspaceView } from "@/components/TransportersWorkspaceView";
export const dynamic = "force-dynamic";
export default async function TransportersPage() {
 const user = await requirePermission("transporters");
 return <TransportersWorkspaceView organizationId={user.organizationId} editable={canEditTransporters(user)} />;
}
