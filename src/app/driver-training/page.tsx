import { Card } from "@/components/ui";
import { ShieldCheck } from "lucide-react";
import { requireInternalUser } from "@/lib/require-auth";
import { canManageTraining, canViewTraining } from "@/lib/training-access";
import { DriverTrainingWorkspaceView } from "@/components/DriverTrainingWorkspaceView";
export const dynamic = "force-dynamic";
export default async function DriverTrainingPage() {
 const user = await requireInternalUser();
 if (!canViewTraining(user)) return <div className="p-8"><Card className="p-6"><ShieldCheck className="h-5 w-5 inline mr-2" />Driver Training access required.</Card></div>;
 return <DriverTrainingWorkspaceView organizationId={user.organizationId} canManage={canManageTraining(user)} />;
}
