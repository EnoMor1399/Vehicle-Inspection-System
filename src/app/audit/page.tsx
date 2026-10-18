import { requirePermission } from "@/lib/require-auth";
import { AuditWorkspaceView } from "@/components/AuditWorkspaceView";
export const dynamic = "force-dynamic";
export default async function AuditPage() {
 const user = await requirePermission("audit");
 return <AuditWorkspaceView organizationId={user.organizationId} />;
}
