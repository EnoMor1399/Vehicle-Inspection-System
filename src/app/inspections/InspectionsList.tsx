"use client";

import Link from "next/link";
import { Card, Badge, EmptyState } from "@/components/ui";
import { ExportMenu } from "@/components/ExportMenu";
import {
  ArrowRight,
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Plus,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";

interface InspectionsListProps {
  rows: any[];
  canCreate?: boolean;
}

export function InspectionsList({ rows, canCreate = false }: InspectionsListProps) {
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
  const conditional = rows.filter(
    (r: any) =>
      r.overallResult === "conditional_pass" ||
      r.overallResult === "reinspection_required"
  ).length;

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        {canCreate && (
          <Link
            href="/inspections/new"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[var(--brand-color)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-color)] focus-visible:ring-offset-2 active:translate-y-px"
          >
            <Plus className="h-4 w-4" />
            New Inspection
          </Link>
        )}

        <ExportMenu
          data={exportData}
          filename="inspections"
          title="Vehicle Inspections"
          label="Export"
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="flex items-center gap-3 p-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Passed</p>
            <p className="text-2xl font-semibold text-emerald-700">{pass}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Conditional / Re-inspect</p>
            <p className="text-2xl font-semibold text-amber-700">{conditional}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-red-100 text-red-700">
            <XCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Failed</p>
            <p className="text-2xl font-semibold text-red-700">{fail}</p>
          </div>
        </Card>
      </div>

      {rows.length === 0 ? (
        <Card className="p-4 sm:p-6">
          <EmptyState
            icon={<ClipboardCheck className="h-10 w-10" />}
            title="No inspections yet"
            description={
              canCreate
                ? "Use New Inspection above to start the first vehicle inspection and build the compliance record."
                : "Inspection records will appear here when they become available."
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Inspection #</th>
                  <th className="px-4 py-3">Vehicle</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Station</th>
                  <th className="px-4 py-3">Inspector</th>
                  <th className="px-4 py-3">Result</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => (
                  <tr
                    key={r.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                  >
                    <td className="px-4 py-3 font-mono text-slate-700">
                      {r.inspectionNumber}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-950">{r.regNumber}</p>
                      <p className="text-xs text-slate-500">
                        {r.make} {r.model}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDateTime(r.inspectionDate)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.station || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.inspectorName || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <ResultBadge result={r.overallResult} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/inspections/${r.id}`}
                        aria-label={`View inspection ${r.inspectionNumber}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2"
                      >
                        View
                        <ArrowRight className="h-3.5 w-3.5" />
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
  const map: Record<
    string,
    {
      tone: "emerald" | "red" | "amber" | "slate";
      label: string;
      icon: typeof CheckCircle2;
    }
  > = {
    pass: { tone: "emerald", label: "Pass", icon: CheckCircle2 },
    fail: { tone: "red", label: "Fail", icon: XCircle },
    conditional_pass: {
      tone: "amber",
      label: "Conditional",
      icon: AlertTriangle,
    },
    reinspection_required: {
      tone: "amber",
      label: "Re-inspect",
      icon: AlertTriangle,
    },
  };
  const m = map[result] || {
    tone: "slate" as const,
    label: result,
    icon: ClipboardCheck,
  };
  const Icon = m.icon;
  return (
    <Badge tone={m.tone}>
      <Icon className="h-3.5 w-3.5" /> {m.label}
    </Badge>
  );
}
