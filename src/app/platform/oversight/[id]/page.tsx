import { notFound } from "next/navigation";
import { Building2, FileText, ShieldAlert, UsersRound } from "lucide-react";
import { Badge, Card, PageHeader } from "@/components/ui";
import { getPlatformOrganizationOversight } from "@/lib/platform-oversight";
import { AssetInventory } from "./AssetInventory";
import { getPlatformOrganizationAssetInventory } from "@/lib/platform-asset-inventory";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OrganizationOversightDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ assetType?: string | string[]; assetPage?: string | string[]; assetSearch?: string | string[] }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const first = (value?: string | string[]) => Array.isArray(value) ? value[0] : value;
  const [result, inventory] = await Promise.all([
    getPlatformOrganizationOversight(id),
    getPlatformOrganizationAssetInventory(id, {
      kind: first(query.assetType),
      page: first(query.assetPage),
      search: first(query.assetSearch),
    }),
  ]);
  if (!result || !inventory) notFound();
  const { organization: org, accounts, counts, recentVehicles,
    recentInspections, recentAudit, recentSecurity,
    recentStations, recentTransporters, recentDocuments, recentTrainingSessions } = result;
  const metricItems = [
    ["Accounts", counts.users], ["Vehicles", counts.vehicles],
    ["Inspections", counts.inspections], ["Stations", counts.stations],
    ["Transporters", counts.transporters], ["Documents", counts.documents],
    ["Training sessions", counts.trainingSessions],
  ] as const;
  return (
    <main className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-10">
      <PageHeader eyebrow="Super Administrator · Organization dashboard"
        title={org.name}
        description="Selected organization dashboard. Use the sidebar to switch companies or open organization-specific modules."
      />
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-emerald-700" />
            <div>
              <p className="font-semibold">{org.name} <span className="font-normal text-slate-500">· {org.slug}</span></p>
              <p className="text-sm text-slate-600">{org.email || "No contact email"} {org.phone ? `· ${org.phone}` : ""}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={org.status === "active" ? "emerald" : "amber"}>{org.status}</Badge>
            <Badge tone={org.operationalAccessEnabled && org.dataIsolationVerifiedAt ? "emerald" : "amber"}>
              {org.operationalAccessEnabled && org.dataIsolationVerifiedAt ? "Operational" : "Provisioning"}
            </Badge>
          </div>
        </div>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metricItems.map(([name, value]) => (
          <Card key={name} className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{name}</p>
            <p className="mt-1 text-2xl font-bold">{value.toLocaleString()}</p>
          </Card>
        ))}
      </div>
      <AssetInventory organizationId={org.id} inventory={inventory} />
      <Card className="p-5">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold"><UsersRound className="h-5 w-5" /> Organisation user accounts</h2>
        <p className="mb-4 text-xs text-slate-600">Up to 200 accounts shown. MFA, account recovery and support access require the existing protected controls.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b text-left text-xs uppercase text-slate-500"><tr>
              <th scope="col" className="p-2">User</th><th scope="col" className="p-2">Role</th>
              <th scope="col" className="p-2">Status</th><th scope="col" className="p-2">MFA</th>
              <th scope="col" className="p-2">Last login</th>
            </tr></thead>
            <tbody>
              {accounts.map((u) => <tr key={u.id} className="border-b last:border-0">
                <td className="p-2"><span className="font-medium">{u.name}</span><p className="text-xs text-slate-600">{u.email}</p></td>
                <td className="p-2">{u.role.replaceAll("_", " ")}</td>
                <td className="p-2"><Badge tone={u.isActive ? "emerald" : "red"}>{u.isActive ? "Active" : "Inactive"}</Badge></td>
                <td className="p-2">{u.twoFactorEnabled ? "Enabled" : "Not enrolled"}</td>
                <td className="p-2">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Never"}</td>
              </tr>)}
              {accounts.length === 0 && <tr><td colSpan={5} className="p-4 text-slate-500">No accounts for this organisation.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-lg font-semibold">Recently registered vehicles</h2>
          <p className="mb-3 text-xs text-slate-500">Most recent 15 of {counts.vehicles} organisation vehicles</p>
          {recentVehicles.length ? recentVehicles.map((v) => (
            <div key={v.id} className="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-0">
              <span><strong>{v.registrationNumber}</strong><span className="ml-2 text-slate-600">{v.make} {v.model}</span></span>
              <span className="text-xs text-slate-600">{v.status}</span>
            </div>
          )) : <p className="py-3 text-sm text-slate-500">No registered vehicles.</p>}
        </Card>
        <Card className="p-5">
          <h2 className="text-lg font-semibold">Recent inspections</h2>
          <p className="mb-3 text-xs text-slate-500">Most recent 15 of {counts.inspections} inspection records</p>
          {recentInspections.length ? recentInspections.map((inspection) => (
            <div key={inspection.id} className="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-0">
              <span><strong>{inspection.inspectionNumber}</strong>
                <p className="text-xs text-slate-500">{formatDateTime(inspection.inspectionDate)}</p>
              </span>
              <span className="text-xs text-slate-600">{inspection.overallResult.replaceAll("_", " ")} · {inspection.workflowStatus.replaceAll("_", " ")}</span>
            </div>
          )) : <p className="py-3 text-sm text-slate-500">No inspections yet.</p>}
        </Card>
        <Card className="p-5">
          <h2 className="text-lg font-semibold">Stations</h2>
          <p className="mb-3 text-xs text-slate-500">First 15 of {counts.stations} inspection locations</p>
          {recentStations.length ? recentStations.map((station) => (
            <div key={station.id} className="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-0">
              <span><strong>{station.name}</strong><p className="text-xs text-slate-500">{station.code} · {station.region || "Region not specified"}</p></span>
              <span className="text-xs text-slate-600">{station.status}</span>
            </div>
          )) : <p className="py-3 text-sm text-slate-500">No stations registered.</p>}
        </Card>
        <Card className="p-5">
          <h2 className="text-lg font-semibold">Transporter companies</h2>
          <p className="mb-3 text-xs text-slate-500">First 15 of {counts.transporters} transporters</p>
          {recentTransporters.length ? recentTransporters.map((transporter) => (
            <div key={transporter.id} className="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-0">
              <span><strong>{transporter.companyName}</strong><p className="text-xs text-slate-500">{transporter.registrationNumber || "No registration"}</p></span>
              <span className="text-xs text-slate-600">{transporter.status}</span>
            </div>
          )) : <p className="py-3 text-sm text-slate-500">No transporter companies.</p>}
        </Card>
        <Card className="p-5">
          <h2 className="text-lg font-semibold">Driver training sessions</h2>
          <p className="mb-3 text-xs text-slate-500">Most recent 15 of {counts.trainingSessions} sessions</p>
          {recentTrainingSessions.length ? recentTrainingSessions.map((session) => (
            <div key={session.id} className="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-0">
              <span><strong>{session.title}</strong><p className="text-xs text-slate-500">{session.referenceNumber} · {formatDateTime(session.startAt)}</p></span>
              <span className="text-xs text-slate-600">{session.status}</span>
            </div>
          )) : <p className="py-3 text-sm text-slate-500">No training sessions.</p>}
        </Card>
        <Card className="p-5">
          <h2 className="text-lg font-semibold">Document inventory</h2>
          <p className="mb-3 text-xs text-slate-500">Latest 15 of {counts.documents} records; file contents are not exposed by this oversight view</p>
          {recentDocuments.length ? recentDocuments.map((document) => (
            <div key={document.id} className="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-0">
              <span><strong>{document.name}</strong><p className="text-xs text-slate-500">{document.ownerType}</p></span>
              <span className="text-xs text-slate-600">{document.type}</span>
            </div>
          )) : <p className="py-3 text-sm text-slate-500">No documents.</p>}
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><ShieldAlert className="h-5 w-5" /> Security events</h2>
          {recentSecurity.length ? recentSecurity.map((event) => (
            <div key={event.id} className="border-b py-2 text-sm last:border-0">
              <p className="font-semibold">{event.eventType.replaceAll("_", " ")} <span className="text-xs text-slate-500">· {event.severity} · {event.resolved ? "Resolved" : "Open"}</span></p>
              <p className="text-slate-600">{event.description || "No description"}</p>
              <p className="mt-1 text-xs text-slate-500">{formatDateTime(event.createdAt)}</p>
            </div>
          )) : <p className="py-3 text-sm text-slate-500">No security events for this subscriber.</p>}
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><FileText className="h-5 w-5" /> Recent audit activity</h2>
          {recentAudit.length ? recentAudit.map((event) => (
            <div key={event.id} className="border-b py-2 text-sm last:border-0">
              <p className="font-semibold">{event.action.toUpperCase()} · {event.entityType}</p>
              <p className="text-slate-600">{event.summary || "Activity recorded"} · {event.userName || "System"}</p>
              <p className="mt-1 text-xs text-slate-500">{formatDateTime(event.createdAt)}</p>
            </div>
          )) : <p className="py-3 text-sm text-slate-500">No audit events recorded.</p>}
        </Card>
      </div>
      <p className="text-sm leading-6 text-slate-600">
        This page provides governed read-only resource oversight. Operational changes must use existing
        authorised organisation, account-support and subscription controls. Cross-tenant operational
        endpoints remain blocked by their standard tenant checks.
      </p>
    </main>
  );
}
