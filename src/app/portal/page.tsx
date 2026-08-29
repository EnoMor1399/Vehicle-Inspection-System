import { db } from "@/db";
import { dailyInspections, inspections, transporters, vehicles } from "@/db/schema";
import { asc, desc, eq, isNull } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader, Card, Badge } from "@/components/ui";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";
import Link from "next/link";
import { TransporterPortalAnalytics } from "./TransporterPortalAnalytics";

export const dynamic = "force-dynamic";

export default async function PortalPage({
  searchParams,
}: {
  searchParams?: Promise<{ transporterId?: string }>;
}) {
  const user = await getCurrentUser();
  const isTransporterUser = user.role === "transporter_user";
  const isSuperAdmin = user.role === "super_admin";

  if (!isTransporterUser && !isSuperAdmin) {
    return (
      <div className="p-6 lg:p-10">
        <PageHeader title="Transporter Portal" description="This portal is reserved for transporter portal accounts and Super Administrator oversight." />
        <Card className="p-8">
          <p className="text-slate-700">
            You are signed in as <strong>{user.name}</strong>. Use the main VIMS workspace for the modules assigned to your role.
          </p>
        </Card>
      </div>
    );
  }

  const params = searchParams ? await searchParams : {};
  const requestedTransporterId = isSuperAdmin ? params.transporterId?.trim() || null : null;

  if (isSuperAdmin && !requestedTransporterId) {
    const transporterDirectory = await db
      .select({
        id: transporters.id,
        companyName: transporters.companyName,
        region: transporters.region,
        district: transporters.district,
        contactPerson: transporters.contactPerson,
      })
      .from(transporters)
      .where(isNull(transporters.deletedAt))
      .orderBy(asc(transporters.companyName));

    return (
      <div className="p-4 sm:p-6 lg:p-10">
        <PageHeader
          eyebrow="Super Administrator"
          title="Transporter Portal Directory"
          description="Open any transporter workspace for scoped operational analytics and administrative oversight."
        />

        <Card className="mb-6 border-amber-200 bg-amber-50/70 p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div>
              <p className="font-semibold text-slate-950">Full oversight mode</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                Selecting a transporter opens the same scoped analytics portal that transporter users see while your Super Administrator privileges remain active.
              </p>
            </div>
          </div>
        </Card>

        {transporterDirectory.length === 0 ? (
          <Card className="p-8 text-center text-sm text-slate-500">No active transporter profiles are available.</Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {transporterDirectory.map((transporter) => (
              <Link key={transporter.id} href={`/portal?transporterId=${encodeURIComponent(transporter.id)}`}>
                <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md">
                  <div className="flex items-start gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white">
                      <Truck className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-950">{transporter.companyName}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {[transporter.region, transporter.district].filter(Boolean).join(" · ") || "Location not specified"}
                      </p>
                      {transporter.contactPerson && <p className="mt-2 text-sm text-slate-600">{transporter.contactPerson}</p>}
                    </div>
                  </div>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-emerald-700">Open analytics workspace →</p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  const transporterId = isSuperAdmin ? requestedTransporterId : user.transporterId;
  if (!transporterId) {
    return (
      <div className="p-6 lg:p-10">
        <PageHeader title="Transporter Portal" description="Your account is not yet linked to a transporter profile." />
        <Card className="p-8">
          <p className="text-slate-700">Ask a VIMS administrator to link this account to the correct transporter before fleet information can be displayed.</p>
        </Card>
      </div>
    );
  }

  const [matchedTransporter] = await db.select().from(transporters).where(eq(transporters.id, transporterId));
  if (!matchedTransporter || matchedTransporter.deletedAt) {
    return (
      <div className="p-6 lg:p-10">
        <Card className="p-8"><p>The selected transporter profile is unavailable.</p></Card>
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
  const clearedPreTrips = preTripInspections.filter((row) => row.inspection.clearedForTrip).length;
  const availableStatuses = new Set(["active", "passed"]);
  const availableVehicles = fleet.filter((vehicle) => availableStatuses.has(vehicle.status)).length;
  const unavailableVehicles = Math.max(0, fleet.length - availableVehicles);

  const now = new Date();
  const in60Days = new Date(now.getTime() + 60 * 24 * 3600 * 1000);
  const trackedDocuments = fleet.flatMap((vehicle) => [
    { vehicleId: vehicle.id, registrationNumber: vehicle.registrationNumber, label: "Insurance", date: vehicle.insuranceExpiry },
    { vehicleId: vehicle.id, registrationNumber: vehicle.registrationNumber, label: "Roadworthy", date: vehicle.roadworthyExpiry },
    { vehicleId: vehicle.id, registrationNumber: vehicle.registrationNumber, label: "Road Fund", date: vehicle.roadFundExpiry },
  ]).filter((document): document is { vehicleId: string; registrationNumber: string; label: string; date: string } => Boolean(document.date));

  const expiredDocuments = trackedDocuments
    .filter((document) => new Date(document.date) < now)
    .sort((a, b) => a.date.localeCompare(b.date));
  const expiringDocuments = trackedDocuments
    .filter((document) => {
      const expires = new Date(document.date);
      return expires >= now && expires <= in60Days;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const technicalByVehicle = new Map<string, { total: number; passed: number }>();
  for (const row of technicalInspections) {
    const current = technicalByVehicle.get(row.vehicle.id) || { total: 0, passed: 0 };
    current.total += 1;
    if (row.inspection.overallResult === "pass") current.passed += 1;
    technicalByVehicle.set(row.vehicle.id, current);
  }

  const preTripByVehicle = new Map<string, { total: number; cleared: number }>();
  for (const row of preTripInspections) {
    const current = preTripByVehicle.get(row.vehicle.id) || { total: 0, cleared: 0 };
    current.total += 1;
    if (row.inspection.clearedForTrip) current.cleared += 1;
    preTripByVehicle.set(row.vehicle.id, current);
  }

  const vehicleAnalytics = fleet.map((vehicle) => {
    const technical = technicalByVehicle.get(vehicle.id) || { total: 0, passed: 0 };
    const preTrip = preTripByVehicle.get(vehicle.id) || { total: 0, cleared: 0 };
    const technicalPassRate = percent(technical.passed, technical.total);
    const clearanceRate = percent(preTrip.cleared, preTrip.total);
    const availabilityScore = availableStatuses.has(vehicle.status) ? 100 : vehicle.status === "under_inspection" ? 60 : 0;
    const components = [{ value: availabilityScore, weight: 35 }];
    if (technical.total > 0) components.push({ value: technicalPassRate, weight: 40 });
    if (preTrip.total > 0) components.push({ value: clearanceRate, weight: 25 });
    const totalWeight = components.reduce((sum, item) => sum + item.weight, 0);
    const readinessScore = Math.round(components.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight);
    return {
      id: vehicle.id,
      registrationNumber: vehicle.registrationNumber,
      status: vehicle.status,
      technical: technical.total,
      technicalPassRate,
      preTrip: preTrip.total,
      clearanceRate,
      readinessScore,
      hasActivity: technical.total + preTrip.total > 0,
    };
  });

  const technicalPassRate = percent(passCount, technicalInspections.length);
  const tripClearanceRate = percent(clearedPreTrips, preTripInspections.length);
  const fleetAvailabilityRate = percent(availableVehicles, fleet.length);
  const scoreComponents: { value: number; weight: number }[] = [];
  if (fleet.length > 0) scoreComponents.push({ value: fleetAvailabilityRate, weight: 35 });
  if (technicalInspections.length > 0) scoreComponents.push({ value: technicalPassRate, weight: 40 });
  if (preTripInspections.length > 0) scoreComponents.push({ value: tripClearanceRate, weight: 25 });
  const scoreWeight = scoreComponents.reduce((sum, item) => sum + item.weight, 0);
  const operationalScore = scoreWeight
    ? Math.round(scoreComponents.reduce((sum, item) => sum + item.value * item.weight, 0) / scoreWeight)
    : 0;

  const technicalByMonth = new Map<string, { total: number; passed: number }>();
  for (const row of technicalInspections) {
    const date = new Date(row.inspection.inspectionDate);
    const key = monthKey(date);
    const current = technicalByMonth.get(key) || { total: 0, passed: 0 };
    current.total += 1;
    if (row.inspection.overallResult === "pass") current.passed += 1;
    technicalByMonth.set(key, current);
  }

  const preTripByMonth = new Map<string, { total: number; cleared: number }>();
  for (const row of preTripInspections) {
    const date = new Date(`${row.inspection.inspectionDate}T12:00:00Z`);
    const key = monthKey(date);
    const current = preTripByMonth.get(key) || { total: 0, cleared: 0 };
    current.total += 1;
    if (row.inspection.clearedForTrip) current.cleared += 1;
    preTripByMonth.set(key, current);
  }

  const monthFormatter = new Intl.DateTimeFormat("en", { month: "short" });
  const trend = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + index, 1));
    const key = monthKey(date);
    const technical = technicalByMonth.get(key) || { total: 0, passed: 0 };
    const preTrip = preTripByMonth.get(key) || { total: 0, cleared: 0 };
    return {
      month: key,
      label: monthFormatter.format(date),
      technical: technical.total,
      technicalPassed: technical.passed,
      preTrip: preTrip.total,
      clearedTrips: preTrip.cleared,
    };
  });

  return (
    <div className="p-4 sm:p-6 lg:p-10">
      {isSuperAdmin && (
        <Link href="/portal" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-950">
          <ArrowLeft className="h-4 w-4" /> Back to transporter directory
        </Link>
      )}

      <PageHeader
        eyebrow={isSuperAdmin ? "Super Admin · Transporter Preview" : "Transporter Portal"}
        title={matchedTransporter.companyName}
        description={
          isSuperAdmin
            ? "Scoped analytics for this transporter's fleet availability, technical readiness, Pre-Trip clearance and compliance exposure."
            : "Fleet performance, inspection readiness, trip clearance and compliance insights for your transport operation."
        }
      />

      <nav className="mb-6 flex flex-wrap gap-2" aria-label="Transporter portal sections">
        {[
          ["#overview", "Analytics"],
          ["#fleet", "Fleet"],
          ["#inspections", "Technical Inspections"],
          ["#pre-trip", "Pre-Trip / Safe-To-Load"],
          ["#documents", "Documents"],
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
        <TransporterPortalAnalytics
          metrics={{
            fleetSize: fleet.length,
            availableVehicles,
            unavailableVehicles,
            technicalInspections: technicalInspections.length,
            technicalPassed: passCount,
            preTripInspections: preTripInspections.length,
            clearedPreTrips,
            expiringDocuments: expiringDocuments.length,
            expiredDocuments: expiredDocuments.length,
            operationalScore,
          }}
          trend={trend}
          vehicles={vehicleAnalytics}
        />

        <Card className={`mt-6 overflow-hidden p-5 ${isSuperAdmin ? "border-amber-200 bg-amber-50/60" : "border-emerald-200 bg-emerald-50/60"}`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white ${isSuperAdmin ? "bg-amber-600" : "bg-emerald-600"}`}>
                {isSuperAdmin ? <ShieldCheck className="h-5 w-5" /> : <Truck className="h-5 w-5" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-950">{isSuperAdmin ? "Super Administrator oversight" : "Private transporter analytics"}</p>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">
                  {isSuperAdmin
                    ? `All analytics above are calculated only from records linked to ${matchedTransporter.companyName}.`
                    : `This workspace is restricted to ${matchedTransporter.companyName}. Other transporters, internal administration and system configuration are not exposed.`}
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Signed in as</p>
              <p className="font-semibold text-slate-900">{user.name}</p>
            </div>
          </div>
        </Card>
      </section>

      <section id="fleet" className="mt-8 scroll-mt-24">
        <SectionHeading eyebrow="Fleet" title={isSuperAdmin ? "Fleet Vehicles" : "My Vehicles"} badge={`${fleet.length} vehicles`} tone="blue" />
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
                    <th className="px-4 py-3 text-left">Readiness</th>
                    <th className="px-4 py-3 text-left">Roadworthy</th>
                  </tr>
                </thead>
                <tbody>
                  {fleet.map((vehicle) => {
                    const analytics = vehicleAnalytics.find((item) => item.id === vehicle.id);
                    return (
                      <tr key={vehicle.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                        <td className="px-4 py-3 font-semibold text-slate-950">
                          <Link href={`/vehicles/${vehicle.id}`} className="hover:text-emerald-700">{vehicle.registrationNumber}</Link>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{vehicle.make} {vehicle.model || ""}</td>
                        <td className="px-4 py-3 text-slate-600">{vehicle.vehicleClass || vehicle.category || "—"}</td>
                        <td className="px-4 py-3">
                          <Badge tone={availableStatuses.has(vehicle.status) ? "emerald" : vehicle.status === "failed" || vehicle.status === "suspended" ? "red" : "slate"}>
                            {vehicle.status.replaceAll("_", " ")}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{analytics?.hasActivity ? `${analytics.readinessScore}%` : "No inspection data"}</td>
                        <td className="px-4 py-3 text-slate-600">{vehicle.roadworthyExpiry ? formatDate(vehicle.roadworthyExpiry) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>

      <section id="inspections" className="mt-8 scroll-mt-24">
        <SectionHeading eyebrow="Technical Compliance" title="Technical Inspection History" badge={`${passCount} passed`} tone="emerald" secondaryBadge={failCount > 0 ? `${failCount} failed` : undefined} />
        <Card className="overflow-hidden">
          {technicalInspections.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">No technical inspections are on record for this fleet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {technicalInspections.slice(0, 25).map((row) => (
                <Link key={row.inspection.id} href={`/inspections/${row.inspection.id}`} className="flex flex-col gap-2 p-4 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between">
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
        <SectionHeading eyebrow="Daily Safety" title="Pre-Trip / Safe-To-Load History" badge={`${clearedPreTrips} cleared`} tone="emerald" secondaryBadge={`${Math.max(0, preTripInspections.length - clearedPreTrips)} grounded`} />
        <Card className="overflow-hidden">
          {preTripInspections.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">No Pre-Trip inspections are on record for this fleet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {preTripInspections.slice(0, 30).map((row) => (
                <Link key={row.inspection.id} href={`/daily-inspections/${row.inspection.id}`} className="flex flex-col gap-2 p-4 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between">
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
                    <Badge tone={row.inspection.clearedForTrip ? "emerald" : "red"}>{row.inspection.clearedForTrip ? "Cleared" : "Grounded"}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </section>

      <section id="documents" className="mt-8 scroll-mt-24">
        <SectionHeading eyebrow="Documents" title="Fleet Document Exposure" badge={`${expiringDocuments.length} due ≤60 days`} tone={expiringDocuments.length ? "amber" : "emerald"} secondaryBadge={expiredDocuments.length ? `${expiredDocuments.length} expired` : undefined} />
        <Card className="p-5 sm:p-6">
          {expiredDocuments.length === 0 && expiringDocuments.length === 0 ? (
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              No tracked fleet documents are expired or due within the next 60 days.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {expiredDocuments.map((document) => (
                <DocumentCard key={`expired-${document.vehicleId}-${document.label}`} document={document} expired />
              ))}
              {expiringDocuments.map((document) => (
                <DocumentCard key={`due-${document.vehicleId}-${document.label}`} document={document} />
              ))}
            </div>
          )}
        </Card>
      </section>

      <Card className="mt-8 p-5 text-sm text-slate-600">
        <div className="flex items-start gap-3">
          <ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
          <p>
            {isSuperAdmin
              ? "You are in Super Administrator oversight mode. Use the full VIMS navigation for master-record or account administration."
              : "Need a vehicle, transporter profile or inspection record corrected? Contact the VIMS operations team. Transporter accounts intentionally cannot edit master records or system configuration."}
          </p>
        </div>
      </Card>
    </div>
  );
}

function percent(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function SectionHeading({
  eyebrow,
  title,
  badge,
  tone,
  secondaryBadge,
}: {
  eyebrow: string;
  title: string;
  badge: string;
  tone: "blue" | "emerald" | "amber";
  secondaryBadge?: string;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{eyebrow}</p>
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">{title}</h2>
      </div>
      <div className="flex gap-2">
        <Badge tone={tone}>{badge}</Badge>
        {secondaryBadge && <Badge tone={secondaryBadge.includes("expired") || secondaryBadge.includes("failed") || secondaryBadge.includes("grounded") ? "red" : "slate"}>{secondaryBadge}</Badge>}
      </div>
    </div>
  );
}

function DocumentCard({
  document,
  expired = false,
}: {
  document: { vehicleId: string; registrationNumber: string; label: string; date: string };
  expired?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${expired ? "border-rose-200 bg-rose-50/70" : "border-amber-200 bg-amber-50/60"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-950">{document.registrationNumber}</p>
          <p className="mt-1 text-sm text-slate-600">{document.label}</p>
        </div>
        <FileText className={`h-5 w-5 ${expired ? "text-rose-700" : "text-amber-700"}`} />
      </div>
      <p className={`mt-3 text-xs font-semibold uppercase tracking-wider ${expired ? "text-rose-800" : "text-amber-800"}`}>
        {expired ? "Expired" : "Expires"} {formatDate(document.date)}
      </p>
    </div>
  );
}