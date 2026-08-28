import { db } from "@/db";
import { locations, users, inspections } from "@/db/schema";
import { eq, sql, asc } from "drizzle-orm";
import { PageHeader, Card, Badge, EmptyState } from "@/components/ui";
import { StationEditor } from "./StationEditor";
import { MapPin, Users, Wrench, Phone, Mail } from "lucide-react";
import { canManageLocations } from "@/lib/auth";
import { requireInternalUser } from "@/lib/require-auth";

export const dynamic = "force-dynamic";

export default async function LocationsPage() {
  const user = await requireInternalUser();
  const canManage = canManageLocations(user);

  const allLocations = await db.select().from(locations).orderBy(asc(locations.name));
  const rows = await Promise.all(
    allLocations.map(async (loc) => {
      const [inspectorCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(eq(users.locationId, loc.id));
      const [inspectionCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(inspections)
        .where(eq(inspections.locationId, loc.id));
      return {
        ...loc,
        inspectorCount: inspectorCount?.count || 0,
        inspectionCount: inspectionCount?.count || 0,
      };
    })
  );

  return (
    <div className="p-6 lg:p-10">
      <PageHeader
        eyebrow="Network"
        title="Inspection Stations"
        description="Multi-site network across Ghana. Each station maintains its own inspectors, vehicles, equipment and daily schedules."
        action={canManage ? <StationEditor /> : undefined}
      />

      {rows.length === 0 ? (
        <Card><EmptyState icon={<MapPin className="h-10 w-10" />} title="No stations configured" /></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rows.map((s) => (
            <Card key={s.id} className="p-5 hover:shadow-md transition">
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white grid place-items-center shrink-0">
                  <MapPin className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-950 truncate">{s.name}</p>
                  <p className="text-xs text-slate-500 font-mono">{s.code}</p>
                  <p className="text-xs text-slate-600 mt-0.5 truncate">{s.region}{s.district ? `, ${s.district}` : ""}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge tone={s.status === "active" ? "emerald" : s.status === "maintenance" ? "amber" : "slate"}>{s.status}</Badge>
                  {canManage && <StationEditor station={{
                    id: s.id, name: s.name, code: s.code, region: s.region || "", district: s.district || "",
                    address: s.address || "", gpsAddress: s.gpsAddress || "", phone: s.phone || "", email: s.email || "",
                    managerName: s.managerName || "", capacity: s.capacity, equipment: Array.isArray(s.equipment) ? s.equipment : [], status: s.status,
                  }} />}
                </div>
              </div>

              <div className="mt-3 space-y-1 text-sm text-slate-600">
                {s.managerName && <p className="flex items-center gap-2"><Users className="h-3.5 w-3.5 text-slate-400" /> Manager: {s.managerName}</p>}
                {s.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-slate-400" /> {s.phone}</p>}
                {s.email && <p className="flex items-center gap-2 truncate"><Mail className="h-3.5 w-3.5 text-slate-400" /> {s.email}</p>}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center border-t border-slate-100 pt-3">
                <div>
                  <p className="text-xs text-slate-500">Inspectors</p>
                  <p className="font-semibold text-slate-900">{s.inspectorCount}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Inspections</p>
                  <p className="font-semibold text-slate-900">{s.inspectionCount}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Capacity</p>
                  <p className="font-semibold text-slate-900">{s.capacity || "—"}/d</p>
                </div>
              </div>

              {(() => {
                const eq = Array.isArray(s.equipment) ? s.equipment : [];
                return eq.length > 0 ? (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-1 mb-1.5">
                      <Wrench className="h-3 w-3" /> Equipment
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {eq.map((e: string, i: number) => (
                        <span key={`${e}-${i}`} className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-xs text-slate-700">{e}</span>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
