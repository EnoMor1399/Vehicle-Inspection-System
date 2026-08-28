import { db } from "@/db";
import { dailyInspections, vehicles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, CheckCircle2, XCircle, AlertTriangle, Minus,
  User, MapPin, ClipboardCheck, AlertOctagon,
} from "lucide-react";
import { PageHeader, Card, Badge } from "@/components/ui";
import { requireAuth } from "@/lib/require-auth";
import { canAccessTransporterScope, getCurrentUser, canApprove as canApproveInspection } from "@/lib/auth";
import { formatDateTime, formatDate } from "@/lib/utils";
import { PhotoGallery } from "@/components/PhotoGallery";
import type { DailyChecklistCategory } from "@/db/schema";
import { ApproveButton } from "../ApproveButton";

export const dynamic = "force-dynamic";

const CATEGORY_ICONS: Record<string, string> = {
  "Tires & Wheels": "🛞",
  Brakes: "🛑",
  "Lights & Signals": "💡",
  "Fluid Levels": "💧",
  Visibility: "👁",
  "Safety & Controls": "🛡",
  "Emergency Equipment": "🚨",
  Documentation: "📄",
  "Exterior & General": "🚛",
};

export default async function DailyInspectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const user = await getCurrentUser();
  const { id } = await params;

  const [row] = await db
    .select({
      inspection: dailyInspections,
      vehicle: vehicles,
    })
    .from(dailyInspections)
    .innerJoin(vehicles, eq(vehicles.id, dailyInspections.vehicleId))
    .where(eq(dailyInspections.id, id));

  if (!row || !canAccessTransporterScope(user, row.vehicle.transporterId)) notFound();

  const { inspection: i, vehicle: v } = row;
  const checklist = (i.checklist || []) as DailyChecklistCategory[];
  const criticalDefects = (i.criticalDefects || []) as { item: string; notes: string; photo?: string }[];
  const canApprove = canApproveInspection(user);
  const isTransporter = user.role === "transporter_user";
  const backHref = isTransporter ? "/portal#pre-trip" : "/daily-inspections";
  const backLabel = isTransporter ? "Back to Transporter Portal" : "Back to Daily Inspections";

  return (
    <div className="p-6 lg:p-10">
      <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> {backLabel}
      </Link>

      <PageHeader
        eyebrow="Daily Pre-Trip Inspection"
        title={`${v.registrationNumber} · ${formatDate(i.inspectionDate)}`}
        description={`${v.make} ${v.model || ""} · Driver: ${i.driverName || "—"}`}
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={i.status} />
            {i.clearedForTrip ? (
              <Badge tone="emerald"><CheckCircle2 className="h-3.5 w-3.5" /> Cleared for Trip</Badge>
            ) : (
              <Badge tone="red"><AlertOctagon className="h-3.5 w-3.5" /> Vehicle Grounded</Badge>
            )}
            {canApprove && !i.supervisorReview && i.status !== "passed" && (
              <ApproveButton inspectionId={i.id} />
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <p className="text-xs text-slate-500">Items Passed</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{i.passedItems}<span className="text-slate-400 text-base font-normal">/{i.totalItems}</span></p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Items Failed</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{i.failedItems}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Checklist Result</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {i.totalItems > 0 ? `${Math.round((i.passedItems / i.totalItems) * 100)}%` : i.clearedForTrip ? "Cleared" : "—"}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Odometer</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {i.odometer ? `${i.odometer.toLocaleString()} km` : "—"}
          </p>
        </Card>
      </div>

      {!i.clearedForTrip && (
        <Card className="p-5 mb-6 bg-gradient-to-br from-red-50 to-orange-50 border-red-300">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-xl bg-red-600 text-white grid place-items-center shrink-0">
              <AlertOctagon className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-red-900">Vehicle Must Not Depart</h2>
              <p className="text-sm text-red-800 mt-1 mb-3">
                Critical safety defects were identified. This vehicle is <strong>grounded</strong> until all critical items are repaired and re-inspected.
              </p>
              {criticalDefects.length > 0 && (
                <ul className="space-y-1 text-sm text-red-900">
                  {criticalDefects.map((d, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium">{d.item}</p>
                        {d.notes && <p className="text-xs italic opacity-80">&ldquo;{d.notes}&rdquo;</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="p-5 lg:col-span-2">
          <h2 className="font-semibold text-slate-950 mb-3 flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Trip Information
          </h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <InfoRow label="Inspection Date" value={formatDate(i.inspectionDate)} />
            <InfoRow label="Completed At" value={i.completedAt ? formatDateTime(i.completedAt) : "—"} />
            <InfoRow label="Driver" value={i.driverName || "—"} />
            <InfoRow label="Vehicle" value={`${v.registrationNumber} · ${v.make} ${v.model || ""}`} />
            <InfoRow label="Trip Purpose" value={i.tripPurpose || "—"} />
            <InfoRow label="Route" value={i.routeDescription || "—"} />
          </dl>
          {i.notes && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1">Notes</p>
              <p className="text-sm text-slate-800">{i.notes}</p>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-slate-950 mb-3 flex items-center gap-2">
            <User className="h-4 w-4" /> Driver Attestation
          </h2>
          {i.driverSignature ? (
            <div className="border border-dashed border-slate-300 rounded-lg p-2 bg-slate-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={i.driverSignature} alt="Driver signature" className="h-16 mx-auto" />
              <p className="text-xs text-center text-slate-600 mt-1">{i.driverName}</p>
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic">No signature captured</p>
          )}
          {i.supervisorReview && (
            <div className="mt-3 pt-3 border-t border-slate-200">
              <p className="text-xs uppercase tracking-wider text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Supervisor Approved
              </p>
              {i.supervisorNotes && <p className="text-xs text-slate-600 mt-1 italic">{i.supervisorNotes}</p>}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-950 mb-4 flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5" /> Pre-Trip Checklist
        </h2>
        {checklist.length === 0 ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-relaxed text-blue-900">
            This is a historical Safe-To-Load / Pre-Trip record. The source register confirms the trip-clearance outcome but did not contain item-by-item checklist answers, so VIMS has preserved the historical result without inventing checklist data.
          </div>
        ) : (
          <div className="space-y-4">
            {checklist.map((cat) => (
              <div key={cat.category} className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <span>{CATEGORY_ICONS[cat.category] || "•"}</span>
                    {cat.category}
                  </h3>
                  <span className="text-xs text-slate-500">
                    {cat.items.filter((item) => item.result === "pass").length}/{cat.items.length} passed
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {cat.items.map((item, idx) => (
                    <div key={idx} className="px-4 py-2.5 flex items-start justify-between gap-3 text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-900">{item.name}</p>
                        {item.notes && <p className="text-xs text-slate-500 italic mt-0.5">&ldquo;{item.notes}&rdquo;</p>}
                        {(item.photos?.length || 0) > 0 && (
                          <div className="mt-1">
                            <PhotoGallery photos={(item.photos || []).map((photo, index) => ({ id: String(index), dataUrl: photo, takenAt: new Date().toISOString() }))} />
                          </div>
                        )}
                      </div>
                      <div className="shrink-0">
                        {item.result === "pass" && (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Pass
                          </span>
                        )}
                        {item.result === "fail" && (
                          <span className="inline-flex items-center gap-1 text-xs text-red-700 font-medium">
                            <XCircle className="h-3.5 w-3.5" /> Fail
                          </span>
                        )}
                        {item.result === "na" && (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                            <Minus className="h-3.5 w-3.5" /> N/A
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500 uppercase tracking-wider">{label}</dt>
      <dd className="font-medium text-slate-900 mt-0.5">{value}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "passed") {
    return <Badge tone="emerald" className="text-sm px-3 py-1"><CheckCircle2 className="h-4 w-4" /> PASSED</Badge>;
  }
  if (status === "failed") {
    return <Badge tone="red" className="text-sm px-3 py-1"><XCircle className="h-4 w-4" /> FAILED</Badge>;
  }
  return <Badge tone="amber" className="text-sm px-3 py-1"><AlertTriangle className="h-4 w-4" /> DEFECT NOTED</Badge>;
}
