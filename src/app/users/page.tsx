import { requirePermission } from "@/lib/require-auth";
import { canManageUsers } from "@/lib/auth";
import { canAccessDriverTraining } from "@/lib/system-access";
import { UsersWorkspaceView } from "@/components/UsersWorkspaceView";
export const dynamic = "force-dynamic";
export default async function UsersPage({ searchParams }: { searchParams?: Promise<{ createError?: string; created?: string }> }) {
 const params = searchParams ? await searchParams : {};
 const user = await requirePermission("users");
 return <UsersWorkspaceView organizationId={user.organizationId}
   canManage={canManageUsers(user)} canOpenTrainingUsers={canAccessDriverTraining(user)}
   createError={typeof params.createError === "string" ? params.createError : ""}
   created={params.created === "1"} />;
}
