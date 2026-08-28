import { db } from "@/db";
import { dailyInspections, importJobs, vehicles, inspections } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { PageHeader, Card, Badge, EmptyState } from "@/components/ui";
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, Clock } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { ImportWizard } from "./ImportWizard";
import { canImport } from "@/lib/auth";
import { requireInternalUser } from "@/lib/require-auth";
import { ExportMenu } from "@/components/ExportMenu";

export const dynamic = "force-dynamic";

const ENTITY_TYPES = [
  {
    value: "vehicles",
    label: "Vehicles",
    fields: ["registration_number", "make", "model", "body_type", "category", "vehicle_class", "colour", "manufacturing_year", "vin", "chassis_number", "engine_number", "fuel_type", "transmission", "seating_capacity", "gross_weight", "number_of_axles", "odometer_reading", "transporter_name"],
    required: ["registration_number", "make"],
  },
  {
    value: "transporters",
    label: "Transporters",
    fields: ["company_name", "registration_number", "tin_number", "gps_address", "contact_person", "mobile", "email", "physical_address", "region", "district", "insurance_company", "insurance_expiry"],
    required: ["company_name"],
  },
  {
    value: "inspections",
    label: "Historical Inspections",
    fields: ["inspection_number", "registration_number", "inspection_date", "inspector_name", "station", "overall_result", "inspector_remarks", "next_inspection_date"],
    required: ["registration_number", "inspection_date", "overall_result"],
  },
  {
    value: "pre_trip_inspections",
    label: "Pre-Trip / Safe-To-Load Inspections",
    fields: ["source_reference", "registration_number", "inspection_date", "pre_trip_result", "cleared_for_trip", "driver_name", "odometer", "trip_purpose", "route_description", "product", "capacity", "transporter_name", "notes"],
    required: ["registration_number", "inspection_date", "pre_trip_result"],
  },
];

export default async function ImportPage() {
  const user = await requireInternalUser();
  const canDo = canImport(user);

  const [jobs, vehicleExportRows, inspectionExportRows, preTripExportRows] = await Promise.all([
    db.select().from(importJobs).orderBy(desc(importJobs.createdAt)).limit(25),
    db.select({ registrationNumber: vehicles.registrationNumber, make: vehicles.make, model: vehicles.model, status: vehicles.status, vin: vehicles.vin, updatedAt: vehicles.updatedAt }).from(vehicles).orderBy(desc(vehicles.updatedAt)),
    db.select({ inspectionNumber: inspections.inspectionNumber, vehicleId: inspections.vehicleId, inspectionDate: inspections.inspectionDate, overallResult: inspections.overallResult, workflowStatus: inspections.workflowStatus, inspectorName: inspections.inspectorName, station: inspections.station }).from(inspections).orderBy(desc(inspections.inspectionDate)),
    db
      .select({
        registrationNumber: vehicles.registrationNumber,
        inspectionDate: dailyInspections.inspectionDate,
        preTripResult: dailyInspections.status,
        clearedForTrip: dailyInspections.clearedForTrip,
        driverName: dailyInspections.driverName,
        odometer: dailyInspections.odometer,
        tripPurpose: dailyInspections.tripPurpose,
        routeDescription: dailyInspections.routeDescription,
        notes: dailyInspections.notes,
        completedAt: dailyInspections.completedAt,
      })
      .from(dailyInspections)
      .innerJoin(vehicles, eq(vehicles.id, dailyInspections.vehicleId))
      .orderBy(desc(dailyInspections.inspectionDate), desc(dailyInspections.completedAt)),
  ]);
  const vehicleExport = vehicleExportRows.map((row) => ({ ...row, updatedAt: row.updatedAt?.toISOString?.() || String(row.updatedAt || "") }));
  const inspectionExport = inspectionExportRows.map((row) => ({ ...row, inspectionDate: row.inspectionDate?.toISOString?.() || String(row.inspectionDate || "") }));
  const preTripExport = preTripExportRows.map((row) => ({ ...row, completedAt: row.completedAt?.toISOString?.() || String(row.completedAt || "") }));

  return (
    <div className="p-6 lg:p-10">
      <PageHeader
        eyebrow="Data Migration"
        title="Import & Export"
        description="Validated XLSX / XLS / CSV migration with explicit column mapping, duplicate checks and import history. Imports are additive and are not presented as reversible unless a dedicated rollback ledger exists."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ExportMenu data={vehicleExport} filename="vims-vehicles" title="Vehicle Registry" label="Export Vehicles" />
            <ExportMenu data={inspectionExport} filename="vims-inspections" title="Inspection Register" label="Export Inspections" />
            <ExportMenu data={preTripExport} filename="vims-pre-trip-inspections" title="Pre-Trip Inspection Register" label="Export Pre-Trip" />
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
  };
  const m = map[status] || { tone: "slate" as const, label: status, icon: Clock };
  const Icon = m.icon;
  return <Badge tone={m.tone}><Icon className="h-3.5 w-3.5" /> {m.label}</Badge>;
}
