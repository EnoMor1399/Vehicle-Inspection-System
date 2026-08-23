import { db } from "@/db";
import { importJobs } from "@/db/schema";
import { desc } from "drizzle-orm";
import { PageHeader, Card, Badge, EmptyState } from "@/components/ui";
import { Upload, Download, FileSpreadsheet, CheckCircle2, XCircle, Clock, RotateCcw } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { ImportWizard } from "./ImportWizard";
import { getCurrentUser, canImport } from "@/lib/auth";
import { rollbackImport } from "./server";

export const dynamic = "force-dynamic";

const ENTITY_TYPES = [
  {
    value: "vehicles",
    label: "Vehicles",
    fields: ["registration_number", "make", "model", "body_type", "category", "vehicle_class", "colour", "manufacturing_year", "vin", "chassis_number", "engine_number", "fuel_type", "transmission", "seating_capacity", "gross_weight", "number_of_axles", "odometer_reading", "transporter_name"],
  },
  {
    value: "transporters",
    label: "Transporters",
    fields: ["company_name", "registration_number", "tin_number", "gps_address", "contact_person", "mobile", "email", "physical_address", "region", "district", "insurance_company", "insurance_expiry"],
  },
  {
    value: "inspections",
    label: "Historical Inspections",
    fields: ["inspection_number", "registration_number", "inspection_date", "inspector_name", "station", "overall_result", "inspector_remarks", "next_inspection_date"],
  },
];

export default async function ImportPage() {
  const user = await getCurrentUser();
  const canDo = canImport(user);

  const jobs = await db.select().from(importJobs).orderBy(desc(importJobs.createdAt)).limit(25);

  return (
    <div className="p-6 lg:p-10">
      <PageHeader
        eyebrow="Data Migration"
        title="Import & Export"
        description="Drag-and-drop XLSX / XLS / CSV with column mapping, duplicate detection, validation, preview and rollback. Historical data from Excel is preserved for analytics."
        action={
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white ring-1 ring-slate-300 text-sm font-medium hover:bg-slate-50">
              <Download className="h-4 w-4" /> Export Vehicles
            </button>
            <button className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white ring-1 ring-slate-300 text-sm font-medium hover:bg-slate-50">
              <Download className="h-4 w-4" /> Export Inspections
            </button>
          </div>
        }
      />

      {canDo ? (
        <ImportWizard entityTypes={ENTITY_TYPES} />
      ) : (
        <Card className="p-8"><p className="text-slate-700">You do not have permission to import data.</p></Card>
      )}

      <Card className="p-6 mt-6">
        <h2 className="text-lg font-semibold text-slate-950 mb-4 flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" /> Import History
        </h2>
        {jobs.length === 0 ? (
          <EmptyState icon={<Upload className="h-8 w-8" />} title="No imports yet" description="Imported files will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-2 pr-4 text-left">File</th>
                  <th className="py-2 pr-4 text-left">Entity</th>
                  <th className="py-2 pr-4 text-left">Status</th>
                  <th className="py-2 pr-4 text-right">Rows</th>
                  <th className="py-2 pr-4 text-right">Valid</th>
                  <th className="py-2 pr-4 text-right">Imported</th>
                  <th className="py-2 pr-4 text-left">Date</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-4 font-mono text-xs">{j.fileName}</td>
                    <td className="py-2 pr-4"><Badge tone="blue">{j.entityType}</Badge></td>
                    <td className="py-2 pr-4"><JobStatusBadge status={j.status} /></td>
                    <td className="py-2 pr-4 text-right">{j.totalRows}</td>
                    <td className="py-2 pr-4 text-right text-emerald-600">{j.validRows}</td>
                    <td className="py-2 pr-4 text-right font-medium">{j.importedRows}</td>
                    <td className="py-2 pr-4 text-slate-600 text-xs">{formatDateTime(j.createdAt)}</td>
                    <td className="py-2 text-right">
                      {j.status === "completed" && canDo && (
                        <form action={rollbackImport.bind(null, j.id)} className="inline">
                          <button className="text-amber-700 hover:text-amber-800 text-xs font-medium inline-flex items-center gap-1">
                            <RotateCcw className="h-3 w-3" /> Rollback
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function JobStatusBadge({ status }: { status: string }) {
  const map: Record<string, { tone: "emerald" | "red" | "amber" | "blue" | "slate"; label: string; icon: typeof CheckCircle2 }> = {
    completed: { tone: "emerald", label: "Completed", icon: CheckCircle2 },
    failed: { tone: "red", label: "Failed", icon: XCircle },
    pending: { tone: "slate", label: "Pending", icon: Clock },
    validating: { tone: "blue", label: "Validating", icon: Clock },
    processing: { tone: "blue", label: "Processing", icon: Clock },
    rolled_back: { tone: "amber", label: "Rolled Back", icon: RotateCcw },
  };
  const m = map[status] || { tone: "slate" as const, label: status, icon: Clock };
  const Icon = m.icon;
  return <Badge tone={m.tone}><Icon className="h-3.5 w-3.5" /> {m.label}</Badge>;
}
