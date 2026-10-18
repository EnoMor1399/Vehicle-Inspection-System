import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Building2, ShieldCheck } from "lucide-react";
import { Badge, Card, PageHeader } from "@/components/ui";
import { getPlatformOrganizationOversight } from "@/lib/platform-oversight";
import { getPlatformOrganizationAssetInventory } from "@/lib/platform-asset-inventory";
import { SCOPED_SECTION_DETAILS, isScopedSection, type ScopedSection } from "@/lib/platform-oversight-navigation";
import { listPlatformScopedModuleRecords, SCOPED_MODULE_PAGE_SIZE } from "@/lib/platform-scoped-module-records";
import { AssetInventory } from "../../AssetInventory";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MODULE_NOTES: Partial<Record<ScopedSection, string>> = {
  compliance: "Shows inspections with failed, conditional, or reinspection-required outcomes. Full certification and expiry checks remain in each organization's authorized operational workspace.",
  "maintenance-risk": "Inspection outcome indicators only. This is not a predictive maintenance score and does not replace a maintenance assessment.",
  powerbi: "The organization-scoped reporting summary is safe to view here. Power BI exports and API credentials remain controlled by the actual organization's permissions; they are not automatically switched into this overview.",
  "import-export": "This is a read-only history. Cross-organization importing, exports, and rollback are not enabled by switching the Super Admin's oversight scope.",
  settings: "Platform company settings may be managed using the protected subscriber controls. This view does not edit a tenant's operational settings.",
  notifications: "Only company security events are shown. Personal user notifications are private; system-wide notices are managed separately.",
  "transporter-portal": "Transporter records only; viewing a company does not sign you into a transporter account.",
};

function scopedPageHref(id: string, section: ScopedSection, page: number) {
  return `/platform/oversight/${encodeURIComponent(id)}/section/${section}${page > 1 ? `?page=${page}` : ""}`;
}

export default async function ScopedOrganizationModulePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; section: string }>;
  searchParams: Promise<{ page?: string | string[]; assetPage?: string | string[]; assetSearch?: string | string[] }>;
}) {
  const [{ id, section }, query] = await Promise.all([params, searchParams]);
  if (!isScopedSection(section)) notFound();
  const config = SCOPED_SECTION_DETAILS[section];
  const one = (v?: string | string[]) => Array.isArray(v) ? v[0] : v;
  const parsed = Number(one(query.page));
  const requestedPage = Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
  const [overview, inventory, log] = await Promise.all([
    getPlatformOrganizationOversight(id),
    config.inventoryKind ? getPlatformOrganizationAssetInventory(id, {
      kind: config.inventoryKind,
      page: one(query.assetPage),
      search: one(query.assetSearch),
    }) : Promise.resolve(null),
    listPlatformScopedModuleRecords(id, section, requestedPage),
  ]);
  if (!overview || !log || (config.inventoryKind && !inventory)) notFound();

  const { organization: org, counts } = overview;
  const metricItems = [
    ["Vehicles", counts.vehicles],
    ["Inspections", counts.inspections],
    ["Stations", counts.stations],
    ["Transporters", counts.transporters],
    ["Training", counts.trainingSessions],
    ["Documents", counts.documents],
    ["Users", counts.users],
  ] as const;

  return (
    <main className="mx-auto max-w-[1600px] space-y-5 p-4 sm:p-6 lg:p-10">
      <Link href={`/platform/oversight/${encodeURIComponent(org.id)}`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950">
        <ArrowLeft className="h-4 w-4" /> Organization overview
      </Link>

      <div role="status" className="flex flex-wrap items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-950">
        <Building2 className="h-4 w-4" />
        <strong>{org.name}</strong>
        <Badge tone="slate">Scoped · read-only</Badge>
        <span className="text-xs text-indigo-800">All data below is filtered to this organization&apos;s ID; platform administration is separate.</span>
      </div>

      <PageHeader
        eyebrow={`Super Administrator · ${org.name}`}
        title={config.title}
        description={config.description}
      />

      {["reports", "powerbi", "settings", "compliance", "maintenance-risk"].includes(section) && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {metricItems.map(([label, total]) => (
            <Card key={label} className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-950">{total.toLocaleString()}</p>
            </Card>
          ))}
        </div>
      )}

      {inventory ? (
        <>
          {section === "stations" && (
            <Link
              href={`/platform/oversight/${encodeURIComponent(org.id)}?assetType=equipment#organization-inventory`}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-emerald-600"
            >View equipment recorded at this organization&apos;s stations <ArrowRight className="h-4 w-4" /></Link>
          )}
          <AssetInventory
            organizationId={org.id}
            inventory={inventory}
            basePath={`/platform/oversight/${encodeURIComponent(org.id)}/section/${section}`}
            fixedKind={config.inventoryKind}
          />
        </>
      ) : log.records.length > 0 || log.total > 0 ? (
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-950">{config.title} · organization records</h2>
            <span className="text-xs font-semibold text-slate-600">{log.total.toLocaleString()} records</span>
          </div>
          <p className="mb-4 mt-1 text-xs text-slate-500">
            Showing up to {SCOPED_MODULE_PAGE_SIZE} entries per page. All records remain in the selected tenant.
          </p>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[800px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
                <tr>
                  <th scope="col" className="p-3">Record</th>
                  <th scope="col" className="p-3">Identification</th>
                  <th scope="col" className="p-3">Type</th>
                  <th scope="col" className="p-3">Status</th>
                  <th scope="col" className="p-3">Details</th>
                  <th scope="col" className="p-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {log.records.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100 align-top">
                    <td className="p-3 font-semibold text-slate-900">{item.name}</td>
                    <td className="break-all p-3 font-mono text-xs text-slate-600">{item.reference}</td>
                    <td className="p-3 text-slate-700">{item.type}</td>
                    <td className="p-3"><Badge tone={["active", "passed", "completed", "resolved"].includes(item.status.toLowerCase()) ? "emerald" : "amber"}>{item.status}</Badge></td>
                    <td className="p-3 text-slate-600">{item.detail}</td>
                    <td className="p-3 text-slate-600">{item.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 text-sm">
            {log.page > 1 ? (
              <Link href={scopedPageHref(org.id, section, log.page - 1)} className="rounded-xl border border-slate-300 px-3 py-2 font-semibold text-slate-700">Previous</Link>
            ) : <span />}
            <span className="text-xs font-semibold text-slate-600">Page {log.page} of {log.totalPages}</span>
            {log.page < log.totalPages ? (
              <Link href={scopedPageHref(org.id, section, log.page + 1)} className="rounded-xl border border-slate-300 px-3 py-2 font-semibold text-slate-700">Next</Link>
            ) : <span />}
          </div>
        </Card>
      ) : (
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-slate-950">{config.title} · current overview</h2>
          <p className="mt-2 text-sm text-slate-600">
            {["reports", "powerbi", "settings"].includes(section)
              ? "The organization-specific figures above are available for oversight."
              : "There are no matching registered records for this organization."}
          </p>
        </Card>
      )}

      {section === "settings" && (
        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck className="h-5 w-5" /> Organization workspace controls</h2>
          <p className="mt-2 text-sm text-slate-600">
            Company status: <strong>{org.status}</strong>. Operational access: <strong>{org.operationalAccessEnabled ? "Enabled" : "Disabled"}</strong>.
            Data isolation: <strong>{org.dataIsolationVerifiedAt ? "Verified" : "Pending verification"}</strong>.
          </p>
          <Link href={`/platform/organizations/${encodeURIComponent(org.id)}`} className="mt-3 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Manage company through protected platform controls
          </Link>
        </Card>
      )}

      {section === "notifications" && (
        <Link href="/platform/notices" className="inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800">
          Open global system notices
        </Link>
      )}

      {MODULE_NOTES[section] && (
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
          {MODULE_NOTES[section]}
        </p>
      )}
      <p className="text-xs leading-6 text-slate-600">
        Navigation here is intentionally read-only. The Super Admin&apos;s original authenticated
        organization is never changed; modifying another company&apos;s operational data requires
        separately authorized and audited controls.
      </p>
    </main>
  );
}
