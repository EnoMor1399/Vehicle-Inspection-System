"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitDailyInspection } from "./server";
import { buildDefaultDailyChecklist } from "@/lib/daily-checklist";
import type { DailyChecklistCategory } from "@/db/schema";
import { Button, Card, Field, TextInput, TextArea, Select } from "@/components/ui";
import { PhotoCapture, type Photo } from "@/components/PhotoCapture";
import { SignaturePad } from "@/components/SignaturePad";
import {
  CheckCircle2, XCircle, Minus, Loader2,
  Check, Car, Disc, Lightbulb, Droplet, Eye, ShieldAlert,
  AlertTriangle, FileText, Truck, AlertOctagon,
} from "lucide-react";

const CATEGORY_ICONS: Record<string, typeof Car> = {
  "Tires & Wheels": Disc,
  Brakes: Car,
  "Lights & Signals": Lightbulb,
  "Fluid Levels": Droplet,
  Visibility: Eye,
  "Safety & Controls": ShieldAlert,
  "Emergency Equipment": AlertTriangle,
  Documentation: FileText,
  "Exterior & General": Truck,
};

export function DailyInspectionForm({
  vehicleOptions,
  currentUserName,
}: {
  vehicleOptions: { id: string; registrationNumber: string; make: string; model: string }[];
  currentUserName: string;
}) {
  const router = useRouter();
  const [vehicleId, setVehicleId] = useState("");
  const [driverName, setDriverName] = useState(currentUserName);
  const [inspectionDate, setInspectionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [odometer, setOdometer] = useState("");
  const [tripPurpose, setTripPurpose] = useState("");
  const [routeDescription, setRouteDescription] = useState("");
  const [checklist, setChecklist] = useState<DailyChecklistCategory[]>(() => buildDefaultDailyChecklist());
  const [signature, setSignature] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<null | { id: string; status: string; clearedForTrip: boolean }>(null);

  function setItemResult(catIdx: number, itemIdx: number, result: "pass" | "fail" | "na") {
    setChecklist((prev) => {
      const next = [...prev];
      const items = [...next[catIdx].items];
      items[itemIdx] = { ...items[itemIdx], result };
      next[catIdx] = { ...next[catIdx], items };
      return next;
    });
  }

  function setItemNotes(catIdx: number, itemIdx: number, itemNotes: string) {
    setChecklist((prev) => {
      const next = [...prev];
      const items = [...next[catIdx].items];
      items[itemIdx] = { ...items[itemIdx], notes: itemNotes };
      next[catIdx] = { ...next[catIdx], items };
      return next;
    });
  }

  function setItemPhotos(catIdx: number, itemIdx: number, photos: Photo[]) {
    setChecklist((prev) => {
      const next = [...prev];
      const items = [...next[catIdx].items];
      items[itemIdx] = { ...items[itemIdx], photos: photos.map((p) => p.dataUrl) };
      next[catIdx] = { ...next[catIdx], items };
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!vehicleId) return setError("Please select a vehicle");
    if (!signature) return setError("Driver signature is required to attest this inspection");

    startTransition(async () => {
      try {
        const res = await submitDailyInspection({
          vehicleId, driverName, inspectionDate, odometer, tripPurpose,
          routeDescription, checklist, driverSignature: signature, notes,
        });
        setSubmitted({ id: res.id, status: res.status, clearedForTrip: res.clearedForTrip });
      } catch (err: any) {
        setError(err.message || "Submission failed");
      }
    });
  }

  const total = checklist.reduce((sum, c) => sum + c.items.length, 0);
  const passed = checklist.reduce((sum, c) => sum + c.items.filter((i) => i.result === "pass").length, 0);
  const failed = checklist.reduce((sum, c) => sum + c.items.filter((i) => i.result === "fail").length, 0);

  if (submitted) {
    return (
      <Card className="p-10 text-center">
        {submitted.clearedForTrip ? (
          <>
            <div className="inline-flex h-20 w-20 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center mb-4">
              <CheckCircle2 className="h-12 w-12" />
            </div>
            <h2 className="text-2xl font-bold text-emerald-900 mb-2">Vehicle Cleared for Trip</h2>
            <p className="text-slate-600 mb-6">
              The daily inspection was {submitted.status === "passed" ? "PASSED" : "completed with minor defects noted"}.
              The vehicle may proceed with today&apos;s trip.
            </p>
          </>
        ) : (
          <>
            <div className="inline-flex h-20 w-20 rounded-full bg-red-100 text-red-600 grid place-items-center mb-4">
              <AlertOctagon className="h-12 w-12" />
            </div>
            <h2 className="text-2xl font-bold text-red-900 mb-2">Vehicle Grounded</h2>
            <p className="text-slate-600 mb-6">
              Critical defects were found. This vehicle <strong>MUST NOT</strong> leave the yard until repairs are completed and re-inspected.
            </p>
          </>
        )}
        <div className="flex gap-2 justify-center">
          <Button variant="secondary" onClick={() => router.push("/daily-inspections")}>View All Checks</Button>
          <Button onClick={() => router.push(`/daily-inspections/${submitted.id}`)}>View Details</Button>
        </div>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-950 mb-4">Trip Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Vehicle" required>
            <Select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
              <option value="">Select vehicle</option>
              {vehicleOptions.map((v) => (
                <option key={v.id} value={v.id}>{v.registrationNumber} — {v.make} {v.model}</option>
              ))}
            </Select>
          </Field>
          <Field label="Driver Name" required>
            <TextInput value={driverName} onChange={(e) => setDriverName(e.target.value)} />
          </Field>
          <Field label="Inspection Date" required>
            <TextInput type="date" value={inspectionDate} onChange={(e) => setInspectionDate(e.target.value)} />
          </Field>
          <Field label="Odometer Reading (km)">
            <TextInput type="number" value={odometer} onChange={(e) => setOdometer(e.target.value)} />
          </Field>
          <Field label="Trip Purpose">
            <TextInput value={tripPurpose} onChange={(e) => setTripPurpose(e.target.value)} placeholder="e.g. Delivery, Passenger route" />
          </Field>
          <Field label="Route Description">
            <TextInput value={routeDescription} onChange={(e) => setRouteDescription(e.target.value)} placeholder="e.g. Accra → Kumasi" />
          </Field>
        </div>
      </Card>

      {/* Live progress bar */}
      <Card className="p-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1 text-sm">
              <span className="font-semibold text-slate-900">Checklist Progress</span>
              <span className="text-slate-600">{passed} of {total} passed{failed > 0 && <span className="text-red-600 font-semibold"> · {failed} failed</span>}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${(passed / Math.max(1, total)) * 100}%` }}
              />
            </div>
          </div>
          <div className="flex gap-1.5">
            <Badge tone="emerald">{passed} ✓</Badge>
            <Badge tone="red">{failed} ✗</Badge>
          </div>
        </div>
      </Card>

      {/* Checklist categories */}
      {checklist.map((cat, catIdx) => {
        const Icon = CATEGORY_ICONS[cat.category] || CheckCircle2;
        const catPass = cat.items.filter((i) => i.result === "pass").length;
        const catFail = cat.items.filter((i) => i.result === "fail").length;
        return (
          <Card key={cat.category} className="p-6">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-slate-900 text-white grid place-items-center">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-950">{cat.category}</h3>
                  <p className="text-xs text-slate-500">{cat.items.length} items · {catPass} passed{catFail > 0 && <span className="text-red-600"> · {catFail} failed</span>}</p>
                </div>
              </div>
              {catFail === 0 && catPass === cat.items.length && (
                <Badge tone="emerald"><CheckCircle2 className="h-3.5 w-3.5" /> All Clear</Badge>
              )}
              {catFail > 0 && (
                <Badge tone="red"><XCircle className="h-3.5 w-3.5" /> {catFail} failed</Badge>
              )}
            </div>

            <div className="space-y-2">
              {cat.items.map((item, itemIdx) => (
                <div key={itemIdx} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 text-sm">{item.name}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <ResultButton active={item.result === "pass"} tone="emerald" onClick={() => setItemResult(catIdx, itemIdx, "pass")}>
                        <Check className="h-4 w-4" />
                      </ResultButton>
                      <ResultButton active={item.result === "fail"} tone="red" onClick={() => setItemResult(catIdx, itemIdx, "fail")}>
                        <XCircle className="h-4 w-4" />
                      </ResultButton>
                      <ResultButton active={item.result === "na"} tone="slate" onClick={() => setItemResult(catIdx, itemIdx, "na")}>
                        <Minus className="h-4 w-4" />
                      </ResultButton>
                    </div>
                  </div>

                  {item.result === "fail" && (
                    <div className="mt-2 space-y-2">
                      <TextInput
                        placeholder="Describe the defect..."
                        value={item.notes || ""}
                        onChange={(e) => setItemNotes(catIdx, itemIdx, e.target.value)}
                        className="text-xs"
                      />
                      <PhotoCapture
                        value={(item.photos || []).map((p, i) => ({ id: String(i), dataUrl: p, takenAt: new Date().toISOString() }))}
                        onChange={(photos) => setItemPhotos(catIdx, itemIdx, photos)}
                        label="Photo evidence"
                        maxPhotos={3}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        );
      })}

      {/* Notes + Signature */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-950 mb-4">Driver Attestation</h2>
        <Field label="Additional Notes">
          <TextArea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any observations or concerns not captured above..." />
        </Field>
        <div className="mt-4">
          <SignaturePad label="Driver Signature (required to submit)" value={signature} onChange={setSignature} />
        </div>
        <p className="mt-3 text-xs text-slate-500 italic">
          By signing above, I attest that I have personally inspected this vehicle and the results recorded are true and accurate to the best of my knowledge.
        </p>
      </Card>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      <div className="sticky bottom-4 bg-white rounded-2xl p-4 shadow-lg ring-1 ring-slate-200 flex items-center justify-between gap-3">
        <Button type="button" variant="secondary" onClick={() => router.push("/daily-inspections")}>Cancel</Button>
        <Button type="submit" disabled={pending || !vehicleId || !signature}>
          {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</> : <>Submit Inspection</>}
        </Button>
      </div>
    </form>
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

function Badge({ tone, children }: { tone: "emerald" | "red" | "slate"; children: React.ReactNode }) {
  const colors: Record<string, string> = {
    emerald: "bg-emerald-100 text-emerald-700",
    red: "bg-red-100 text-red-700",
    slate: "bg-slate-100 text-slate-700",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${colors[tone]}`}>{children}</span>;
}
