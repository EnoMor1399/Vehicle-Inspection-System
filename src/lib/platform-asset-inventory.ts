import "server-only";

import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { requirePlatformSuperAdmin } from "@/lib/require-auth";
import { isValidOrganizationId } from "@/lib/organization-id";

// Existing tenant-owned resources are displayed as a read-only catalogue.
// An inspection event or a user account is not counted as an asset.
// Equipment entries originate from each station's existing equipment list;
// VIMS has no separate equipment asset tags/statuses for these entries.
export const ASSET_KINDS = [
  "all", "vehicle", "station", "equipment", "rfid", "transporter", "document", "training",
] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export const ASSET_PAGE_SIZE = 50;
export const ASSET_KIND_LABELS: Record<AssetKind, string> = {
  all: "All resources",
  vehicle: "Vehicles",
  station: "Stations",
  equipment: "Station equipment",
  rfid: "RFID tags",
  transporter: "Transporters",
  document: "Documents",
  training: "Training sessions",
};

type AssetInventoryRow = {
  id: string;
  kind: Exclude<AssetKind, "all">;
  name: string;
  assetType: string;
  status: string;
  identifier: string | null;
  alternateIdentifier: string | null;
  details: string | null;
};

type InventoryCountRow = { kind: Exclude<AssetKind, "all">; total: string };
type TotalRow = { total: string };

export function normalizeAssetInventoryFilters(filters: {
  kind?: string;
  page?: string | number;
  search?: string;
}) {
  const kind = ASSET_KINDS.find((value) => value === filters.kind) ?? "all";
  const parsedPage = Number(filters.page);
  const page = Number.isSafeInteger(parsedPage) && parsedPage >= 1
    ? Math.min(parsedPage, 100_000)
    : 1;
  const search = (filters.search ?? "").trim().slice(0, 80);
  return { kind, page, search };
}

export async function getPlatformOrganizationAssetInventory(
  organizationId: string,
  filters: { kind?: string; page?: string | number; search?: string } = {},
) {
  await requirePlatformSuperAdmin();
  if (!isValidOrganizationId(organizationId)) {
    return null;
  }
  const [org] = await db.select({ id: organizations.id })
    .from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  if (!org) return null;

  const { kind, page: requestedPage, search } = normalizeAssetInventoryFilters(filters);

  // Every UNION branch has its OWN selected organization predicate. An id,
  // registration number or join from a different company cannot cross this boundary.
  // Only columns required by the overview are returned; file URLs and sensitive
  // document contents are intentionally excluded.
  const scopedAssets = sql`
    SELECT v.id::text AS id, 'vehicle'::text AS kind,
      CONCAT_WS(' ', v.make, NULLIF(v.model, ''))::text AS name,
      COALESCE(NULLIF(v.category, ''), NULLIF(v.body_type, ''), 'Vehicle')::text AS "assetType",
      v.status::text AS status,
      v.registration_number::text AS identifier,
      COALESCE(NULLIF(v.vin, ''), NULLIF(v.chassis_number, ''), NULLIF(v.engine_number, ''))::text AS "alternateIdentifier",
      COALESCE(NULLIF(v.vehicle_class, ''), NULLIF(v.body_type, ''))::text AS details
    FROM vehicles v WHERE v.organization_id = ${organizationId}

    UNION ALL
    SELECT l.id::text, 'station'::text,
      l.name::text, 'Inspection station'::text, l.status::text,
      l.code::text, l.gps_address::text, l.region::text
    FROM locations l WHERE l.organization_id = ${organizationId}

    UNION ALL
    SELECT (l.id || ':' || entry.position::text)::text, 'equipment'::text,
      entry.equipment_name::text, 'Station equipment'::text, 'Listed'::text,
      NULL::text, l.code::text, ('Station: ' || l.name)::text
    FROM locations l
    CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(l.equipment, '[]'::jsonb))
      WITH ORDINALITY AS entry(equipment_name, position)
    WHERE l.organization_id = ${organizationId}

    UNION ALL
    SELECT r.id::text, 'rfid'::text, r.tag_uid::text, 'RFID tag'::text,
      r.status::text, r.tag_uid::text, r.vehicle_id::text,
      'Assigned vehicle record ID'::text
    FROM rfid_tags r WHERE r.organization_id = ${organizationId}

    UNION ALL
    SELECT t.id::text, 'transporter'::text, t.company_name::text,
      'Transporter company'::text,
      CASE WHEN t.deleted_at IS NOT NULL THEN 'Deleted'
           WHEN t.archived_at IS NOT NULL THEN 'Archived'
           ELSE t.status::text END,
      t.registration_number::text, t.tin_number::text, t.region::text
    FROM transporters t WHERE t.organization_id = ${organizationId}

    UNION ALL
    SELECT d.id::text, 'document'::text, d.name::text,
      ('Document · ' || d.type::text)::text, 'On file'::text,
      d.id::text, NULL::text, ('Owner type: ' || d.owner_type)::text
    FROM documents d WHERE d.organization_id = ${organizationId}

    UNION ALL
    SELECT s.id::text, 'training'::text, s.title::text,
      'Driver training session'::text, s.status::text,
      s.reference_number::text, NULL::text, s.venue::text
    FROM training_sessions s WHERE s.organization_id = ${organizationId}
  `;

  const filtered = sql`
    (${kind} = 'all' OR assets.kind = ${kind})
    AND (
      ${search} = '' OR POSITION(
        LOWER(${search}) IN
        LOWER(CONCAT_WS(' ', assets.name, assets."assetType",
          assets.identifier, assets."alternateIdentifier"))
      ) > 0
    )
  `;

  const [totals, matches] = await Promise.all([
    db.execute<InventoryCountRow>(sql`
      SELECT assets.kind, COUNT(*)::text AS total
      FROM (${scopedAssets}) assets GROUP BY assets.kind
    `),
    db.execute<TotalRow>(sql`
      SELECT COUNT(*)::text AS total FROM (${scopedAssets}) assets
      WHERE ${filtered}
    `),
  ]);
  const counts = Object.fromEntries(
    ASSET_KINDS.filter((k) => k !== "all").map((k) => [k, 0]),
  ) as Record<Exclude<AssetKind, "all">, number>;
  for (const item of totals.rows) counts[item.kind] = Number(item.total) || 0;
  const total = Number(matches.rows[0]?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / ASSET_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * ASSET_PAGE_SIZE;

  const records = await db.execute<AssetInventoryRow>(sql`
    SELECT assets.id, assets.kind, assets.name, assets."assetType",
      assets.status, assets.identifier, assets."alternateIdentifier", assets.details
    FROM (${scopedAssets}) assets
    WHERE ${filtered}
    ORDER BY assets.kind ASC, assets.name ASC, assets.id ASC
    LIMIT ${ASSET_PAGE_SIZE} OFFSET ${offset}
  `);

  return {
    counts,
    grandTotal: Object.values(counts).reduce((sum, n) => sum + n, 0),
    total,
    totalPages,
    page,
    kind,
    search,
    pageSize: ASSET_PAGE_SIZE,
    records: records.rows,
  };
}
