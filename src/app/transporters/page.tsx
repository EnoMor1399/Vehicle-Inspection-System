import { db } from "@/db";
import { transporters, vehicles, inspections, dailyInspections } from "@/db/schema";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
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

  const [rows, technicalTrend, preTripTrend] = await Promise.all([
    db
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
        preTripInspections: sql<number>`count(distinct ${dailyInspections.id})::int`,
        clearedTrips: sql<number>`count(distinct case when ${dailyInspections.clearedForTrip} = true then ${dailyInspections.id} end)::int`,
      })
      .from(transporters)
      .leftJoin(vehicles, eq(vehicles.transporterId, transporters.id))
      .leftJoin(inspections, eq(inspections.vehicleId, vehicles.id))
      .leftJoin(dailyInspections, eq(dailyInspections.vehicleId, vehicles.id))
      .where(isNull(transporters.deletedAt))
      .groupBy(transporters.id)
      .orderBy(desc(transporters.createdAt)),

    db
      .select({
        month: sql<string>`to_char(date_trunc('month', ${inspections.inspectionDate}), 'YYYY-MM')`,
        total: sql<number>`count(*)::int`,
        passed: sql<number>`count(*) filter (where ${inspections.overallResult} = 'pass')::int`,
      })
      .from(inspections)
      .innerJoin(vehicles, eq(vehicles.id, inspections.vehicleId))
      .innerJoin(transporters, eq(transporters.id, vehicles.transporterId))
      .where(
        and(
          isNull(transporters.deletedAt),
          sql`${inspections.inspectionDate} >= date_trunc('month', current_date) - interval '11 months'`,
        ),
      )
      .groupBy(sql`date_trunc('month', ${inspections.inspectionDate})`)
      .orderBy(sql`date_trunc('month', ${inspections.inspectionDate})`),

    db
      .select({
        month: sql<string>`to_char(date_trunc('month', ${dailyInspections.inspectionDate}), 'YYYY-MM')`,
        total: sql<number>`count(*)::int`,
        cleared: sql<number>`count(*) filter (where ${dailyInspections.clearedForTrip} = true)::int`,
      })
      .from(dailyInspections)
      .innerJoin(vehicles, eq(vehicles.id, dailyInspections.vehicleId))
      .innerJoin(transporters, eq(transporters.id, vehicles.transporterId))
      .where(
        and(
          isNull(transporters.deletedAt),
          sql`${dailyInspections.inspectionDate} >= date_trunc('month', current_date) - interval '11 months'`,
        ),
      )
      .groupBy(sql`date_trunc('month', ${dailyInspections.inspectionDate})`)
      .orderBy(sql`date_trunc('month', ${dailyInspections.inspectionDate})`),
  ]);

  const technicalByMonth = new Map(
    technicalTrend.map((item) => [item.month, { total: Number(item.total || 0), passed: Number(item.passed || 0) }]),
  );
  const preTripByMonth = new Map(
    preTripTrend.map((item) => [item.month, { total: Number(item.total || 0), cleared: Number(item.cleared || 0) }]),
  );

  const now = new Date();
  const monthFormatter = new Intl.DateTimeFormat("en", { month: "short" });
  const trend = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + index, 1));
    const month = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    const technical = technicalByMonth.get(month);
    const preTrip = preTripByMonth.get(month);
    return {
      month,
      label: monthFormatter.format(date),
      technical: technical?.total || 0,
      technicalPassed: technical?.passed || 0,
      preTrip: preTrip?.total || 0,
      clearedTrips: preTrip?.cleared || 0,
    };
  });

  return (
    <div className="p-4 sm:p-6 lg:p-10">
      <PageHeader
        title="Transporters"
        description="Fleet capacity, inspection readiness, trip clearance and transporter performance."
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

      <TransportersList rows={rows} trend={trend} />
    </div>
  );
}
