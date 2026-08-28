import { db } from "@/db";
import { vehicles, transporters, inspections } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import Link from "next/link";
import { PageHeader, Button } from "@/components/ui";
import { Plus } from "lucide-react";
import { canEditVehicles } from "@/lib/auth";
import { requireInternalUser } from "@/lib/require-auth";
import { VehiclesList } from "./VehiclesList";

export const dynamic = "force-dynamic";

export default async function VehiclesPage() {
  const user = await requireInternalUser();
  const editable = canEditVehicles(user);

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
      lastResult: sql<string>`(select ${inspections.overallResult} from ${inspections} where ${inspections.vehicleId} = ${vehicles.id} order by ${inspections.inspectionDate} desc limit 1)`,
    })
    .from(vehicles)
    .leftJoin(transporters, eq(transporters.id, vehicles.transporterId))
    .leftJoin(inspections, eq(inspections.vehicleId, vehicles.id))
    .groupBy(vehicles.id, transporters.companyName)
    .orderBy(desc(vehicles.createdAt));

  return (
    <div className="p-4 sm:p-6 lg:p-10">
      <PageHeader
        eyebrow="Vehicle Registry"
        title="Vehicles"
        description="Complete register of vehicles inspected under the RSL programme."
        action={
          editable ? (
            <Link href="/vehicles/new">
              <Button><Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add Vehicle</span><span className="sm:hidden">Add</span></Button>
            </Link>
          ) : undefined
        }
      />

      <VehiclesList rows={rows} editable={editable} />
    </div>
  );
}
