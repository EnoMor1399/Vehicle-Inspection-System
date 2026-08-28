import { db } from "@/db";
import { dailyInspections, inspections, transporters, vehicles } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader, Card, Badge, StatCard } from "@/components/ui";
import {
  Activity,
  Calendar,
  Car,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  ShieldCheck,
  Truck,
  XCircle,
} from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const user = await getCurrentUser();
  if (user.role !== "transporter_user") {
    return (
      <div className="p-6 lg:p-10">
        <PageHeader title="Transporter Portal" description="This portal is reserved for transporter portal accounts." />
        <Card className="p-8">
          <p className="text-slate-700">
            You are signed in as <strong>{user.name}</strong>. Use the main VIMS workspace for your assigned staff functions.
          </p>
        </Card>
      </div>
    );
  }

  if (!user.transporterId) {
    return (
      <div className="p-6 lg:p-10">
        <PageHeader title="Transporter Portal" description="Your account is not yet linked to a transporter profile." />
        <Card className="p-8">
          <p className="text-slate-700">Ask a VIMS administrator to link this account to the correct transporter before fleet information can be displayed.</p>
        </Card>
      </div>
    );
  }

  const [matchedTransporter] = await db.select().from(transporters).where(eq(transporters.id, user.transporterId));
  if (!matchedTransporter || matchedTransporter.deletedAt) {
    return (
      <div className="p-6 lg:p-10">
        <Card className="p-8"><p>The linked transporter profile is unavailable. Contact a VIMS administrator.</p></Card>
      </div>
    );
  }

  const fleet = await db.select().from(vehicles).where(eq(vehicles.transporterId, matchedTransporter.id));
  const vehicleIds = fleet.map((vehicle) => vehicle.id);

  const [technicalInspections, preTripInspections] = vehicleIds.length
    ? await Promise.all([
        db
          .select({ inspection: inspections, vehicle: vehicles })
          .from(inspections)
          .innerJoin(vehicles, eq(vehicles.id, inspections.vehicleId))
          .where(eq(vehicles.transporterId, matchedTransporter.id))
          .orderBy(desc(inspections.inspectionDate)),
        db
          .select({ inspection: dailyInspections, vehicle: vehicles })
          .from(dailyInspections)
          .innerJoin(vehicles, eq(vehicles.id, dailyInspections.vehicleId))
          .where(eq(vehicles.transporterId, matchedTransporter.id))
          .orderBy(desc(dailyInspections.inspectionDate), desc(dailyInspections.completedAt)),
      ])
    : [[], []];

  const passCount = technicalInspections.filter((row) => row.inspection.overallResult === "pass").length;
  const failCount = technicalInspections.filter((row) => row.inspection.overallResult === "fail").length;
  const complianceRate = technicalInspections.length ? Math.round((passCount / technicalInspections.length) * 100) : 0;
  const active = fleet.filter((vehicle) => vehicle.status === "active").length;
  const suspended = fleet.filter((vehicle) => vehicle.status === "suspended" || vehicle.status === "failed").length;
  const clearedPreTrips = preTripInspections.filter((row) => row.inspection.clearedForTrip).length;

  const now = new Date();
  const in60Days = new Date(now.getTime() + 60 * 24 * 3600 * 1000);
  const expiringDocuments = fleet.flatMap((vehicle) => {
    const documents = [
      { label: "Insurance", date: vehicle.insuranceExpiry },
      { label: "Roadworthy", date: vehicle.roadworthyExpiry },
      { label: "Road Fund", date: vehicle.roadFundExpiry },
    ];
    return documents
      .filter((document) => {
        if (!document.date) return false;
        const expires = new Date(document.date);
        return expires >= now && expires <= in60Days;
      })
      .map((document) => ({
        vehicleId: vehicle.id,
        registrationNumber: vehicle.registrationNumber,
        label: document.label,
        date: document.date as string,
      }));
  }).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="p-4 sm:p-6 lg:p-10">
      <PageHeader
        eyebrow="Transporter Portal"
        title={matchedTransporter.companyName}
        description="Your fleet, inspection status, Pre-Trip clearance and compliance documents in one restricted workspace."
      />

      <nav className="mb-6 flex flex-wrap gap-2" aria-label="Transporter portal sections">
        {[
          ["#overview", "Overview"],
          ["#fleet", "My Fleet"],
          ["#inspections", "Inspection History"],
          ["#pre-trip", "Pre-Trip / Safe-To-Load"],
          ["#documents", "Expiring Documents"],
        ].map(([href, label]) => (
          <a
            key={href}
            href={href}
            className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
          >
            {label}
          </a>
        ))}
      </nav>

      <section id="overview" className="scroll-mt-24">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Fleet Size" value={fleet.length} tone="blue" icon={<Car className="h-5 w-5" />} />
          <StatCard label="Active Vehicles" value={active} tone="emerald" icon={<CheckCircle2 className="h-5 w-5" />} />
          <StatCard label="Suspended / Failed" value={suspended} tone="red" icon={<XCircle className="h-5 w-5" />} />
          <StatCard label="Inspection Compliance" value={`${complianceRate}%`} tone={complianceRate >= 70 ? "emerald" : "amber"} icon={<ShieldCheck className="h-5 w-5" />} />
          <StatCard label="Pre-Trips Cleared" value={clearedPreTrips} tone="emerald" icon={<Activity className="h-5 w-5" />} />
          <StatCard label="Expiring ≤ 60 Days" value={expiringDocuments.length} tone="amber" icon={<Calendar className="h-5 w-5" />} />
        </div>

        <Card className="mt-6 overflow-hidden border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-teal-50 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-950">Restricted transporter access</p>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">
                  This portal shows only records linked to <strong>{matchedTransporter.companyName}</strong>. Administrative configuration, other transporters, internal analytics controls and staff functions are not available to this account.
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Signed in as</p>
              <p className="mt-0.5 font-semibold text-slate-900">{user.name}</p>
            </div>
          </div>
        </Card>
      </section>

      <section id="fleet" className="mt-8 scroll-mt-24">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Fleet</p>
            <h2 className="text-xl font-semibold tracking-tight text-slate-950">My Vehicles</h2>
          </div>
          <Badge tone="blue">{fleet.length} vehicles</Badge>
        </div>
        <Card className="overflow-hidden">
          {fleet.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">No vehicles are linked to this transporter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Registration</th>
                    <th className="px-4 py-3 text-left">Vehicle</th>
                    <th className="px-4 py-3 text-left">Class</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Roadworthy</th>
                  </tr>
                </thead>
                <tbody>
                  {fleet.map((vehicle) => (
                    <tr key={vehicle.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3 font-semibold text-slate-950">{vehicle.registrationNumber}</td>
                      <td className="px-4 py-3 text-slate-700">{vehicle.make} {vehicle.model || ""}</td>
                      <td className="px-4 py-3 text-slate-600">{vehicle.vehicleClass || vehicle.category || "—"}</td>
                      <td className="px-4 py-3">
                        <Badge tone={vehicle.status === "active" ? "emerald" : vehicle.status === "failed" ? "red" : "slate"}>
                          {vehicle.status.replaceAll("_", " ")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{vehicle.roadworthyExpiry ? formatDate(vehicle.roadworthyExpiry) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>

      <section id="inspections" className="mt-8 scroll-mt-24">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">Compliance</p>
            <h2 className="text-xl font-semibold tracking-tight text-slate-950">Technical Inspection History</h2>
          </div>
          <div className="flex gap-2">
            <Badge tone="emerald">{passCount} passed</Badge>
            {failCount > 0 && <Badge tone="red">{failCount} failed</Badge>}
          </div>
        </div>
        <Card className="overflow-hidden">
          {technicalInspections.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">No technical inspections are on record for your fleet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {technicalInspections.slice(0, 25).map((row) => (
                <Link
                  key={row.inspection.id}
                  href={`/inspections/${row.inspection.id}`}
                  className="flex flex-col gap-2 p-4 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-950">{row.vehicle.registrationNumber} · {row.inspection.inspectionNumber}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{formatDateTime(row.inspection.inspectionDate)} · {row.inspection.station}</p>
                  </div>
                  <Badge tone={row.inspection.overallResult === "pass" ? "emerald" : row.inspection.overallResult === "fail" ? "red" : "amber"}>
                    {row.inspection.overallResult.replaceAll("_", " ")}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </section>

      <section id="pre-trip" className="mt-8 scroll-mt-24">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">Daily Safety</p>
            <h2 className="text-xl font-semibold tracking-tight text-slate-950">Pre-Trip / Safe-To-Load History</h2>
          </div>
          <Badge tone="emerald">{clearedPreTrips} cleared</Badge>
        </div>
        <Card className="overflow-hidden">
          {preTripInspections.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">No Pre-Trip inspections are on record for your fleet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {preTripInspections.slice(0, 30).map((row) => (
                <Link
                  key={row.inspection.id}
                  href={`/daily-inspections/${row.inspection.id}`}
                  className="flex flex-col gap-2 p-4 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold text-slate-950">{row.vehicle.registrationNumber}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatDate(row.inspection.inspectionDate)}{row.inspection.tripPurpose ? ` · ${row.inspection.tripPurpose}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={row.inspection.status === "passed" ? "emerald" : row.inspection.status === "failed" ? "red" : "amber"}>
                      {row.inspection.status.replaceAll("_", " ")}
                    </Badge>
                    <Badge tone={row.inspection.clearedForTrip ? "emerald" : "red"}>
                      {row.inspection.clearedForTrip ? "Cleared" : "Grounded"}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </section>

      <section id="documents" className="mt-8 scroll-mt-24">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Documents</p>
            <h2 className="text-xl font-semibold tracking-tight text-slate-950">Expiring Within 60 Days</h2>
          </div>
          <Badge tone={expiringDocuments.length ? "amber" : "emerald"}>{expiringDocuments.length} due</Badge>
        </div>
        <Card className="p-5 sm:p-6">
          {expiringDocuments.length === 0 ? (
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              No tracked fleet documents expire within the next 60 days.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {expiringDocuments.map((document) => (
                <div key={`${document.vehicleId}-${document.label}`} className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">{document.registrationNumber}</p>
                      <p className="mt-1 text-sm text-slate-600">{document.label}</p>
                    </div>
                    <FileText className="h-5 w-5 text-amber-700" />
                  </div>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-amber-800">Expires {formatDate(document.date)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      <Card className="mt-8 p-5 text-sm text-slate-600">
        <div className="flex items-start gap-3">
          <ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
          <p>
            Need a vehicle, transporter profile or inspection record corrected? Contact the VIMS operations team. Transporter accounts intentionally cannot edit master records or system configuration.
          </p>
        </div>
      </Card>
    </div>
  );
}
