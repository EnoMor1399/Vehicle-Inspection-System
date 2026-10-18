import { notFound } from "next/navigation";
import { getPlatformOrganizationOversight } from "@/lib/platform-oversight";
import { ExecutiveDashboardView } from "@/components/ExecutiveDashboardView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// The Super Admin uses the same Executive Dashboard as the actual tenant.
// Unlike normal dashboard sessions, this route requires platform-admin
// authorization and explicitly scopes every metric to the selected company.
export default async function SelectedOrganizationDashboard({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const oversight = await getPlatformOrganizationOversight(id);
  if (!oversight) notFound();

  return (
    <ExecutiveDashboardView
      organizationId={oversight.organization.id}
      scopedOrganizationId={oversight.organization.id}
    />
  );
}
