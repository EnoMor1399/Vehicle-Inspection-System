import { requirePermission } from "@/lib/require-auth";
import { ComplianceWorkspaceView } from "@/components/ComplianceWorkspaceView";
export const dynamic = "force-dynamic";
export default async function CompliancePage() {
 const user = await requirePermission("reports");
 return <ComplianceWorkspaceView organizationId={user.organizationId} />;
}
