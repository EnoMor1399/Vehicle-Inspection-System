import { db } from "@/db";
import { transporters, vehicles, inspections } from "@/db/schema";
import { eq, isNull, sql, desc } from "drizzle-orm";
import Link from "next/link";
import { PageHeader, Button } from "@/components/ui";
import { Plus } from "lucide-react";
import { canEditTransporters } from "@/lib/auth";
import { requirePermission } from "@/lib/require-auth";
import { TransportersList } from "./TransportersList";

export const dynamic = "force-dynamic";

export default async function TransportersPage() {
  const user = await requirePermission("transporters");
  const editable = canEditTransporters(user);

  const rows = await db
    .select({
      id: transporters.id,
      companyName: transporters.companyName,
      region: transporters.region,
      district: transporters.district,
      contactPerson: transporters.contactPerson,
      mobile: transporters.mobile,
      email: transporters.email,
      insuranceExpiry: transporters.insuranceExpiry,
      fleetSize: sql<number>`count(distinct ${vehicles.id})::int`,
      activeVehicles: sql<number>`count(distinct case when ${vehicles.status} = 'active' then ${vehicles.id} end)::int`,
      totalInspections: sql<number>`count(distinct ${inspections.id})::int`,
      passCount: sql<number>`count(distinct case when ${inspections.overallResult} = 'pass' then ${inspections.id} end)::int`,
    })
    .from(transporters)
    .leftJoin(vehicles, eq(vehicles.transporterId, transporters.id))
    .leftJoin(inspections, eq(inspections.vehicleId, vehicles.id))
    .where(isNull(transporters.deletedAt))
    .groupBy(transporters.id)
    .orderBy(desc(transporters.createdAt));

  return (
    <div className="p-4 sm:p-6 lg:p-10">
      <PageHeader
        eyebrow="Fleet Partners"
        title="Transporters"
        description="Manage transporter profiles, fleet composition and inspection compliance."
        action={
          editable ? (
            <Link href="/transporters/new">
              <Button>
                <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add Transporter</span><span className="sm:hidden">Add</span>
              </Button>
            </Link>
          ) : undefined
        }
      />

      <TransportersList rows={rows} />
    </div>
  );
}
