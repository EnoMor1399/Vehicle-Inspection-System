"use client";

import { useMemo, useState, useTransition } from "react";
import { createInspection, type InspectionFormData } from "./server";
import { useRouter, useSearchParams } from "next/navigation";
import { buildDefaultSectionData, summarizeSection } from "@/lib/sections";
import { SignaturePad } from "@/components/SignaturePad";
import { PhotoCapture, DocumentUpload, type Photo } from "@/components/PhotoCapture";
import { GpsCapture } from "@/components/GpsCapture";
import type { InspectionSectionData, InspectionDocument, InspectionPhoto } from "@/db/schema";
import { Badge, Button, Card, Field, Select, TextArea, TextInput } from "@/components/ui";
import { Check, CheckCircle2, XCircle, AlertTriangle, Minus, ChevronRight } from "lucide-react";

type SectionForm = {
  section: string;
  title: string;
  items: { name: string; result: "pass" | "fail" | "na"; severity?: "minor" | "major" | "critical"; remarks?: string; photos?: InspectionPhoto[] }[];
};

export function InspectionForm({
  vehicleOptions,
  currentUser,
}: {
  vehicleOptions: { id: string; registrationNumber: string; make: string; model: string }[];
  currentUser: { id: string; name: string };
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const initialVehicle = sp.get("vehicleId") || "";

  const [vehicleId, setVehicleId] = useState(initialVehicle);
  const [inspectionDate, setInspectionDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [inspectorName, setInspectorName] = useState(currentUser.name);
  const [station, setStation] = useState("Accra Central Station");
  const [odometer, setOdometer] = useState("");
  const [serviceBrake, setServiceBrake] = useState("");
  const [parkingBrake, setParkingBrake] = useState("");
  const [smokeTest, setSmokeTest] = useState<"pass" | "fail" | "na">("pass");
  const [noiseLevel, setNoiseLevel] = useState("");
  const [opacity, setOpacity] = useState("");
  const [overallResult, setOverallResult] = useState<InspectionFormData["overallResult"]>("pass");
  const [inspectorRemarks, setInspectorRemarks] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [reinspectDate, setReinspectDate] = useState("");
  const [templateType, setTemplateType] = useState("bus");
  const [inspectorSig, setInspectorSig] = useState("");
  const [attachedDocuments, setAttachedDocuments] = useState<InspectionDocument[]>([]);
  const [gpsLocation, setGpsLocation] = useState<{ latitude: number; longitude: number; accuracy: number; timestamp: string } | null>(null);
  const [sections, setSections] = useState<SectionForm[]>(() => buildDefaultSectionData() as SectionForm[]);
  const [activeSection, setActiveSection] = useState("A");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const totals = useMemo(() => {
    let pass = 0, fail = 0, na = 0, critical = 0, major = 0, minor = 0;
    sections.forEach((s) => {
      const t = summarizeSection(s);
      pass += t.pass; fail += t.fail; na += t.na;
      critical += t.critical; major += t.major; minor += t.minor;
    });
    return { pass, fail, na, critical, major, minor, total: pass + fail + na };
  }, [sections]);

  function setItem(sectionCode: string, itemIdx: number, patch: Partial<SectionForm["items"][number]>) {
    setSections((prev) =>
      prev.map((s) => {
        if (s.section !== sectionCode) return s;
        const items = s.items.map((it, i) => (i === itemIdx ? { ...it, ...patch } : it));
        return { ...s, items };
      })
    );
  }

  function setItemPhotos(sectionCode: string, itemIdx: number, photos: Photo[]) {
    setItem(sectionCode, itemIdx, { photos: photos as InspectionPhoto[] });
  }

  function applyBulk(sectionCode: string, result: "pass" | "fail" | "na") {
    setSections((prev) =>
      prev.map((s) => (s.section === sectionCode ? { ...s, items: s.items.map((it) => ({ ...it, result })) } : s))
    );
  }

  function showFinalDecisionError(message: string) {
    setActiveSection("P");
    setError(message);
    window.setTimeout(() => {
      document.getElementById("inspection-validation-error")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  }

  function submit() {
    setError(null);

    if (!vehicleId) {
      setActiveSection("A");
      return setError("Please select a vehicle before submitting the inspection.");
    }
    if (!inspectorName.trim()) {
      setActiveSection("A");
      return setError("Inspector name is required before submission.");
    }
    if (!station.trim()) {
      setActiveSection("A");
      return setError("Inspection station is required before submission.");
    }

    const inspectedAt = new Date(inspectionDate);
    if (Number.isNaN(inspectedAt.getTime())) {
      setActiveSection("A");
      return setError("Enter a valid inspection date and time.");
    }
    if (inspectedAt.getTime() > Date.now() + 5 * 60_000) {
      setActiveSection("A");
      return setError("Inspection date and time cannot be in the future.");
    }

    if (overallResult === "pass" && (totals.fail > 0 || smokeTest === "fail")) {
      return showFinalDecisionError(
        "PASS cannot be submitted while failed checklist or emissions items remain. Resolve the failed items or select Conditional Pass, Re-inspection Required, or Fail.",
      );
    }
    if (overallResult === "conditional_pass" && totals.critical > 0) {
      return showFinalDecisionError(
        "Conditional Pass cannot be submitted while critical defects remain. Resolve the critical defects or select Re-inspection Required or Fail.",
      );
    }
    if (!inspectorSig) {
      return showFinalDecisionError("Inspector digital signature is required in Section P before submission.");
    }

    const data: InspectionFormData = {
      vehicleId,
      inspectionDate: inspectedAt.toISOString(),
      inspectorName,
      station,
      odometerReading: odometer,
      sectionData: sections as InspectionSectionData[],
      serviceBrakeEfficiency: serviceBrake,
      parkingBrakeEfficiency: parkingBrake,
      smokeTest,
      noiseLevel,
      opacityTest: opacity,
      overallResult,
      inspectorRemarks,
      nextInspectionDate: nextDate,
      reinspectionDate: reinspectDate,
      templateType,
      inspectorSignature: inspectorSig,
      attachedDocuments,
    };
    startTransition(async () => {
      try {
        const res = await createInspection(data);
        router.push(`/inspections/${res.id}`);
      } catch (e: any) {
        setError(e?.message || "Submission failed. Review the inspection and try again.");
      }
    });
  }

  // Sections A and P are dedicated form steps and are intentionally not
  // included in the B-O checklist data. Guard the lookup before summarizing.
  const active = sections.find((s) => s.section === activeSection);
  const activeSummary = active ? summarizeSection(active) : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
      {/* Section nav */}
      <aside>
        <Card className="p-2">
          <p className="px-3 py-2 text-xs uppercase tracking-wider text-slate-500 font-semibold">Checklist Sections</p>
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => setActiveSection("A")}
              aria-current={activeSection === "A" ? "step" : undefined}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between ${activeSection === "A" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}`}
            >
              <span><strong className="font-mono">A</strong> · Identification</span>
              <ChevronRight className="h-4 w-4" />
            </button>
            {sections.map((s) => {
              const t = summarizeSection(s);
              const isActive = activeSection === s.section;
              return (
                <button
                  key={s.section}
                  type="button"
                  onClick={() => setActiveSection(s.section)}
                  aria-current={isActive ? "step" : undefined}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between ${isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}`}
                >
                  <span>
                    <strong className="font-mono">{s.section}</strong> · {s.title}
                  </span>
                  {t.fail > 0 ? (
                    <Badge tone="red">{t.fail}</Badge>
                  ) : t.pass === s.items.length ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <span className="text-xs text-slate-400">{t.pass}/{s.items.length}</span>
                  )}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setActiveSection("P")}
              aria-current={activeSection === "P" ? "step" : undefined}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between ${activeSection === "P" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}`}
            >
              <span><strong className="font-mono">P</strong> · Final Decision</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </Card>
      </aside>

      {/* Main form */}
      <div className="space-y-6">
        {activeSection === "A" && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-slate-950 mb-4">Section A · Vehicle Identification</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Vehicle" required>
              <Select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
                <option value="">Select vehicle</option>
                {vehicleOptions.map((v) => (
                  <option key={v.id} value={v.id}>{v.registrationNumber} — {v.make} {v.model}</option>
                ))}
              </Select>
            </Field>
            <Field label="Inspection Date & Time" required>
              <TextInput type="datetime-local" value={inspectionDate} onChange={(e) => setInspectionDate(e.target.value)} />
            </Field>
            <Field label="Inspector Name" required>
              <TextInput value={inspectorName} onChange={(e) => setInspectorName(e.target.value)} />
            </Field>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Supervisor authorization is completed after submission by an authorized approver, preserving separation of duties.
            </div>
            <Field label="Inspection Station" required>
              <TextInput value={station} onChange={(e) => setStation(e.target.value)} />
            </Field>
            <Field label="Odometer Reading (km)">
              <TextInput type="number" value={odometer} onChange={(e) => setOdometer(e.target.value)} />
            </Field>
            <Field label="Inspection Template">
              <Select value={templateType} onChange={(e) => setTemplateType(e.target.value)}>
                <option value="bus">Bus / Coach</option>
                <option value="truck">Truck / Lorry</option>
                <option value="tanker">Tanker (Hazardous)</option>
                <option value="trailer">Trailer</option>
                <option value="taxi">Taxi / Ride-hail</option>
                <option value="private">Private Vehicle</option>
              </Select>
            </Field>
          </div>
          <div className="mt-4">
            <GpsCapture value={gpsLocation} onChange={setGpsLocation} />
          </div>
          </Card>
        )}

        {activeSection !== "A" && activeSection !== "P" && active && activeSummary && (
          <Card className="p-6">
            <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Section {active.section}</p>
                <h2 className="text-lg font-semibold text-slate-950">{active.title}</h2>
                <p className="text-sm text-slate-500 mt-1">{active.items.length} checklist items</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="emerald"><CheckCircle2 className="h-3.5 w-3.5" /> {activeSummary.pass} pass</Badge>
                <Badge tone="red"><XCircle className="h-3.5 w-3.5" /> {activeSummary.fail} fail</Badge>
                <Badge tone="slate"><Minus className="h-3.5 w-3.5" /> {activeSummary.na} n/a</Badge>
              </div>
            </div>

            <div className="flex gap-2 mb-4">
              <Button size="sm" variant="secondary" onClick={() => applyBulk(active.section, "pass")}>Mark all pass</Button>
              <Button size="sm" variant="secondary" onClick={() => applyBulk(active.section, "na")}>Mark all N/A</Button>
            </div>

            <div className="divide-y divide-slate-100">
              {active.items.map((item, idx) => (
                <div key={idx} className="py-3 flex items-start gap-3">
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{item.name}</p>
                    {item.result === "fail" && (
                      <div className="mt-2 space-y-2">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <Select
                            value={item.severity || "minor"}
                            onChange={(e) => setItem(active.section, idx, { severity: e.target.value as any })}
                            className="text-xs"
                          >
                            <option value="minor">Minor</option>
                            <option value="major">Major</option>
                            <option value="critical">Critical</option>
                          </Select>
                          <TextInput
                            placeholder="Inspector remarks"
                            value={item.remarks || ""}
                            onChange={(e) => setItem(active.section, idx, { remarks: e.target.value })}
                            className="md:col-span-2 text-xs"
                          />
                        </div>
                        <PhotoCapture
                          value={(item.photos as Photo[]) || []}
                          onChange={(photos) => setItemPhotos(active.section, idx, photos)}
                          label="Capture evidence of anomaly"
                          maxPhotos={5}
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <ResultButton active={item.result === "pass"} tone="emerald" onClick={() => setItem(active.section, idx, { result: "pass", severity: undefined, remarks: "" })}>
                      <Check className="h-4 w-4" />
                    </ResultButton>
                    <ResultButton active={item.result === "fail"} tone="red" onClick={() => setItem(active.section, idx, { result: "fail", severity: item.severity || "minor" })}>
                      <XCircle className="h-4 w-4" />
                    </ResultButton>
                    <ResultButton active={item.result === "na"} tone="slate" onClick={() => setItem(active.section, idx, { result: "na", severity: undefined, remarks: "" })}>
                      <Minus className="h-4 w-4" />
                    </ResultButton>
                  </div>
                </div>
              ))}
            </div>

            {active.section === "E" && (
              <div className="mt-6 pt-6 border-t border-slate-200">
                <h3 className="font-semibold text-slate-950 mb-3">Brake Test Efficiencies</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Service Brake Efficiency %"><TextInput type="number" step="0.01" value={serviceBrake} onChange={(e) => setServiceBrake(e.target.value)} /></Field>
                  <Field label="Parking Brake Efficiency %"><TextInput type="number" step="0.01" value={parkingBrake} onChange={(e) => setParkingBrake(e.target.value)} /></Field>
                </div>
              </div>
            )}

            {active.section === "O" && (
              <div className="mt-6 pt-6 border-t border-slate-200">
                <h3 className="font-semibold text-slate-950 mb-3">Emissions Readings</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Field label="Smoke Test">
                    <Select value={smokeTest} onChange={(e) => setSmokeTest(e.target.value as any)}>
                      <option value="pass">Pass</option>
                      <option value="fail">Fail</option>
                      <option value="na">N/A</option>
                    </Select>
                  </Field>
                  <Field label="Noise Level (dB)"><TextInput type="number" step="0.01" value={noiseLevel} onChange={(e) => setNoiseLevel(e.target.value)} /></Field>
                  <Field label="Opacity (%)"><TextInput type="number" step="0.01" value={opacity} onChange={(e) => setOpacity(e.target.value)} /></Field>
                </div>
              </div>
            )}
          </Card>
        )}

        {activeSection === "P" && (
          <Card className="p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Section P</p>
            <h2 className="text-lg font-semibold text-slate-950 mb-4">Final Decision</h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <StatChip label="Pass" value={totals.pass} tone="emerald" />
              <StatChip label="Fail" value={totals.fail} tone="red" />
              <StatChip label="N/A" value={totals.na} tone="slate" />
              <StatChip label="Critical" value={totals.critical} tone="red" />
            </div>

            <Field label="Overall Result" required>
              <Select value={overallResult} onChange={(e) => setOverallResult(e.target.value as any)}>
                <option value="pass">Pass</option>
                <option value="conditional_pass">Conditional Pass</option>
                <option value="reinspection_required">Re-inspection Required</option>
                <option value="fail">Fail</option>
              </Select>
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <Field label="Next Inspection Date"><TextInput type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} /></Field>
              <Field label="Re-inspection Date"><TextInput type="date" value={reinspectDate} onChange={(e) => setReinspectDate(e.target.value)} /></Field>
              <div className="md:col-span-2"><Field label="Inspector Remarks"><TextArea rows={3} value={inspectorRemarks} onChange={(e) => setInspectorRemarks(e.target.value)} /></Field></div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-200">
              <h3 className="font-semibold text-slate-950 mb-3">Supporting Documents</h3>
              <p className="text-sm text-slate-600 mb-3">
                Upload inspection certificates, brake test reports, emission test results, or any other documents related to this inspection.
              </p>
              <DocumentUpload
                value={attachedDocuments}
                onChange={setAttachedDocuments}
                maxDocs={10}
              />
            </div>

            <div className="mt-6 pt-6 border-t border-slate-200">
              <SignaturePad label="Inspector Digital Signature" value={inspectorSig} onChange={setInspectorSig} />
              <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800 ring-1 ring-blue-100">
                Supervisor approval and signature are captured on the inspection review screen after the inspector submits this record.
              </p>
            </div>
          </Card>
        )}

        {error && (
          <div id="inspection-validation-error" className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2" role="alert">
            <AlertTriangle className="h-4 w-4" /> {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 sticky bottom-4 bg-white rounded-2xl p-4 shadow-lg ring-1 ring-slate-200">
          <div className="text-sm text-slate-600">
            <span className="font-medium text-slate-900">{totals.pass}</span> pass ·{" "}
            <span className="font-medium text-red-600">{totals.fail}</span> fail ·{" "}
            <span className="font-medium">{totals.na}</span> n/a
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => router.push("/inspections")}>Cancel</Button>
            <Button onClick={submit} disabled={pending || !vehicleId}>
              {pending ? "Submitting..." : "Submit Inspection"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultButton({ active, tone, onClick, children }: { active: boolean; tone: "emerald" | "red" | "slate"; onClick: () => void; children: React.ReactNode }) {
  const colors: Record<string, string> = {
    emerald: active ? "bg-emerald-600 text-white" : "text-emerald-600 hover:bg-emerald-50",
    red: active ? "bg-red-600 text-white" : "text-red-600 hover:bg-red-50",
    slate: active ? "bg-slate-700 text-white" : "text-slate-500 hover:bg-slate-100",
  };
  return (
    <button type="button" onClick={onClick} className={`h-9 w-9 grid place-items-center rounded-lg border transition ${active ? "border-transparent" : "border-slate-200"} ${colors[tone]}`}>
      {children}
    </button>
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