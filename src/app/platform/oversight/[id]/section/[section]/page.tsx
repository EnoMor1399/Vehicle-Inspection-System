import { notFound } from "next/navigation";
import { getPlatformOrganizationOversight } from "@/lib/platform-oversight";
import { getCurrentUser } from "@/lib/auth";
import { TransporterPortalWorkspace } from "@/components/TransporterPortalWorkspace";
import { getPlatformOrganizationAssetInventory } from "@/lib/platform-asset-inventory";
import { isScopedSection } from "@/lib/platform-oversight-navigation";
import { listPlatformScopedModuleRecords } from "@/lib/platform-scoped-module-records";
import { ExecutiveDashboardView } from "@/components/ExecutiveDashboardView";
import { VehicleRegistryView } from "@/components/VehicleRegistryView";
import { TransportersWorkspaceView } from "@/components/TransportersWorkspaceView";
import { InspectionRegistryView } from "@/components/InspectionRegistryView";
import { DailyInspectionWorkspaceView } from "@/components/DailyInspectionWorkspaceView";
import { InspectionSchedulingView } from "@/components/InspectionSchedulingView";
import { InspectionStationsView } from "@/components/InspectionStationsView";
import { DriverTrainingWorkspaceView } from "@/components/DriverTrainingWorkspaceView";
import { ReportsWorkspaceView } from "@/components/ReportsWorkspaceView";
import { AuditWorkspaceView } from "@/components/AuditWorkspaceView";
import { ComplianceWorkspaceView } from "@/components/ComplianceWorkspaceView";
import { PredictiveMaintenanceView } from "@/components/PredictiveMaintenanceView";
import { DocumentsWorkspaceView } from "@/components/DocumentsWorkspaceView";
import { UsersWorkspaceView } from "@/components/UsersWorkspaceView";
import { ClassicScopedModuleView } from "@/components/ClassicScopedModuleView";
import { AssetInventory } from "../../AssetInventory";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// The selected organization never replaces the logged-in session tenant.
// All org-specific pages require Super Admin access and get their ID from
// the validated server route, never cookies or browser UI preferences.
export default async function SelectedOrganizationModule({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; section: string }>;
  searchParams: Promise<{ page?: string | string[]; assetPage?: string | string[]; assetSearch?: string | string[]; transporterId?: string | string[] }>;
}) {
  const [{ id, section }, query] = await Promise.all([params, searchParams]);
  if (!isScopedSection(section)) notFound();

  const overview = await getPlatformOrganizationOversight(id);
  if (!overview) notFound();
  const organizationId = overview.organization.id;

  switch (section) {
    case "vehicles": {
      const inventory = await getPlatformOrganizationAssetInventory(organizationId, {
        page: Array.isArray(query.assetPage) ? query.assetPage[0] : query.assetPage,
        search: Array.isArray(query.assetSearch) ? query.assetSearch[0] : query.assetSearch,
      });
      return (
        <>
          <VehicleRegistryView organizationId={organizationId} editable={false} readOnly />
          {inventory && (
            <div className="mx-auto max-w-[1600px] px-4 pb-8 sm:px-6 lg:px-10">
              <details className="group rounded-2xl border border-slate-200 bg-white shadow-sm">
                <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
                  Full organization asset inventory · {inventory.grandTotal.toLocaleString()} registered entries
                  <span className="ml-2 text-xs font-normal text-slate-500">Vehicles, equipment, stations and other resources · Expand ↓</span>
                </summary>
                <div className="border-t border-slate-200 p-3">
                  <AssetInventory organizationId={organizationId} inventory={inventory}
                    basePath={`/platform/oversight/${encodeURIComponent(organizationId)}/section/vehicles`} />
                </div>
              </details>
            </div>
          )}
        </>
      );
    }
    case "transporters":
      return <TransportersWorkspaceView organizationId={organizationId} editable={false} readOnly />;
    case "transporter-portal": {
      // getPlatformOrganizationOversight() above checks real Super Admin
      // authority. All portal queries below use its validated company ID,
      // never the actor's home organization or an untrusted query parameter.
      const viewer = await getCurrentUser();
      return <TransporterPortalWorkspace
        user={viewer}
        organizationId={organizationId}
        requestedTransporterId={Array.isArray(query.transporterId) ? query.transporterId[0] : query.transporterId}
        directoryHref={`/platform/oversight/${encodeURIComponent(organizationId)}/section/transporter-portal`}
        readOnlyOversight
      />;
    }
    case "inspections":
      return <InspectionRegistryView organizationId={organizationId} editable={false} readOnly />;
    case "daily-inspections":
      return <DailyInspectionWorkspaceView organizationId={organizationId} readOnly />;
    case "scheduling":
      return <InspectionSchedulingView organizationId={organizationId} canSchedule={false} />;
    case "stations":
      return <InspectionStationsView organizationId={organizationId} canManage={false} />;
    case "training":
      return <DriverTrainingWorkspaceView organizationId={organizationId} canManage={false} readOnly />;
    case "reports":
      return <ReportsWorkspaceView organizationId={organizationId} scopedOrganizationId={organizationId} />;
    case "compliance":
      return <ComplianceWorkspaceView organizationId={organizationId} scopedOrganizationId={organizationId} />;
    case "maintenance-risk":
      return <PredictiveMaintenanceView organizationId={organizationId} scopedOrganizationId={organizationId} />;
    case "users":
      return <UsersWorkspaceView organizationId={organizationId} canManage={false} canOpenTrainingUsers={false} />;
    case "documents":
      return <DocumentsWorkspaceView organizationId={organizationId} readOnly />;
    case "audit":
      return <AuditWorkspaceView organizationId={organizationId} />;
    case "rfid": {
      const kind = "rfid";
      const inventory = await getPlatformOrganizationAssetInventory(organizationId, {
        kind,
        page: Array.isArray(query.assetPage) ? query.assetPage[0] : query.assetPage,
        search: Array.isArray(query.assetSearch) ? query.assetSearch[0] : query.assetSearch,
      });
      if (!inventory) notFound();
      return <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-10">
        <PageHeader eyebrow="Vehicle Inspection" title={section === "rfid" ? "RFID Operations" : "Documents"}
          description={section === "rfid" ? "Registered RFID tags and vehicle assignments." : "Organization records and document metadata."} />
        <AssetInventory organizationId={organizationId} inventory={inventory}
          basePath={`/platform/oversight/${encodeURIComponent(organizationId)}/section/${section}`} fixedKind={kind} />
      </div>;
    }
    default: {
      const v = Array.isArray(query.page) ? query.page[0] : query.page;
      const parsed = Number(v);
      const currentPage = Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
      const records = await listPlatformScopedModuleRecords(organizationId, section, currentPage);
      if (!records) notFound();
      return <ClassicScopedModuleView organizationId={organizationId}
        organizationName={overview.organization.name} section={section} rows={records} />;
    }
  }
}
