import Link from "next/link";
import { ArrowLeft, ArrowRight, Boxes, Search } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import {
  ASSET_KINDS, ASSET_KIND_LABELS, type AssetKind,
  type getPlatformOrganizationAssetInventory,
} from "@/lib/platform-asset-inventory";

type Inventory = NonNullable<Awaited<ReturnType<typeof getPlatformOrganizationAssetInventory>>>;

function buildInventoryUrl(
  organizationId: string,
  filters: { kind: AssetKind; page?: number; search: string },
) {
  const params = new URLSearchParams();
  if (filters.kind !== "all") params.set("assetType", filters.kind);
  if (filters.search) params.set("assetSearch", filters.search);
  if (filters.page && filters.page > 1) params.set("assetPage", String(filters.page));
  const query = params.toString();
  return `/platform/oversight/${encodeURIComponent(organizationId)}${query ? `?${query}` : ""}#organization-inventory`;
}

export function AssetInventory({
  organizationId,
  inventory,
}: {
  organizationId: string;
  inventory: Inventory;
}) {
  const start = inventory.total === 0 ? 0 : (inventory.page - 1) * inventory.pageSize + 1;
  const end = Math.min(inventory.total, inventory.page * inventory.pageSize);
  return (
    <section id="organization-inventory" aria-label="Organization asset inventory">
      <Card className="p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950">
              <Boxes className="h-5 w-5 text-emerald-700" /> Organization asset and resource inventory
            </h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">
              Complete, read-only list of the selected organization's registered vehicles,
              inspection stations and their listed equipment, RFID tags, transporters,
              documents and training sessions. No other organization's records are included.
            </p>
          </div>
          <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800">
            {inventory.grandTotal.toLocaleString()} registered entries
          </span>
        </div>
        <div className="mb-5 flex flex-wrap gap-2" aria-label="Filter by resource type">
          {ASSET_KINDS.map((kind) => {
            const selected = kind === inventory.kind;
            const number = kind === "all" ? inventory.grandTotal : inventory.counts[kind];
            return (
              <Link
                key={kind}
                href={buildInventoryUrl(organizationId, { kind, search: inventory.search })}
                aria-current={selected ? "page" : undefined}
                className={`rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                  selected
                    ? "border-emerald-800 bg-emerald-800 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-emerald-500 hover:text-emerald-800"
                }`}
              >
                {ASSET_KIND_LABELS[kind]} · {number.toLocaleString()}
              </Link>
            );
          })}
        </div>

        <form
          method="GET"
          action={`/platform/oversight/${encodeURIComponent(organizationId)}`}
          className="mb-4 flex flex-wrap items-end gap-2"
        >
          {inventory.kind !== "all" && <input type="hidden" name="assetType" value={inventory.kind} />}
          <label className="min-w-[220px] flex-1 text-xs font-semibold text-slate-700">
            Search names, types or identification numbers
            <input
              name="assetSearch"
              type="search"
              maxLength={80}
              defaultValue={inventory.search}
              placeholder="Search this organization's resources"
              className="mt-1 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <button type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            <Search className="h-4 w-4" /> Search
          </button>
          {inventory.search && (
            <Link href={buildInventoryUrl(organizationId, { kind: inventory.kind, search: "" })} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">
              Clear
            </Link>
          )}
        </form>

        <p className="mb-3 text-xs text-slate-500" aria-live="polite">
          Showing {start.toLocaleString()}–{end.toLocaleString()} of {inventory.total.toLocaleString()} matching records.
          Records are paginated; they are not limited to the recent activity samples below.
        </p>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[830px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th scope="col" className="p-3">Asset / resource name</th>
                <th scope="col" className="p-3">Category and type</th>
                <th scope="col" className="p-3">Status</th>
                <th scope="col" className="p-3">Identification</th>
                <th scope="col" className="p-3">Additional detail</th>
              </tr>
            </thead>
            <tbody>
              {inventory.records.map((asset) => (
                <tr key={`${asset.kind}:${asset.id}`} className="border-t border-slate-100 align-top">
                  <td className="p-3 font-semibold text-slate-900">{asset.name}</td>
                  <td className="p-3">
                    <span className="block font-medium text-slate-800">{ASSET_KIND_LABELS[asset.kind]}</span>
                    <span className="text-xs text-slate-500">{asset.assetType}</span>
                  </td>
                  <td className="p-3">
                    <Badge tone={asset.status.toLowerCase() === "active" ? "emerald" : "amber"}>{asset.status}</Badge>
                  </td>
                  <td className="p-3 font-mono text-xs text-slate-700">
                    <span className="block break-all">{asset.identifier || "Not recorded"}</span>
                    {asset.alternateIdentifier && (
                      <span className="mt-1 block break-all text-slate-500">Other: {asset.alternateIdentifier}</span>
                    )}
                  </td>
                  <td className="p-3 text-xs text-slate-600">{asset.details || "—"}</td>
                </tr>
              ))}
              {inventory.records.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-sm text-slate-500">
                  No records match this organization and filter.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
          {inventory.page > 1 ? (
            <Link
              href={buildInventoryUrl(organizationId, { kind: inventory.kind, search: inventory.search, page: inventory.page - 1 })}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 font-semibold text-slate-800"
            ><ArrowLeft className="h-4 w-4" /> Previous</Link>
          ) : <span />}
          <span className="text-xs font-semibold text-slate-600">Page {inventory.page} of {inventory.totalPages}</span>
          {inventory.page < inventory.totalPages ? (
            <Link
              href={buildInventoryUrl(organizationId, { kind: inventory.kind, search: inventory.search, page: inventory.page + 1 })}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 font-semibold text-slate-800"
            >Next <ArrowRight className="h-4 w-4" /></Link>
          ) : <span />}
        </div>
        <p className="mt-4 text-xs leading-5 text-slate-500">
          Equipment comes from station-maintained lists and has no individual asset tag or condition
          recorded in the current database; its status is therefore “Listed.” Documents are shown
          as “On file,” not as verified or unexpired. This page cannot change inventory records.
        </p>
      </Card>
    </section>
  );
}
