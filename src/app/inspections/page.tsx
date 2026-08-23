import { db } from "@/db";
import { inspections, vehicles } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { PageHeader, Button } from "@/components/ui";
import { Plus } from "lucide-react";
import { getCurrentUser, canManageInspections } from "@/lib/auth";
import { InspectionsList } from "./InspectionsList";

export const dynamic = "force-dynamic";

export default async function InspectionsPage() {
  const user = await getCurrentUser();
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
        action={
          editable ? (
            <Link href="/inspections/new">
              <Button>
                <Plus className="h-4 w-4" /> <span className="hidden sm:inline">New Inspection</span><span className="sm:hidden">New</span>
              </Button>
            </Link>
          ) : undefined
        }
      />

      <InspectionsList rows={rows} />
    </div>
  );
}
