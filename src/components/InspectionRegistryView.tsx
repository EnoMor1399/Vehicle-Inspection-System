import { db } from "@/db";
import { inspections, vehicles } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { PageHeader } from "@/components/ui";
import { InspectionsList } from "@/app/inspections/InspectionsList";

export async function InspectionRegistryView({ organizationId, editable, readOnly = false }: { organizationId: string; editable: boolean; readOnly?: boolean }) {

  const rows = await db
    .select({
      id: inspections.id,
      inspectionNumber: inspections.inspectionNumber,
      inspectionDate: inspections.inspectionDate,
      overallResult: inspections.overallResult,
      inspectorName: inspections.inspectorName,
      station: inspections.station,
      regNumber: vehicles.registrationNumber,
      make: vehicles.make,
      model: vehicles.model,
    })
    .from(inspections)
    .innerJoin(vehicles, and(eq(vehicles.id, inspections.vehicleId), eq(vehicles.organizationId, organizationId)))
    .where(and(
      eq(inspections.organizationId, organizationId),
      eq(vehicles.organizationId, organizationId),
    ))
    .orderBy(desc(inspections.inspectionDate));

  return (
    <div className="p-4 sm:p-6 lg:p-10">
      <PageHeader
        eyebrow="Inspections"
        title="Vehicle Inspections"
        description="16-section checklist covering documentation, brakes, emissions and final decision."
      />

      <InspectionsList rows={rows} canCreate={editable} readOnly={readOnly} />
    </div>
  );
}
