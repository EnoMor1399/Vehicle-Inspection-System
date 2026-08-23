"use client";

import Link from "next/link";
import { Card, Badge, Button, EmptyState } from "@/components/ui";
import { ExportMenu } from "@/components/ExportMenu";
import { Car } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

interface VehiclesListProps {
  rows: any[];
  editable: boolean;
}

export function VehiclesList({ rows, editable }: VehiclesListProps) {
  const exportData = rows.map((v: any) => ({
    registrationNumber: v.registrationNumber,
    make: v.make,
    model: v.model || "",
    bodyType: v.bodyType || "",
    vehicleClass: v.vehicleClass || "",
    colour: v.colour || "",
    status: v.status,
    transporter: v.transporterName || "",
    lastInspection: v.lastInspection ? formatDateTime(v.lastInspection) : "Never",
    lastResult: v.lastResult || "",
  }));

  return (
    <>
      <div className="flex justify-end mb-4">
        <ExportMenu
          data={exportData}
          filename="vehicles"
          title="Vehicle Fleet"
          label="Export"
        />
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={<Car className="h-10 w-10" />} title="No vehicles registered" description="Add the first vehicle to get started." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Registration</th>
                  <th className="py-3 px-4">Make / Model</th>
                  <th className="py-3 px-4">Type / Class</th>
                  <th className="py-3 px-4">Transporter</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Last Inspection</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((v: any) => (
                  <tr key={v.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-semibold text-slate-900">{v.registrationNumber}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded bg-slate-100 grid place-items-center shrink-0">
                          <Car className="h-4 w-4 text-slate-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{v.make} {v.model}</p>
                          <p className="text-xs text-slate-500">{v.colour || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{v.bodyType || "—"} · {v.vehicleClass || "—"}</td>
                    <td className="py-3 px-4 text-slate-600">{v.transporterName || "—"}</td>
                    <td className="py-3 px-4">
                      <Badge tone={v.status === "active" ? "emerald" : v.status === "failed" ? "red" : "slate"}>
                        {v.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      {v.lastResult ? (
                        <Badge tone={v.lastResult === "pass" ? "emerald" : v.lastResult === "fail" ? "red" : "amber"}>
                          {v.lastResult}
                        </Badge>
                      ) : (
                        <span className="text-slate-400 text-xs">Never</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link href={`/vehicles/${v.id}`} className="text-amber-700 hover:text-amber-800 font-medium text-sm">
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
