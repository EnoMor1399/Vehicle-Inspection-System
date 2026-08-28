import { db } from "@/db";
import { transporters, vehicles, inspections, documents } from "@/db/schema";
import { eq, isNull, and, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, Phone, Mail, MapPin, Calendar, Shield, Car, Edit, FileText, ClipboardCheck } from "lucide-react";
import { PageHeader, Card, Badge, Button, EmptyState } from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/utils";
import { getCurrentUser, canEditTransporters } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TransporterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const editable = canEditTransporters(user);

  const [t] = await db
    .select()
    .from(transporters)
    .where(and(eq(transporters.id, id), isNull(transporters.deletedAt)));
  if (!t) notFound();

  const fleet = await db.select().from(vehicles).where(eq(vehicles.transporterId, id));

  const insp = fleet.length
    ? await db
        .select()
        .from(inspections)
        .innerJoin(vehicles, eq(inspections.vehicleId, vehicles.id))
        .where(eq(vehicles.transporterId, id))
        .orderBy(desc(inspections.inspectionDate))
    : [];

  const docs = await db
    .select()
    .from(documents)
    .where(and(eq(documents.ownerType, "transporter"), eq(documents.ownerId, id)))
    .orderBy(desc(documents.createdAt));

  const passCount = insp.filter((i) => i.inspections.overallResult === "pass").length;
  const failCount = insp.filter((i) => i.inspections.overallResult === "fail").length;
  const complianceRate = insp.length ? Math.round((passCount / insp.length) * 100) : 0;
  const activeFleet = fleet.filter((v) => v.status === "active").length;
  const suspendedFleet = fleet.filter((v) => v.status === "suspended").length;

  const statusByVehicle = fleet.map((v) => {
    const latest = insp
      .filter((i) => i.vehicles.id === v.id)
      .sort((a, b) => +new Date(b.inspections.inspectionDate) - +new Date(a.inspections.inspectionDate))[0];
    return { vehicle: v, latest };
  });

  return (
    <div className="p-6 lg:p-10">
      <Link href="/transporters" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> All transporters
      </Link>

      <PageHeader
        eyebrow="Transporter Profile"
        title={t.companyName}
        description={`${t.region || "Region not set"}${t.district ? `, ${t.district}` : ""} — ${fleet.length} vehicle${fleet.length === 1 ? "" : "s"} registered`}
        action={
          editable ? (
            <Link href={`/transporters/${id}/edit`}>
              <Button>
                <Edit className="h-4 w-4" /> Edit Profile
              </Button>
            </Link>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4"><p className="text-xs text-slate-500">Fleet Size</p><p className="text-2xl font-semibold mt-1">{fleet.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500">Active Vehicles</p><p className="text-2xl font-semibold mt-1 text-emerald-600">{activeFleet}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500">Suspended</p><p className="text-2xl font-semibold mt-1 text-red-600">{suspendedFleet}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500">Compliance Rate</p><p className="text-2xl font-semibold mt-1">{complianceRate}%</p></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-950 mb-4">Company Information</h2>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <Info icon={<Building2 className="h-3.5 w-3.5" />} label="Registration No." value={t.registrationNumber} />
            <Info icon={<Shield className="h-3.5 w-3.5" />} label="TIN Number" value={t.tinNumber} />
            <Info icon={<MapPin className="h-3.5 w-3.5" />} label="GPS Address" value={t.gpsAddress} />
            <Info icon={<Calendar className="h-3.5 w-3.5" />} label="Insurance Expiry" value={formatDate(t.insuranceExpiry)} />
            <Info icon={<Building2 className="h-3.5 w-3.5" />} label="Contact Person" value={t.contactPerson} />
            <Info icon={<Phone className="h-3.5 w-3.5" />} label="Mobile" value={t.mobile} />
            <Info icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={t.email} />
            <Info icon={<Shield className="h-3.5 w-3.5" />} label="Insurance Company" value={t.insuranceCompany} />
            <div className="col-span-2"><Info icon={<MapPin className="h-3.5 w-3.5" />} label="Physical Address" value={t.physicalAddress} /></div>
          </dl>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-950 mb-4">Documents</h2>
          {docs.length === 0 ? (
            <EmptyState icon={<FileText className="h-8 w-8" />} title="No documents uploaded" description="Upload company registration, insurance, permits." />
          ) : (
            <ul className="space-y-2">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center justify-between p-2 rounded hover:bg-slate-50">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-slate-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{d.name}</p>
                      <p className="text-xs text-slate-500">{d.type}{d.expiryDate ? ` · expires ${formatDate(d.expiryDate)}` : ""}</p>
                    </div>
                  </div>
                  <Badge tone={d.expiryDate && new Date(d.expiryDate) < new Date() ? "red" : "slate"}>{d.type}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Fleet Overview</h2>
              <p className="text-sm text-slate-500">All vehicles registered to {t.companyName}</p>
            </div>
            <Badge tone="violet">{fleet.length} total</Badge>
          </div>
          {fleet.length === 0 ? (
            <EmptyState icon={<Car className="h-8 w-8" />} title="No vehicles registered yet" description="Add vehicles from the Vehicles module and link them to this transporter." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-4">Registration</th>
                    <th className="py-2 pr-4">Make / Model</th>
                    <th className="py-2 pr-4">Body / Class</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Latest Inspection</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {statusByVehicle.map(({ vehicle, latest }) => (
                    <tr key={vehicle.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-3 pr-4 font-medium">{vehicle.registrationNumber}</td>
                      <td className="py-3 pr-4">{vehicle.make} {vehicle.model}</td>
                      <td className="py-3 pr-4 text-slate-600">{vehicle.bodyType} · {vehicle.vehicleClass}</td>
                      <td className="py-3 pr-4"><VehicleStatusBadge status={vehicle.status} /></td>
                      <td className="py-3 pr-4 text-slate-600">
                        {latest ? (
                          <>
                            <InspectionResultBadge result={latest.inspections.overallResult} />{" "}
                            <span className="text-xs text-slate-400">{formatDate(latest.inspections.inspectionDate)}</span>
                          </>
                        ) : <span className="text-slate-400 text-xs">No inspections</span>}
                      </td>
                      <td className="py-3 text-right">
                        <Link href={`/vehicles/${vehicle.id}`} className="text-[var(--brand-accent)] hover:opacity-75 text-sm font-semibold">View →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Inspection History</h2>
              <p className="text-sm text-slate-500">{passCount} passed · {failCount} failed · {insp.length} total</p>
            </div>
            <Badge tone="violet"><ClipboardCheck className="h-3.5 w-3.5" /> {insp.length} records</Badge>
          </div>
          {insp.length === 0 ? (
            <EmptyState icon={<ClipboardCheck className="h-8 w-8" />} title="No inspections recorded" description="Vehicles will appear here once they go through the inspection process." />
          ) : (
            <div className="space-y-2">
              {insp.map((row) => (
                <Link key={row.inspections.id} href={`/inspections/${row.inspections.id}`} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50">
                  <div>
                    <p className="font-medium">{row.inspections.inspectionNumber}</p>
                    <p className="text-xs text-slate-500">{row.vehicles.registrationNumber} · {row.vehicles.make} {row.vehicles.model} · {formatDateTime(row.inspections.inspectionDate)}</p>
                  </div>
                  <InspectionResultBadge result={row.inspections.overallResult} />
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Info({ icon, label, value }: { icon?: React.ReactNode; label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
        {icon && <span className="text-slate-400">{icon}</span>}
        {label}
      </dt>
      <dd className="mt-0.5 text-slate-900 font-medium">{value || "—"}</dd>
    </div>
  );
}

function VehicleStatusBadge({ status }: { status: string }) {
  const map: Record<string, "emerald" | "red" | "amber" | "blue" | "slate"> = {
    active: "emerald", passed: "emerald", failed: "red", suspended: "red", under_inspection: "blue", decommissioned: "slate",
  };
  return <Badge tone={map[status] || "slate"}>{status.replace("_", " ")}</Badge>;
}

function InspectionResultBadge({ result }: { result: string }) {
  const map: Record<string, { tone: "emerald" | "red" | "amber" | "slate"; label: string }> = {
    pass: { tone: "emerald", label: "Pass" }, fail: { tone: "red", label: "Fail" }, conditional_pass: { tone: "amber", label: "Conditional" }, reinspection_required: { tone: "amber", label: "Re-inspect" },
  };
  const m = map[result] || { tone: "slate" as const, label: result };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}
