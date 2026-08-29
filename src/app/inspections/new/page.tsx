import { db } from "@/db";
import { vehicles, transporters } from "@/db/schema";
import { and, eq, ilike, isNull, asc } from "drizzle-orm";
import Link from "next/link";
import { ArrowLeft, Search, X } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { getCurrentUser, canManageInspections } from "@/lib/auth";
import { InspectionForm } from "../InspectionForm";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function NewInspectionPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const user = await getCurrentUser();
  if (!canManageInspections(user)) {
    redirect("/inspections");
  }

  const params = await searchParams;
  const rawQuery = Array.isArray(params.q) ? params.q[0] : params.q;
  const vehicleQuery = (rawQuery || "").trim().slice(0, 32);

  const rawOptions = await db
    .select({
      id: vehicles.id,
      registrationNumber: vehicles.registrationNumber,
      make: vehicles.make,
      model: vehicles.model,
    })
    .from(vehicles)
    .leftJoin(transporters, eq(transporters.id, vehicles.transporterId))
    .where(
      vehicleQuery
        ? and(
            isNull(transporters.deletedAt),
            ilike(vehicles.registrationNumber, `%${vehicleQuery}%`),
          )
        : isNull(transporters.deletedAt),
    )
    .orderBy(asc(vehicles.registrationNumber));

  const vehicleOptions = rawOptions.map((v) => ({
    id: v.id,
    registrationNumber: v.registrationNumber,
    make: v.make,
    model: v.model || "",
  }));

  return (
    <div className="p-6 lg:p-10">
      <Link href="/inspections" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Back to inspections
      </Link>
      <PageHeader
        eyebrow="New Inspection"
        title="Vehicle Inspection Checklist"
        description="Complete Sections A–P and record the final inspection decision."
      />

      <div className="mb-5">
        <form method="get" className="flex max-w-2xl flex-col gap-2 sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Search vehicle registration number</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              name="q"
              defaultValue={vehicleQuery}
              placeholder="Search vehicle number"
              autoComplete="off"
              className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
            />
          </label>
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <Search className="h-4 w-4" /> Search
          </button>
          {vehicleQuery && (
            <Link
              href="/inspections/new"
              aria-label="Clear vehicle search"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <X className="h-4 w-4" /> Clear
            </Link>
          )}
        </form>
        {vehicleQuery && (
          <p className={`mt-2 text-xs ${vehicleOptions.length > 0 ? "text-emerald-700" : "text-red-600"}`}>
            {vehicleOptions.length > 0
              ? `${vehicleOptions.length} vehicle${vehicleOptions.length === 1 ? "" : "s"} found.`
              : `No active vehicle matched “${vehicleQuery}”.`}
          </p>
        )}
      </div>

      <InspectionForm vehicleOptions={vehicleOptions} currentUser={{ id: user.id, name: user.name }} />
    </div>
  );
}
