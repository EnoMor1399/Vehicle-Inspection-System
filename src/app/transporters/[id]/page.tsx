import { db } from "@/db";
import { transporters, vehicles, inspections, dailyInspections, documents } from "@/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  Building2,
  Calendar,
  Car,
  CheckCircle2,
  ClipboardCheck,
  Edit,
  FileText,
  Gauge,
  Mail,
  MapPin,
  Phone,
  Shield,
  ShieldCheck,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/utils";
import { canEditTransporters, getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

function percent(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function scoreLabel(score: number) {
  if (score >= 90) return "Strong";
  if (score >= 75) return "Stable";
  if (score >= 60) return "Watch";
  return "High risk";
}

function scoreTone(score: number): "emerald" | "blue" | "amber" | "red" {
  if (score >= 90) return "emerald";
  if (score >= 75) return "blue";
  if (score >= 60) return "amber";
  return "red";
}

export default async function TransporterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const editable = canEditTransporters(user);
  if (!editable) notFound();

  const [t] = await db
    .select()
    .from(transporters)
    .where(and(eq(transporters.id, id), isNull(transporters.deletedAt)));
  if (!t) notFound();

  const fleet = await db.select().from(vehicles).where(eq(vehicles.transporterId, id));

  const [technical, preTrips, docs] = fleet.length
    ? await Promise.all([
        db
          .select({ inspection: inspections, vehicle: vehicles })
          .from(inspections)
          .innerJoin(vehicles, eq(inspections.vehicleId, vehicles.id))
          .where(eq(vehicles.transporterId, id))
          .orderBy(desc(inspections.inspectionDate)),
        db
          .select({ inspection: dailyInspections, vehicle: vehicles })
          .from(dailyInspections)
          .innerJoin(vehicles, eq(dailyInspections.vehicleId, vehicles.id))
          .where(eq(vehicles.transporterId, id))
          .orderBy(desc(dailyInspections.inspectionDate), desc(dailyInspections.completedAt)),
        db
          .select()
          .from(documents)
          .where(and(eq(documents.ownerType, "transporter"), eq(documents.ownerId, id)))
          .orderBy(desc(documents.createdAt)),
      ])
    : [
        [],
        [],
        await db
          .select()
          .from(documents)
          .where(and(eq(documents.ownerType, "transporter"), eq(documents.ownerId, id)))
          .orderBy(desc(documents.createdAt)),
      ];

  const passCount = technical.filter((row) => row.inspection.overallResult === "pass").length;
  const nonPassCount = technical.length - passCount;
  const clearedTrips = preTrips.filter((row) => row.inspection.clearedForTrip).length;
  const blockedTrips = preTrips.length - clearedTrips;
  const activeFleet = fleet.filter((vehicle) => vehicle.status === "active").length;
  const unavailableFleet = fleet.length - activeFleet;
  const passRate = percent(passCount, technical.length);
  const clearanceRate = percent(clearedTrips, preTrips.length);
  const fleetActiveRate = percent(activeFleet, fleet.length);

  const components: { value: number; weight: number }[] = [];
  if (fleet.length > 0) components.push({ value: fleetActiveRate, weight: 35 });
  if (technical.length > 0) components.push({ value: passRate, weight: 40 });
  if (preTrips.length > 0) components.push({ value: clearanceRate, weight: 25 });
  const totalWeight = components.reduce((sum, item) => sum + item.weight, 0);
  const operationalScore = totalWeight
    ? Math.round(components.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight)
    : 0;

  const now = new Date();
  const trend = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + index, 1));
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const technicalRows = technical.filter((row) => {
      const value = new Date(row.inspection.inspectionDate);
      return value.getUTCFullYear() === year && value.getUTCMonth() === month;
    });
    const preTripRows = preTrips.filter((row) => {
      const value = new Date(`${row.inspection.inspectionDate}T00:00:00Z`);
      return value.getUTCFullYear() === year && value.getUTCMonth() === month;
    });
    return {
      key: `${year}-${String(month + 1).padStart(2, "0")}`,
      label: new Intl.DateTimeFormat("en", { month: "short" }).format(date),
      technical: technicalRows.length,
      preTrip: preTripRows.length,
    };
  });
  const maxTrend = Math.max(1, ...trend.map((item) => Math.max(item.technical, item.preTrip)));

  const latestTechnicalByVehicle = new Map<string, (typeof technical)[number]>();
  for (const row of technical) {
    if (!latestTechnicalByVehicle.has(row.vehicle.id)) latestTechnicalByVehicle.set(row.vehicle.id, row);
  }
  const latestPreTripByVehicle = new Map<string, (typeof preTrips)[number]>();
  for (const row of preTrips) {
    if (!latestPreTripByVehicle.has(row.vehicle.id)) latestPreTripByVehicle.set(row.vehicle.id, row);
  }

  const statusByVehicle = fleet.map((vehicle) => ({
    vehicle,
    latestTechnical: latestTechnicalByVehicle.get(vehicle.id),
    latestPreTrip: latestPreTripByVehicle.get(vehicle.id),
  }));

  const scoreText =
    operationalScore >= 90
      ? "This transporter is operating with strong fleet availability and compliance performance. Maintain preventive controls and monitor for early deterioration."
      : operationalScore >= 75
        ? "Overall performance is stable. Focus on the weaker of fleet availability, technical pass rate or trip clearance to improve operational reliability."
        : operationalScore >= 60
          ? "Performance requires closer attention. Target maintenance follow-up and recurring failed or uncleared vehicles before they reduce fleet capacity."
          : "The current operating profile indicates elevated risk. Prioritize failed inspections, blocked trips and unavailable vehicles for immediate management action.";

  const scoreGradient = `conic-gradient(#10b981 0 ${operationalScore}%, #e2e8f0 ${operationalScore}% 100%)`;

  return (
    <div className="p-4 sm:p-6 lg:p-10">
      <Link href="/transporters" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-950">
        <ArrowLeft className="h-4 w-4" /> All transporters
      </Link>

      <PageHeader
        title={t.companyName}
        description={`${t.region || "Region not set"}${t.district ? ` · ${t.district}` : ""} · ${fleet.length} registered vehicle${fleet.length === 1 ? "" : "s"}`}
        action={
          <Link href={`/transporters/${id}/edit`}>
            <Button><Edit className="h-4 w-4" /> Edit Profile</Button>
          </Link>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={<Gauge className="h-5 w-5" />} label="Operational Score" value={`${operationalScore}%`} detail={scoreLabel(operationalScore)} tone={scoreTone(operationalScore)} />
        <MetricCard icon={<Car className="h-5 w-5" />} label="Fleet Availability" value={`${fleetActiveRate}%`} detail={`${activeFleet} of ${fleet.length} active`} tone={fleetActiveRate >= 90 ? "emerald" : "amber"} />
        <MetricCard icon={<ShieldCheck className="h-5 w-5" />} label="Technical Pass" value={technical.length ? `${passRate}%` : "—"} detail={`${technical.length} inspections`} tone={passRate >= 85 ? "emerald" : passRate >= 70 ? "amber" : "red"} />
        <MetricCard icon={<Activity className="h-5 w-5" />} label="Trip Clearance" value={preTrips.length ? `${clearanceRate}%` : "—"} detail={`${preTrips.length} Pre-Trip checks`} tone={clearanceRate >= 90 ? "emerald" : clearanceRate >= 75 ? "amber" : "red"} />
        <MetricCard icon={<TriangleAlert className="h-5 w-5" />} label="Attention Items" value={(unavailableFleet + nonPassCount + blockedTrips).toString()} detail="Fleet + inspection exceptions" tone={unavailableFleet + nonPassCount + blockedTrips > 0 ? "red" : "emerald"} />
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[.78fr_1.22fr]">
        <Card className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Performance analysis</h2>
              <p className="mt-1 text-sm text-slate-500">Combined view of readiness, compliance and trip clearance.</p>
            </div>
            <Badge tone={scoreTone(operationalScore)}>{scoreLabel(operationalScore)}</Badge>
          </div>

          <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="relative h-36 w-36 shrink-0 rounded-full" style={{ background: scoreGradient }}>
              <div className="absolute inset-[14px] grid place-items-center rounded-full bg-white text-center shadow-sm">
                <div>
                  <p className="text-3xl font-bold tracking-tight text-slate-950">{operationalScore}%</p>
                  <p className="text-[11px] font-medium text-slate-500">Operational score</p>
                </div>
              </div>
            </div>
            <div className="min-w-0 flex-1 space-y-4">
              <ProgressMetric label="Fleet active" value={fleetActiveRate} detail={`${activeFleet}/${fleet.length}`} tone="blue" />
              <ProgressMetric label="Technical pass" value={passRate} detail={`${passCount}/${technical.length}`} tone="emerald" empty={technical.length === 0} />
              <ProgressMetric label="Trip clearance" value={clearanceRate} detail={`${clearedTrips}/${preTrips.length}`} tone="violet" empty={preTrips.length === 0} />
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex gap-3">
              <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
              <p className="text-sm leading-6 text-slate-650">{scoreText}</p>
            </div>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">12-month activity trend</h2>
              <p className="mt-1 text-sm text-slate-500">Technical inspections compared with Pre-Trip / Safe-To-Load checks.</p>
            </div>
            <Badge tone="violet">{technical.length + preTrips.length} records</Badge>
          </div>

          <div className="mt-6 grid h-56 grid-cols-12 items-end gap-1.5 sm:gap-2">
            {trend.map((item) => (
              <div key={item.key} className="flex h-full min-w-0 flex-col justify-end">
                <div className="flex h-[180px] items-end justify-center gap-0.5">
                  <div className="w-[42%] rounded-t bg-blue-600" style={{ height: `${Math.max(item.technical ? 5 : 0, (item.technical / maxTrend) * 100)}%` }} title={`${item.label}: ${item.technical} technical`} />
                  <div className="w-[42%] rounded-t bg-violet-500" style={{ height: `${Math.max(item.preTrip ? 5 : 0, (item.preTrip / maxTrend) * 100)}%` }} title={`${item.label}: ${item.preTrip} Pre-Trip`} />
                </div>
                <p className="mt-2 truncate text-center text-[10px] text-slate-500">{item.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-600">
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-blue-600" /> Technical inspections</span>
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-violet-500" /> Pre-Trip / Safe-To-Load</span>
          </div>
        </Card>
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <h2 className="text-lg font-semibold text-slate-950">Company information</h2>
          <dl className="mt-4 grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
            <Info icon={<Building2 className="h-3.5 w-3.5" />} label="Registration No." value={t.registrationNumber} />
            <Info icon={<Shield className="h-3.5 w-3.5" />} label="TIN Number" value={t.tinNumber} />
            <Info icon={<MapPin className="h-3.5 w-3.5" />} label="GPS Address" value={t.gpsAddress} />
            <Info icon={<Calendar className="h-3.5 w-3.5" />} label="Insurance Expiry" value={formatDate(t.insuranceExpiry)} />
            <Info icon={<Building2 className="h-3.5 w-3.5" />} label="Contact Person" value={t.contactPerson} />
            <Info icon={<Phone className="h-3.5 w-3.5" />} label="Mobile" value={t.mobile} />
            <Info icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={t.email} />
            <Info icon={<Shield className="h-3.5 w-3.5" />} label="Insurance Company" value={t.insuranceCompany} />
            <div className="sm:col-span-2"><Info icon={<MapPin className="h-3.5 w-3.5" />} label="Physical Address" value={t.physicalAddress} /></div>
          </dl>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-950">Documents</h2>
            <Badge tone={docs.some((doc) => doc.expiryDate && new Date(doc.expiryDate) < now) ? "red" : "slate"}>{docs.length}</Badge>
          </div>
          {docs.length === 0 ? (
            <div className="mt-4"><EmptyState icon={<FileText className="h-8 w-8" />} title="No documents uploaded" description="Company documents will appear here." /></div>
          ) : (
            <ul className="mt-4 space-y-2">
              {docs.slice(0, 6).map((doc) => {
                const expired = Boolean(doc.expiryDate && new Date(doc.expiryDate) < now);
                return (
                  <li key={doc.id} className="rounded-xl border border-slate-100 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">{doc.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{doc.expiryDate ? `Expires ${formatDate(doc.expiryDate)}` : doc.type}</p>
                      </div>
                      <Badge tone={expired ? "red" : "slate"}>{expired ? "Expired" : doc.type}</Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>

      <section className="mt-6">
        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Fleet performance</h2>
                <p className="mt-1 text-sm text-slate-500">Vehicle status with latest technical and Pre-Trip outcomes.</p>
              </div>
              <Badge tone="blue">{fleet.length} vehicles</Badge>
            </div>
          </div>
          {fleet.length === 0 ? (
            <div className="p-6"><EmptyState icon={<Car className="h-8 w-8" />} title="No vehicles registered" description="Link vehicles to this transporter to start performance tracking." /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <tr><th className="px-5 py-3 text-left">Registration</th><th className="px-5 py-3 text-left">Vehicle</th><th className="px-5 py-3 text-left">Status</th><th className="px-5 py-3 text-left">Latest technical</th><th className="px-5 py-3 text-left">Latest Pre-Trip</th><th className="px-5 py-3" /></tr>
                </thead>
                <tbody>
                  {statusByVehicle.map(({ vehicle, latestTechnical, latestPreTrip }) => (
                    <tr key={vehicle.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                      <td className="px-5 py-3 font-semibold text-slate-950">{vehicle.registrationNumber}</td>
                      <td className="px-5 py-3 text-slate-700">{vehicle.make} {vehicle.model || ""}<span className="block text-xs text-slate-400">{vehicle.vehicleClass || vehicle.bodyType || "—"}</span></td>
                      <td className="px-5 py-3"><VehicleStatusBadge status={vehicle.status} /></td>
                      <td className="px-5 py-3">{latestTechnical ? <div className="flex flex-wrap items-center gap-2"><InspectionResultBadge result={latestTechnical.inspection.overallResult} /><span className="text-xs text-slate-400">{formatDate(latestTechnical.inspection.inspectionDate)}</span></div> : <span className="text-xs text-slate-400">No inspection</span>}</td>
                      <td className="px-5 py-3">{latestPreTrip ? <div className="flex flex-wrap items-center gap-2"><Badge tone={latestPreTrip.inspection.clearedForTrip ? "emerald" : "red"}>{latestPreTrip.inspection.clearedForTrip ? "Cleared" : "Blocked"}</Badge><span className="text-xs text-slate-400">{formatDate(latestPreTrip.inspection.inspectionDate)}</span></div> : <span className="text-xs text-slate-400">No Pre-Trip</span>}</td>
                      <td className="px-5 py-3 text-right"><Link href={`/vehicles/${vehicle.id}`} className="font-semibold text-[var(--brand-accent)] hover:opacity-75">View →</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="text-lg font-semibold text-slate-950">Recent technical inspections</h2><p className="mt-1 text-sm text-slate-500">Latest comprehensive inspection outcomes.</p></div>
            <Badge tone="blue"><ClipboardCheck className="h-3.5 w-3.5" /> {technical.length}</Badge>
          </div>
          {technical.length === 0 ? <p className="mt-5 text-sm text-slate-500">No technical inspections recorded.</p> : (
            <div className="mt-4 divide-y divide-slate-100">
              {technical.slice(0, 7).map((row) => (
                <Link key={row.inspection.id} href={`/inspections/${row.inspection.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-slate-50">
                  <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-900">{row.vehicle.registrationNumber} · {row.inspection.inspectionNumber}</p><p className="mt-1 text-xs text-slate-500">{formatDateTime(row.inspection.inspectionDate)}</p></div>
                  <InspectionResultBadge result={row.inspection.overallResult} />
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="text-lg font-semibold text-slate-950">Recent Pre-Trip / Safe-To-Load</h2><p className="mt-1 text-sm text-slate-500">Latest daily clearance decisions.</p></div>
            <Badge tone="violet"><Activity className="h-3.5 w-3.5" /> {preTrips.length}</Badge>
          </div>
          {preTrips.length === 0 ? <p className="mt-5 text-sm text-slate-500">No Pre-Trip checks recorded.</p> : (
            <div className="mt-4 divide-y divide-slate-100">
              {preTrips.slice(0, 7).map((row) => (
                <Link key={row.inspection.id} href={`/daily-inspections/${row.inspection.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-slate-50">
                  <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-900">{row.vehicle.registrationNumber}{row.inspection.driverName ? ` · ${row.inspection.driverName}` : ""}</p><p className="mt-1 text-xs text-slate-500">{formatDate(row.inspection.inspectionDate)}{row.inspection.tripPurpose ? ` · ${row.inspection.tripPurpose}` : ""}</p></div>
                  <Badge tone={row.inspection.clearedForTrip ? "emerald" : "red"}>{row.inspection.clearedForTrip ? "Cleared" : "Blocked"}</Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}

function MetricCard({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: string; detail: string; tone: "blue" | "emerald" | "amber" | "red" | "violet" }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    red: "bg-rose-50 text-rose-700 ring-rose-100",
    violet: "bg-violet-50 text-violet-700 ring-violet-100",
  };
  return <Card className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div><div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ${tones[tone]}`}>{icon}</div></div></Card>;
}

function ProgressMetric({ label, value, detail, tone, empty = false }: { label: string; value: number; detail: string; tone: "blue" | "emerald" | "violet"; empty?: boolean }) {
  const color = tone === "blue" ? "bg-blue-600" : tone === "emerald" ? "bg-emerald-500" : "bg-violet-500";
  return <div><div className="flex items-center justify-between gap-3 text-xs"><span className="font-medium text-slate-700">{label}</span><span className="font-semibold text-slate-900">{empty ? "No data" : `${value}% · ${detail}`}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${empty ? 0 : value}%` }} /></div></div>;
}

function Info({ icon, label, value }: { icon?: React.ReactNode; label: string; value?: string | null }) {
  return <div><dt className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-slate-500">{icon && <span className="text-slate-400">{icon}</span>}{label}</dt><dd className="mt-1 font-medium text-slate-900">{value || "—"}</dd></div>;
}

function VehicleStatusBadge({ status }: { status: string }) {
  const map: Record<string, "emerald" | "red" | "amber" | "blue" | "slate"> = { active: "emerald", passed: "emerald", failed: "red", suspended: "red", under_inspection: "blue", decommissioned: "slate" };
  return <Badge tone={map[status] || "slate"}>{status.replaceAll("_", " ")}</Badge>;
}

function InspectionResultBadge({ result }: { result: string }) {
  const map: Record<string, { tone: "emerald" | "red" | "amber" | "slate"; label: string }> = { pass: { tone: "emerald", label: "Pass" }, fail: { tone: "red", label: "Fail" }, conditional_pass: { tone: "amber", label: "Conditional" }, reinspection_required: { tone: "amber", label: "Re-inspect" } };
  const item = map[result] || { tone: "slate" as const, label: result };
  return <Badge tone={item.tone}>{item.label}</Badge>;
}
