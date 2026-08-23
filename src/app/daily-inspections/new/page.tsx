import { db } from "@/db";
import { vehicles, transporters } from "@/db/schema";
import { eq, isNull, asc } from "drizzle-orm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { requireAuth } from "@/lib/require-auth";
import { getCurrentUser } from "@/lib/auth";
import { DailyInspectionForm } from "../DailyInspectionForm";

export const dynamic = "force-dynamic";

export default async function NewDailyInspectionPage() {
  await requireAuth();
  const user = await getCurrentUser();

  const vehicleOptions = await db
    .select({
      id: vehicles.id,
      registrationNumber: vehicles.registrationNumber,
      make: vehicles.make,
      model: vehicles.model,
    })
    .from(vehicles)
    .leftJoin(transporters, eq(transporters.id, vehicles.transporterId))
    .where(isNull(transporters.deletedAt))
    .orderBy(asc(vehicles.registrationNumber));

  const normalized = vehicleOptions.map((v) => ({
    id: v.id,
    registrationNumber: v.registrationNumber,
    make: v.make,
    model: v.model || "",
  }));

  return (
    <div className="p-6 lg:p-10">
      <Link href="/daily-inspections" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Daily Inspections
      </Link>
      <PageHeader
        eyebrow="Pre-Trip Safety Check"
        title="New Daily Inspection"
        description="Complete this inspection before the vehicle leaves the yard. Verify tires, brakes, lights, and fluids to confirm today's roadworthiness."
      />
      <DailyInspectionForm vehicleOptions={normalized} currentUserName={user.name} />
    </div>
  );
}
