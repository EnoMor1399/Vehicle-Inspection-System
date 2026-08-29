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
      <Link href="/inspections" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to inspections
      </Link>
      <PageHeader
        eyebrow="New Inspection"
        title="Vehicle Inspection Checklist"
        description="Complete all 16 sections (A–P). Each item supports pass / fail / N/A, severity classification and remarks."
      />

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600">Vehicle Lookup</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">Find vehicle by registration number</h2>
            <p className="mt-1 text-sm text-slate-500">Enter all or part of the vehicle number before starting the inspection.</p>
          </div>

          <form method="get" className="flex w-full max-w-xl flex-col gap-2 sm:flex-row">
            <label className="relative flex-1">
              <span className="sr-only">Search vehicle registration number</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                name="q"
                defaultValue={vehicleQuery}
                placeholder="e.g. GN 1234-24"
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
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <X className="h-4 w-4" /> Clear
              </Link>
            )}
          </form>
        </div>

        {vehicleQuery && (
          <div className={`mt-4 rounded-xl px-4 py-3 text-sm ${vehicleOptions.length > 0 ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
            {vehicleOptions.length > 0
              ? `${vehicleOptions.length} matching vehicle${vehicleOptions.length === 1 ? "" : "s"} found. Select the correct vehicle in Section A below.`
              : `No active vehicle matched “${vehicleQuery}”. Check the registration number or clear the search to view all vehicles.`}
          </div>
        )}
      </section>

      <InspectionForm vehicleOptions={vehicleOptions} currentUser={{ id: user.id, name: user.name }} />
    </div>
  );
}
