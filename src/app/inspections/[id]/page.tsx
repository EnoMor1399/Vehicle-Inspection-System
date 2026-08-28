import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle, Minus, FileText, Camera } from "lucide-react";
import { PageHeader, Card, Badge } from "@/components/ui";
import { formatDateTime, formatDate } from "@/lib/utils";
import { getInspectionDetail } from "../server";
import { summarizeSection, INSPECTION_SECTIONS } from "@/lib/sections";
import { QRCode } from "../QRCode";
import { PrintButton } from "../PrintButton";
import { PhotoGallery, DocumentList } from "@/components/PhotoGallery";
import { getCurrentUser, canApprove } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { InspectionApprovalPanel } from "../InspectionApprovalPanel";

export const dynamic = "force-dynamic";

export default async function InspectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row, user, settings] = await Promise.all([
    getInspectionDetail(id),
    getCurrentUser(),
    getSettings(),
  ]);
  if (!row) notFound();
  const { inspection: i, vehicle: v } = row;

  const sections = (i.sectionData || []) as { section: string; title: string; items: { name: string; result: "pass" | "fail" | "na"; severity?: "minor" | "major" | "critical"; remarks?: string; photos?: { id: string; dataUrl: string; takenAt: string }[] }[] }[];

  const sectionMap = new Map(sections.map((s) => [s.section, s]));
  let totalPass = 0, totalFail = 0, totalNa = 0, totalCritical = 0;
  sections.forEach((s) => {
    const t = summarizeSection(s);
    totalPass += t.pass; totalFail += t.fail; totalNa += t.na; totalCritical += t.critical;
  });

  const qrPayload = `${process.env.NEXT_PUBLIC_APP_URL || "https://rsl.gh"}/inspections/${i.id}`;

  return (
    <div className="p-6 lg:p-10">
      <Link href="/inspections" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> All inspections
      </Link>

      <PageHeader
        eyebrow={i.inspectionNumber}
        title={`${v.make} ${v.model || ""} — ${v.registrationNumber}`}
        description={`Inspected ${formatDateTime(i.inspectionDate)} at ${i.station}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <WorkflowBadge status={i.workflowStatus} />
            <ResultBadge result={i.overallResult} />
            <a
              href={`/certificate/${i.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700"
            >
              <FileText className="h-4 w-4" /> {i.workflowStatus === "approved" ? "View Certificate" : "Certificate Preview"}
            </a>
            <PrintButton />
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-950 mb-4">Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatChip label="Pass" value={totalPass} tone="emerald" />
            <StatChip label="Fail" value={totalFail} tone="red" />
            <StatChip label="N/A" value={totalNa} tone="slate" />
            <StatChip label="Critical defects" value={totalCritical} tone="red" />
          </div>
          <div className="mt-5 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <Info label="Service brake efficiency" value={i.serviceBrakeEfficiency ? `${i.serviceBrakeEfficiency}%` : null} />
            <Info label="Parking brake efficiency" value={i.parkingBrakeEfficiency ? `${i.parkingBrakeEfficiency}%` : null} />
            <Info label="Smoke test" value={i.smokeTest} />
            <Info label="Noise level" value={i.noiseLevel ? `${i.noiseLevel} dB` : null} />
            <Info label="Opacity" value={i.opacityTest ? `${i.opacityTest}%` : null} />
            <Info label="Next inspection" value={formatDate(i.nextInspectionDate)} />
            <Info label="Re-inspection" value={formatDate(i.reinspectionDate)} />
          </div>
          {(i.inspectorRemarks || i.supervisorRemarks) && (
            <div className="mt-5 pt-5 border-t border-slate-200 space-y-3">
              {i.inspectorRemarks && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Inspector Remarks</p>
                  <p className="text-sm text-slate-800 mt-1">{i.inspectorRemarks}</p>
                </div>
              )}
              {i.supervisorRemarks && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Supervisor Remarks</p>
                  <p className="text-sm text-slate-800 mt-1">{i.supervisorRemarks}</p>
                </div>
              )}
            </div>
          )}

          {(i.totalPhotos > 0 || (i.attachedDocuments && (i.attachedDocuments as any[]).length > 0)) && (
            <div className="mt-5 pt-5 border-t border-slate-200 space-y-4">
              <h3 className="font-semibold text-slate-950 flex items-center gap-2">
                <Camera className="h-4 w-4" /> Evidence & Documents
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Photos Captured</p>
                  <p className="text-lg font-semibold text-slate-900">{i.totalPhotos || 0}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Documents Attached</p>
                  <p className="text-lg font-semibold text-slate-900">{(i.attachedDocuments as any[])?.length || 0}</p>
                </div>
              </div>
              {i.attachedDocuments && (i.attachedDocuments as any[]).length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2 flex items-center gap-1">
                    <FileText className="h-3 w-3" /> Attached Documents
                  </p>
                  <DocumentList docs={i.attachedDocuments as any} />
                </div>
              )}
            </div>
          )}
        </Card>

        <Card className="p-6 flex flex-col items-center text-center">
          <h2 className="text-lg font-semibold text-slate-950 mb-2">Certificate</h2>
          <p className="text-xs text-slate-500 mb-4">Scan QR code to verify authenticity</p>
          <div className="bg-white p-3 rounded-lg ring-1 ring-slate-200">
            <QRCode value={qrPayload} size={180} />
          </div>
          <p className="mt-3 font-mono text-xs text-slate-500 break-all">{i.inspectionNumber}</p>
          <div className="mt-3 space-y-1 text-xs text-slate-600">
            <p>Inspector: <span className="font-medium text-slate-900">{i.inspectorName}</span></p>
            {i.supervisorName && <p>Supervisor: <span className="font-medium text-slate-900">{i.supervisorName}</span></p>}
          </div>
        </Card>
      </div>

      {i.workflowStatus === "completed" && canApprove(user) && (
        <InspectionApprovalPanel inspectionId={i.id} requireSignature={settings.requireDigitalSignature} />
      )}

      <div className="mt-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-950 mb-4">Checklist Sections</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {INSPECTION_SECTIONS.map((def) => {
              const data = sectionMap.get(def.code);
              const summary = data ? summarizeSection(data) : { pass: 0, fail: 0, na: 0, critical: 0, major: 0, minor: 0 };
              return (
                <details key={def.code} className="group rounded-xl border border-slate-200 overflow-hidden">
                  <summary className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50 list-none">
                    <div className="flex items-center gap-3">
                      <span className="h-8 w-8 grid place-items-center rounded-lg bg-slate-900 text-white font-mono text-sm">{def.code}</span>
                      <div>
                        <p className="font-medium text-slate-900">{def.title}</p>
                        <p className="text-xs text-slate-500">{summary.pass + summary.fail + summary.na} items</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {summary.fail > 0 && <Badge tone="red">{summary.fail} fail</Badge>}
                      {summary.fail === 0 && <Badge tone="emerald"><CheckCircle2 className="h-3.5 w-3.5" /> Clear</Badge>}
                    </div>
                  </summary>
                  {data && (
                    <div className="border-t border-slate-100 divide-y divide-slate-100">
                      {data.items.map((it, idx) => (
                        <div key={idx} className="px-3 py-2 flex items-start justify-between gap-2 text-sm">
                          <div className="flex-1 min-w-0">
                            <p className="text-slate-900">{it.name}</p>
                            {it.remarks && <p className="text-xs text-slate-500 italic mt-0.5">{it.remarks}</p>}
                            {it.photos && it.photos.length > 0 && <PhotoGallery photos={it.photos as any} />}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {it.result === "pass" && <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium"><CheckCircle2 className="h-3.5 w-3.5" /> Pass</span>}
                            {it.result === "fail" && (
                              <span className={`inline-flex items-center gap-1 text-xs font-medium ${it.severity === "critical" ? "text-red-700" : it.severity === "major" ? "text-red-600" : "text-orange-600"}`}>
                                <XCircle className="h-3.5 w-3.5" /> {it.severity || "minor"}
                              </span>
                            )}
                            {it.result === "na" && <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Minus className="h-3.5 w-3.5" /> N/A</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </details>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className="font-medium text-slate-900 mt-0.5">{value || "—"}</p>
    </div>
  );
}

function StatChip({ label, value, tone }: { label: string; value: number; tone: "emerald" | "red" | "slate" }) {
  const color = tone === "emerald" ? "text-emerald-700" : tone === "red" ? "text-red-700" : "text-slate-700";
  return (
    <div className="rounded-lg bg-slate-50 p-3 text-center">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function WorkflowBadge({ status }: { status: string }) {
  const map: Record<string, { tone: "emerald" | "blue" | "amber" | "red" | "slate"; label: string }> = {
    approved: { tone: "emerald", label: "AUTHORIZED" },
    completed: { tone: "blue", label: "AWAITING REVIEW" },
    in_progress: { tone: "amber", label: "IN PROGRESS" },
    failed: { tone: "red", label: "REVIEW REJECTED" },
    archived: { tone: "slate", label: "ARCHIVED" },
  };
  const item = map[status] || { tone: "slate" as const, label: status.replaceAll("_", " ").toUpperCase() };
  return <Badge tone={item.tone}>{item.label}</Badge>;
}

function ResultBadge({ result }: { result: string }) {
  const map: Record<string, { tone: "emerald" | "red" | "amber" | "slate"; label: string; icon: typeof CheckCircle2 }> = {
    pass: { tone: "emerald", label: "PASS", icon: CheckCircle2 },
    fail: { tone: "red", label: "FAIL", icon: XCircle },
    conditional_pass: { tone: "amber", label: "CONDITIONAL PASS", icon: AlertTriangle },
    reinspection_required: { tone: "amber", label: "RE-INSPECTION", icon: AlertTriangle },
  };
  const m = map[result] || { tone: "slate" as const, label: result, icon: CheckCircle2 };
  const Icon = m.icon;
  return <Badge tone={m.tone} className="text-sm px-3 py-1.5"><Icon className="h-4 w-4" /> {m.label}</Badge>;
}
