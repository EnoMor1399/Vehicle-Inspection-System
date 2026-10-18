import { db } from "@/db";
import { vehicles, transporters, inspections } from "@/db/schema";
import { and, eq, desc, sql } from "drizzle-orm";
import Link from "next/link";
import { PageHeader, Button } from "@/components/ui";
import { Plus } from "lucide-react";
import { VehiclesList } from "./VehiclesList";

export async function VehicleRegistryView({ organizationId, editable, readOnly = false }: { organizationId: string; editable: boolean; readOnly?: boolean }) {

  const rows = await db
    .select({
      id: vehicles.id,
      registrationNumber: vehicles.registrationNumber,
      make: vehicles.make,
      model: vehicles.model,
      bodyType: vehicles.bodyType,
      vehicleClass: vehicles.vehicleClass,
      colour: vehicles.colour,
      status: vehicles.status,
      transporterName: transporters.companyName,
      lastInspection: sql<Date>`max(${inspections.inspectionDate})`,
      lastResult: sql<string>`(select ${inspections.overallResult} from ${inspections} where ${inspections.vehicleId} = ${vehicles.id} and ${inspections.organizationId} = ${organizationId} order by ${inspections.inspectionDate} desc limit 1)`,
    })
    .from(vehicles)
    .leftJoin(transporters, and(eq(transporters.id, vehicles.transporterId), eq(transporters.organizationId, organizationId)))
    .leftJoin(inspections, and(eq(inspections.vehicleId, vehicles.id), eq(inspections.organizationId, organizationId)))
    .where(eq(vehicles.organizationId, organizationId))
    .groupBy(vehicles.id, transporters.companyName)
    .orderBy(desc(vehicles.createdAt));

  return (
    <div className="p-4 sm:p-6 lg:p-10">
      <PageHeader
        eyebrow="Vehicle Registry"
        title="Vehicles"
        description="Complete vehicle register for your organization workspace."
        action={
          editable ? (
            <Link href="/vehicles/new">
              <Button><Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add Vehicle</span><span className="sm:hidden">Add</span></Button>
            </Link>
          ) : undefined
        }
      />

      <VehiclesList rows={rows} editable={editable} readOnly={readOnly} />
    </div>
  );
}
