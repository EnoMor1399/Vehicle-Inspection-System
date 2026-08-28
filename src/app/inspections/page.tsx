import { db } from "@/db";
import { inspections, vehicles } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { PageHeader } from "@/components/ui";
import { canManageInspections } from "@/lib/auth";
import { requirePermission } from "@/lib/require-auth";
import { InspectionsList } from "./InspectionsList";

export const dynamic = "force-dynamic";

export default async function InspectionsPage() {
  const user = await requirePermission("inspections");
  const editable = canManageInspections(user);

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
    .innerJoin(vehicles, eq(vehicles.id, inspections.vehicleId))
    .orderBy(desc(inspections.inspectionDate));

  return (
    <div className="p-4 sm:p-6 lg:p-10">
      <PageHeader
        eyebrow="Inspections"
        title="Vehicle Inspections"
        description="16-section checklist covering documentation, brakes, emissions and final decision."
      />

      <InspectionsList rows={rows} canCreate={editable} />
    </div>
  );
}
