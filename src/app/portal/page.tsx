import { hasPermission } from "@/lib/auth";
import { requireAuth } from "@/lib/require-auth";
import { isTransporterPortalAdministratorRole } from "@/lib/transporter-portal-access";
import { TransporterPortalWorkspace } from "@/components/TransporterPortalWorkspace";
import { Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

// The session is authoritative. Administrators must hold transporter
// permission; a transporter_user is tied to only their own transporterId.
// A query-string transporterId is never usable to broaden a transporter login.
export default async function PortalPage({
  searchParams,
}: {
  searchParams?: Promise<{ transporterId?: string }>;
}) {
  // Missing or expired sessions must redirect to sign-in instead of throwing
  // an unhandled Server Component error and producing HTTP 500.
  const user = await requireAuth();
  const mayManagePortal =
    isTransporterPortalAdministratorRole(user.role)
    && hasPermission(user, "transporters");

  if (user.role !== "transporter_user" && !mayManagePortal) {
    return (
      <div className="p-6 lg:p-10">
        <PageHeader
          title="Transporter Portal"
          description="Accessible to linked transporter accounts and authorized Vehicle Inspection administrators."
        />
        <Card className="p-8">
          <p className="text-slate-700">
            You are signed in as <strong>{user.name}</strong>. Your role does not have
            transporter portal access in this organization.
          </p>
        </Card>
      </div>
    );
  }

  const params = searchParams ? await searchParams : {};
  return <TransporterPortalWorkspace
    user={user}
    organizationId={user.organizationId}
    requestedTransporterId={mayManagePortal ? params.transporterId : null}
  />;
}
