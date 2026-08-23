import { db } from "@/db";
import { vehicles, inspections, transporters } from "@/db/schema";
import { eq, desc, sql, and, isNull } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader, Card, Badge, StatCard } from "@/components/ui";
import { Truck, Car, CheckCircle2, XCircle, AlertTriangle, Calendar } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

// Transporter portal view — personalized dashboard for transporter_user role
export default async function PortalPage() {
  const user = await getCurrentUser();
  if (user.role !== "transporter_user") {
    return (
      <div className="p-6 lg:p-10">
        <PageHeader title="Transporter Portal" description="This portal is only available to transporter portal users." />
        <Card className="p-8"><p className="text-slate-700">You are logged in as <strong>{user.name}</strong> ({user.role}). Switch to a transporter portal account via the <Link href="/login" className="text-amber-700 underline">login page</Link>.</p></Card>
      </div>
    );
  }

  // Find the transporter associated with this user (by email domain match or direct link)
  const domain = user.email.split("@")[1];
  const allTransporters = await db.select().from(transporters).where(isNull(transporters.deletedAt));
  const matchedTransporter = allTransporters.find((t) => t.email?.endsWith(domain)) || allTransporters[0];
  if (!matchedTransporter) {
    return <div className="p-10"><Card className="p-8"><p>No transporter profile linked to your account.</p></Card></div>;
  }

  const fleet = await db.select().from(vehicles).where(eq(vehicles.transporterId, matchedTransporter.id));
  const vehicleIds = fleet.map((v) => v.id);
  const insp = vehicleIds.length
    ? await db.select().from(inspections).innerJoin(vehicles, eq(vehicles.id, inspections.vehicleId)).where(eq(vehicles.transporterId, matchedTransporter.id)).orderBy(desc(inspections.inspectionDate))
    : [];

  const passCount = insp.filter((i) => i.inspections.overallResult === "pass").length;
  const failCount = insp.filter((i) => i.inspections.overallResult === "fail").length;
  const complianceRate = insp.length ? Math.round((passCount / insp.length) * 100) : 0;
  const active = fleet.filter((v) => v.status === "active").length;
  const suspended = fleet.filter((v) => v.status === "suspended" || v.status === "failed").length;

  const now = new Date();
  const in60 = new Date(now.getTime() + 60 * 24 * 3600 * 1000);
  const expiringCerts = fleet.filter((v) => {
    const dates = [v.insuranceExpiry, v.roadworthyExpiry, v.roadFundExpiry].filter(Boolean) as string[];
    return dates.some((d) => { const x = new Date(d); return x >= now && x <= in60; });
  });

  return (
    <div className="p-6 lg:p-10">
      <PageHeader
        eyebrow="Transporter Portal"
        title={`Welcome, ${matchedTransporter.companyName}`}
        description="Your fleet overview, compliance status and upcoming expiries."
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Fleet Size" value={fleet.length} tone="blue" icon={<Car className="h-5 w-5" />} />
        <StatCard label="Active" value={active} tone="emerald" icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard label="Suspended/Failed" value={suspended} tone="red" icon={<XCircle className="h-5 w-5" />} />
        <StatCard label="Compliance" value={`${complianceRate}%`} tone={complianceRate >= 70 ? "emerald" : "amber"} icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard label="Expiring Certs" value={expiringCerts.length} tone="amber" icon={<Calendar className="h-5 w-5" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-950 mb-4">Your Fleet</h2>
          <div className="space-y-2">
            {fleet.map((v) => {
              const latest = insp.filter((i) => i.vehicles.id === v.id)[0];
              return (
                <Link key={v.id} href={`/vehicles/${v.id}`} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50">
                  <div>
                    <p className="font-medium text-slate-900">{v.registrationNumber} — {v.make} {v.model}</p>
                    <p className="text-xs text-slate-500">{v.bodyType} · {v.vehicleClass}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={v.status === "active" ? "emerald" : v.status === "failed" ? "red" : "slate"}>{v.status}</Badge>
                    {latest && <Badge tone={latest.inspections.overallResult === "pass" ? "emerald" : latest.inspections.overallResult === "fail" ? "red" : "amber"}>{latest.inspections.overallResult.replace("_", " ")}</Badge>}
                  </div>
                </Link>
              );
            })}
            {fleet.length === 0 && <p className="text-sm text-slate-500 py-4 text-center">No vehicles linked to your account.</p>}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-950 mb-4">Recent Inspections</h2>
          <div className="space-y-2">
            {insp.slice(0, 8).map((row) => (
              <Link key={row.inspections.id} href={`/inspections/${row.inspections.id}`} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50">
                <div>
                  <p className="font-medium text-slate-900">{row.inspections.inspectionNumber}</p>
                  <p className="text-xs text-slate-500">{row.vehicles.registrationNumber} · {formatDateTime(row.inspections.inspectionDate)}</p>
                </div>
                <Badge tone={row.inspections.overallResult === "pass" ? "emerald" : row.inspections.overallResult === "fail" ? "red" : "amber"}>
                  {row.inspections.overallResult.replace("_", " ")}
                </Badge>
              </Link>
            ))}
            {insp.length === 0 && <p className="text-sm text-slate-500 py-4 text-center">No inspections on record.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
