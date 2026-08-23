import { db } from "@/db";
import { vehicles, transporters } from "@/db/schema";
import { eq, isNull, asc } from "drizzle-orm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader, Card } from "@/components/ui";
import { getCurrentUser, canManageInspections } from "@/lib/auth";
import { InspectionForm } from "../InspectionForm";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function NewInspectionPage() {
  const user = await getCurrentUser();
  if (!canManageInspections(user)) {
    redirect("/inspections");
  }

  const rawOptions = await db
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
  const vehicleOptions = rawOptions.map((v) => ({
    id: v.id,
    registrationNumber: v.registrationNumber,
    make: v.make,
    model: v.model || "",
  }));

  return (
    <div className="p-6 lg:p-10">
      <Link href="/inspections" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to inspections
      </Link>
      <PageHeader
        eyebrow="New Inspection"
        title="Vehicle Inspection Checklist"
        description="Complete all 16 sections (A–P). Each item supports pass / fail / N/A, severity classification and remarks."
      />
      <InspectionForm vehicleOptions={vehicleOptions} currentUser={{ id: user.id, name: user.name }} />
    </div>
  );
}
