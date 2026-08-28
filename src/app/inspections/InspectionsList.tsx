"use client";

import Link from "next/link";
import { Card, Badge, EmptyState } from "@/components/ui";
import { ExportMenu } from "@/components/ExportMenu";
import { ClipboardCheck, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

interface InspectionsListProps {
  rows: any[];
}

export function InspectionsList({ rows }: InspectionsListProps) {
  const exportData = rows.map((r: any) => ({
    inspectionNumber: r.inspectionNumber,
    date: formatDateTime(r.inspectionDate),
    vehicleRegistration: r.regNumber,
    vehicleMake: r.make || "",
    vehicleModel: r.model || "",
    station: r.station || "",
    inspector: r.inspectorName || "",
    result: r.overallResult,
  }));

  const pass = rows.filter((r: any) => r.overallResult === "pass").length;
  const fail = rows.filter((r: any) => r.overallResult === "fail").length;
  const conditional = rows.filter((r: any) => r.overallResult === "conditional_pass" || r.overallResult === "reinspection_required").length;

  return (
    <>
      <div className="flex justify-end mb-6">
        <ExportMenu
          data={exportData}
          filename="inspections"
          title="Vehicle Inspections"
          label="Export"
        />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 grid place-items-center">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Passed</p>
            <p className="text-2xl font-semibold text-emerald-700">{pass}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 grid place-items-center">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Conditional / Re-inspect</p>
            <p className="text-2xl font-semibold text-amber-700">{conditional}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-red-100 text-red-700 grid place-items-center">
            <XCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Failed</p>
            <p className="text-2xl font-semibold text-red-700">{fail}</p>
          </div>
        </Card>
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={<ClipboardCheck className="h-10 w-10" />} title="No inspections yet" description="Start your first inspection to build the compliance record." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Inspection #</th>
                  <th className="py-3 px-4">Vehicle</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Station</th>
                  <th className="py-3 px-4">Inspector</th>
                  <th className="py-3 px-4">Result</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => (
                  <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-mono text-slate-700">{r.inspectionNumber}</td>
                    <td className="py-3 px-4">
                      <p className="font-medium">{r.regNumber}</p>
                      <p className="text-xs text-slate-500">{r.make} {r.model}</p>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{formatDateTime(r.inspectionDate)}</td>
                    <td className="py-3 px-4 text-slate-600">{r.station || "—"}</td>
                    <td className="py-3 px-4 text-slate-600">{r.inspectorName || "—"}</td>
                    <td className="py-3 px-4">
                      <ResultBadge result={r.overallResult} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link href={`/inspections/${r.id}`} className="text-[var(--brand-accent)] hover:opacity-75 font-semibold text-sm">
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

function ResultBadge({ result }: { result: string }) {
  const map: Record<string, { tone: "emerald" | "red" | "amber" | "slate"; label: string; icon: typeof CheckCircle2 }> = {
    pass: { tone: "emerald", label: "Pass", icon: CheckCircle2 },
    fail: { tone: "red", label: "Fail", icon: XCircle },
    conditional_pass: { tone: "amber", label: "Conditional", icon: AlertTriangle },
    reinspection_required: { tone: "amber", label: "Re-inspect", icon: AlertTriangle },
  };
  const m = map[result] || { tone: "slate" as const, label: result, icon: ClipboardCheck };
  const Icon = m.icon;
  return (
    <Badge tone={m.tone}>
      <Icon className="h-3.5 w-3.5" /> {m.label}
    </Badge>
  );
}
