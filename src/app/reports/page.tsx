import { Card } from "@/components/ui";
import { canViewReports } from "@/lib/auth";
import { requireInternalUser } from "@/lib/require-auth";
import { ReportsWorkspaceView } from "@/components/ReportsWorkspaceView";

export const dynamic = "force-dynamic";
export default async function ReportsPage() {
  const user = await requireInternalUser();
  if (!canViewReports(user)) {
    return <div className="p-10"><Card className="p-8"><p className="text-slate-700">You do not have permission to view reports.</p></Card></div>;
  }
  return <ReportsWorkspaceView organizationId={user.organizationId} />;
}
