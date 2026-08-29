import { db } from "@/db";
import { vehicles, transporters } from "@/db/schema";
import { and, eq, ilike, isNull, asc } from "drizzle-orm";
import Link from "next/link";
import { ArrowLeft, Search, X } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { requireAuth } from "@/lib/require-auth";
import { getCurrentUser } from "@/lib/auth";
import { DailyInspectionForm } from "../DailyInspectionForm";

export const dynamic = "force-dynamic";

export default async function NewDailyInspectionPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  await requireAuth();
  const user = await getCurrentUser();

  const params = await searchParams;
  const rawQuery = Array.isArray(params.q) ? params.q[0] : params.q;
  const vehicleQuery = (rawQuery || "").trim().slice(0, 32);

  const vehicleOptions = await db
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

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">Vehicle Lookup</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">Find vehicle by registration number</h2>
            <p className="mt-1 text-sm text-slate-500">Search the fleet first so the correct vehicle is selected for today's Pre-Trip / Safe-To-Load check.</p>
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
                className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
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
                href="/daily-inspections/new"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <X className="h-4 w-4" /> Clear
              </Link>
            )}
          </form>
        </div>

        {vehicleQuery && (
          <div className={`mt-4 rounded-xl px-4 py-3 text-sm ${normalized.length > 0 ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
            {normalized.length > 0
              ? `${normalized.length} matching vehicle${normalized.length === 1 ? "" : "s"} found. Select the correct vehicle in Trip Information below.`
              : `No active vehicle matched “${vehicleQuery}”. Check the registration number or clear the search to view all vehicles.`}
          </div>
        )}
      </section>

      <DailyInspectionForm vehicleOptions={normalized} currentUserName={user.name} />
    </div>
  );
}
