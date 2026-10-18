import { requirePermission } from "@/lib/require-auth";
import { DocumentsWorkspaceView } from "@/components/DocumentsWorkspaceView";
export const dynamic = "force-dynamic";
export default async function DocumentsPage() {
 const user = await requirePermission("documents");
 return <DocumentsWorkspaceView organizationId={user.organizationId} />;
}
