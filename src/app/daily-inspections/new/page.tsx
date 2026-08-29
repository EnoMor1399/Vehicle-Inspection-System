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
      <Link href="/daily-inspections" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Back to Daily Inspections
      </Link>
      <PageHeader
        eyebrow="Pre-Trip Safety Check"
        title="New Daily Inspection"
        description="Complete the pre-trip check before the vehicle leaves the yard."
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
              aria-label="Clear vehicle search"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <X className="h-4 w-4" /> Clear
            </Link>
          )}
        </form>
        {vehicleQuery && (
          <p className={`mt-2 text-xs ${normalized.length > 0 ? "text-emerald-700" : "text-red-600"}`}>
            {normalized.length > 0
              ? `${normalized.length} vehicle${normalized.length === 1 ? "" : "s"} found.`
              : `No active vehicle matched “${vehicleQuery}”.`}
          </p>
        )}
      </div>

      <DailyInspectionForm vehicleOptions={normalized} currentUserName={user.name} />
    </div>
  );
}
