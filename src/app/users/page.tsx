import { requirePermission } from "@/lib/require-auth";
import { canManageUsers } from "@/lib/auth";
import { canAccessDriverTraining } from "@/lib/system-access";
import { UsersWorkspaceView } from "@/components/UsersWorkspaceView";
export const dynamic = "force-dynamic";
export default async function UsersPage() {
 const user = await requirePermission("users");
 return <UsersWorkspaceView organizationId={user.organizationId}
   canManage={canManageUsers(user)} canOpenTrainingUsers={canAccessDriverTraining(user)} />;
}
