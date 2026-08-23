import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Car, Edit, ClipboardCheck, Calendar, Shield, Gauge, Wrench, FileText } from "lucide-react";
import { PageHeader, Card, Badge, Button, EmptyState } from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/utils";
import { getVehicleDetail } from "../server";
import { getCurrentUser, canEditVehicles } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const editable = canEditVehicles(user);
  const detail = await getVehicleDetail(id);
  if (!detail) notFound();
  const { vehicle: v, inspections } = detail;

  const latest = inspections[0];

  return (
    <div className="p-6 lg:p-10">
      <Link href="/vehicles" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> All vehicles
      </Link>

      <PageHeader
        eyebrow="Vehicle Profile"
        title={`${v.make} ${v.model || ""}`}
        description={`Registration ${v.registrationNumber}${v.vin ? ` · VIN ${v.vin}` : ""}`}
        action={
          <div className="flex items-center gap-2">
            <Badge tone={v.status === "active" ? "emerald" : v.status === "failed" ? "red" : "slate"}>
              {v.status.replace("_", " ")}
            </Badge>
            {editable && (
              <Link href={`/vehicles/${id}/edit`}>
                <Button><Edit className="h-4 w-4" /> Edit</Button>
              </Link>
            )}
            <Link href={`/inspections/new?vehicleId=${id}`}>
              <Button variant="success"><ClipboardCheck className="h-4 w-4" /> New Inspection</Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-950 mb-4">Basic Details</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <Info icon={<Car />} label="Registration" value={v.registrationNumber} />
            <Info icon={<Car />} label="Old Registration" value={v.oldRegistrationNumber} />
            <Info icon={<Car />} label="Make" value={v.make} />
            <Info icon={<Car />} label="Model" value={v.model} />
            <Info icon={<Car />} label="Variant" value={v.variant} />
            <Info icon={<Car />} label="Body Type" value={v.bodyType} />
            <Info icon={<Car />} label="Category" value={v.category} />
            <Info icon={<Car />} label="Class" value={v.vehicleClass} />
            <Info icon={<Car />} label="Colour" value={v.colour} />
            <Info icon={<Calendar />} label="Mfg. Year" value={v.manufacturingYear?.toString()} />
            <Info icon={<Car />} label="Country" value={v.countryOfManufacture} />
            <Info icon={<Wrench />} label="Fuel" value={v.fuelType} />
            <Info icon={<Wrench />} label="Transmission" value={v.transmission} />
            <Info icon={<Wrench />} label="Engine #" value={v.engineNumber} />
            <Info icon={<Wrench />} label="Chassis #" value={v.chassisNumber} />
            <Info icon={<Wrench />} label="VIN" value={v.vin} />
            <Info icon={<Gauge />} label="Engine Capacity" value={v.engineCapacity ? `${v.engineCapacity} cc` : null} />
            <Info icon={<Car />} label="Seating" value={v.seatingCapacity?.toString()} />
            <Info icon={<Car />} label="Gross Weight" value={v.grossWeight ? `${v.grossWeight} kg` : null} />
            <Info icon={<Car />} label="Net Weight" value={v.netWeight ? `${v.netWeight} kg` : null} />
            <Info icon={<Car />} label="Axles" value={v.numberOfAxles?.toString()} />
            <Info icon={<Gauge />} label="Odometer" value={v.odometerReading ? `${v.odometerReading.toLocaleString()} km` : null} />
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-slate-950 mb-4">Ownership</h2>
            <dl className="space-y-2 text-sm">
              <Info icon={<Shield />} label="Owner Name" value={v.ownerName} />
              <Info icon={<Shield />} label="Owner Contact" value={v.ownerContact} />
              <Info icon={<FileText />} label="Insurance Co." value={v.insuranceCompany} />
              <Info icon={<FileText />} label="Policy #" value={v.policyNumber} />
            </dl>
          </Card>
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-slate-950 mb-4">Expiry Dates</h2>
            <ul className="space-y-2 text-sm">
              <ExpiryRow label="Insurance" date={v.insuranceExpiry} />
              <ExpiryRow label="Roadworthy" date={v.roadworthyExpiry} />
              <ExpiryRow label="Road Fund" date={v.roadFundExpiry} />
            </ul>
          </Card>
        </div>
      </div>

      <div className="mt-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Inspection History</h2>
              <p className="text-sm text-slate-500">{inspections.length} inspection{inspections.length === 1 ? "" : "s"} on record</p>
            </div>
          </div>
          {inspections.length === 0 ? (
            <EmptyState icon={<ClipboardCheck className="h-8 w-8" />} title="No inspections yet" description="Start a new inspection from the button above." />
          ) : (
            <div className="space-y-2">
              {inspections.map((i) => (
                <Link key={i.id} href={`/inspections/${i.id}`} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50">
                  <div>
                    <p className="font-medium">{i.inspectionNumber}</p>
                    <p className="text-xs text-slate-500">{formatDateTime(i.inspectionDate)} · {i.inspectorName || "Inspector"}</p>
                  </div>
                  <ResultBadge result={i.overallResult} />
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
        {icon && <span className="text-slate-400 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
        {label}
      </dt>
      <dd className="mt-0.5 text-slate-900 font-medium">{value || "—"}</dd>
    </div>
  );
}

function ExpiryRow({ label, date }: { label: string; date?: string | null }) {
  if (!date) return <li className="flex justify-between"><span className="text-slate-500">{label}</span><span className="text-slate-400">—</span></li>;
  const d = new Date(date);
  const now = new Date();
  const days = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const tone = days < 0 ? "red" : days < 30 ? "amber" : "emerald";
  const toneClass = tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-700" : "text-emerald-700";
  return (
    <li className="flex justify-between items-center">
      <span className="text-slate-500">{label}</span>
      <span className={`font-medium ${toneClass}`}>
        {formatDate(date)} <span className="text-xs">({days >= 0 ? `${days}d` : `expired`})</span>
      </span>
    </li>
  );
}

function ResultBadge({ result }: { result: string }) {
  const map: Record<string, { tone: "emerald" | "red" | "amber" | "slate"; label: string }> = {
    pass: { tone: "emerald", label: "Pass" }, fail: { tone: "red", label: "Fail" }, conditional_pass: { tone: "amber", label: "Conditional" }, reinspection_required: { tone: "amber", label: "Re-inspect" },
  };
  const m = map[result] || { tone: "slate" as const, label: result };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}
