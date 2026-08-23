"use client";

import Link from "next/link";
import { Card, Badge, EmptyState } from "@/components/ui";
import { ExportMenu } from "@/components/ExportMenu";
import { Building2, Phone, Mail } from "lucide-react";

interface TransportersListProps {
  rows: any[];
}

export function TransportersList({ rows }: TransportersListProps) {
  const exportData = rows.map((t: any) => ({
    companyName: t.companyName,
    region: t.region || "",
    district: t.district || "",
    contactPerson: t.contactPerson || "",
    mobile: t.mobile || "",
    email: t.email || "",
    fleetSize: t.fleetSize || 0,
    activeVehicles: t.activeVehicles || 0,
    totalInspections: t.totalInspections || 0,
    compliance: t.totalInspections > 0 ? Math.round((t.passCount / t.totalInspections) * 100) : 0,
  }));

  return (
    <>
      <div className="flex justify-end mb-4">
        <ExportMenu
          data={exportData}
          filename="transporters"
          title="Transporter Companies"
          label="Export"
        />
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={<Building2 className="h-10 w-10" />} title="No transporters" description="Add the first transporter to get started." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rows.map((t: any) => {
            const compliance = t.totalInspections > 0 ? Math.round((t.passCount / t.totalInspections) * 100) : 0;
            return (
              <Link key={t.id} href={`/transporters/${t.id}`} className="block group">
                <Card className="p-5 hover:shadow-md hover:-translate-y-0.5 transition">
                  <div className="flex items-start gap-3">
                    <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 text-white grid place-items-center shrink-0">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-950 truncate">{t.companyName}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {t.region || "—"}{t.district ? `, ${t.district}` : ""}
                      </p>
                    </div>
                    <Badge tone="violet">{t.fleetSize} vehicles</Badge>
                  </div>

                  <div className="mt-4 space-y-1 text-sm text-slate-600">
                    {t.contactPerson && (
                      <p className="flex items-center gap-2 truncate">
                        <Building2 className="h-3.5 w-3.5 text-slate-400" /> {t.contactPerson}
                      </p>
                    )}
                    {t.mobile && (
                      <p className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-slate-400" /> {t.mobile}
                      </p>
                    )}
                    {t.email && (
                      <p className="flex items-center gap-2 truncate">
                        <Mail className="h-3.5 w-3.5 text-slate-400" /> {t.email}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-slate-500">
                        <span className="font-semibold text-slate-900">{t.activeVehicles}</span> active
                      </span>
                      <span className="text-slate-500">
                        <span className="font-semibold text-slate-900">{t.totalInspections}</span> inspections
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-14 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${compliance}%` }} />
                      </div>
                      <span className="text-xs font-medium text-slate-700">{compliance}%</span>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
