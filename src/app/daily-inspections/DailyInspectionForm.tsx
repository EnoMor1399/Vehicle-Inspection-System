"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitDailyInspection } from "./server";
import { buildDefaultDailyChecklist } from "@/lib/daily-checklist";
import type { DailyChecklistCategory, DailyInspectionVehicleType, DailyPreloadingDetails } from "@/db/schema";
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
  "B. Driver & Vehicle Documentation": FileText,
  "C. General / Physical Condition": Truck,
  "D. Electricals": Lightbulb,
  "E. Fire Hazard & Emergency Controls": AlertTriangle,
  "F. Wheels / Tyres": Disc,
  "G. Brakes": Car,
  "General Mechanical & Fluids": Droplet,
  "Trip & Loading Readiness": ShieldAlert,
  "Pre-Loading: Additional Fire & Bonding Controls": AlertOctagon,
  "H. Tractor–Trailer Coupling": Truck,
  "I. Bulk / Container / Flat Trailer": Truck,
  "J. Other Accessories": ShieldAlert,
  "Bulk Tanker Calibration & Containment": FileText,
};

export function DailyInspectionForm({
  vehicleOptions,
  currentUserName,
}: {
  vehicleOptions: { id: string; registrationNumber: string; make: string; model: string; chassisNumber: string; transporterName: string }[];
  currentUserName: string;
}) {
  const router = useRouter();
  const [vehicleId, setVehicleId] = useState("");
  const [vehicleType, setVehicleType] = useState<DailyInspectionVehicleType>("general");
  const [preloading, setPreloading] = useState<DailyPreloadingDetails>({ vehicleType: "general" });
  const [driverName, setDriverName] = useState(currentUserName);
  const [inspectionDate, setInspectionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [odometer, setOdometer] = useState("");
  const [tripPurpose, setTripPurpose] = useState("");
  const [routeDescription, setRouteDescription] = useState("");
  const [checklist, setChecklist] = useState<DailyChecklistCategory[]>(() => buildDefaultDailyChecklist());
  const [signature, setSignature] = useState("");
  const [notes, setNotes] = useState("");
  const [inspectorSignature, setInspectorSignature] = useState("");
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

  const selectedVehicle = vehicleOptions.find((v) => v.id === vehicleId);
  const isPreloading = vehicleType !== "general";

  function changeVehicleType(next: DailyInspectionVehicleType) {
    setVehicleType(next);
    setPreloading((previous) => ({ ...previous, vehicleType: next }));
    setChecklist(buildDefaultDailyChecklist(next)); // Switching scope intentionally clears previous answers.
  }

  function setPreloadingField(key: keyof DailyPreloadingDetails, value: string) {
    setPreloading((previous) => ({ ...previous, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!vehicleId) return setError("Please select a vehicle");
    if (!signature) return setError("Driver signature is required to attest this inspection");
    if (isPreloading && (!preloading.inspectionPremises?.trim() || !preloading.inspectorName?.trim() || !inspectorSignature)) {
      return setError("Pre-loading checks require inspection premises, inspector name and inspector signature.");
    }
    if (isPreloading && vehicleType === "bulk_tanker" && (!preloading.bulkIdentificationNumber?.trim() || !preloading.bulkCapacity?.trim() || !preloading.bulkCalibrationCertificateNumber?.trim() || !preloading.bulkCalibrationExpiryDate)) {
      return setError("Complete all bulk identification and calibration fields.");
    }
    const pendingItem = checklist.flatMap((cat) => cat.items.map((item) => ({ category: cat.category, item })))
      .find(({ item }) => item.result === "unchecked" || (item.result === "na" && (!item.optional || !item.notes?.trim())) || (item.result === "fail" && !item.notes?.trim()));
    if (pendingItem) return setError(`Complete or explain the check: ${pendingItem.item.name}`);

    startTransition(async () => {
      try {
        const res = await submitDailyInspection({
          vehicleId, driverName, inspectionDate, odometer, tripPurpose,
          routeDescription, checklist, driverSignature: signature, notes,
          preloadingDetails: {
            ...preloading, vehicleType, inspectorSignature: isPreloading ? inspectorSignature : undefined,
            vehicleMake: selectedVehicle?.make || "",
            chassisNumber: selectedVehicle?.chassisNumber || "",
            transporterName: preloading.transporterName?.trim() || selectedVehicle?.transporterName || "",
          },
        });
        setSubmitted({ id: res.id, status: res.status, clearedForTrip: res.clearedForTrip });
      } catch (err: any) {
        setError(err.message || "Submission failed");
      }
    });
  }

  const total = checklist.reduce((sum, c) => sum + c.items.length, 0);
  const answered = checklist.reduce((sum, c) => sum + c.items.filter((i) => i.result !== "unchecked").length, 0);
  const notChecked = total - answered;
  const na = checklist.reduce((sum, c) => sum + c.items.filter((i) => i.result === "na").length, 0);
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
              The daily inspection was PASSED. The vehicle may proceed with today&apos;s trip in accordance with the loading/site authorization process.
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

      <Card className="p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Vehicle & Pre-Loading Details</h2>
            <p className="mt-1 text-xs text-slate-500">Checklist reference will be assigned automatically at submission. Select the correct inspection type before recording answers.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{isPreloading ? "Pre-loading protocol" : "Daily pre-trip protocol"}</span>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Inspection Type" required>
            <Select value={vehicleType} onChange={(e) => changeVehicleType(e.target.value as DailyInspectionVehicleType)}>
              <option value="general">Standard daily pre-trip</option>
              <option value="bulk_tanker">Bulk / fuel tanker pre-loading</option>
              <option value="tractor_trailer">Tractor / trailer pre-loading</option>
              <option value="container_flatbed">Container / flatbed trailer pre-loading</option>
            </Select>
          </Field>
          <Field label="Transporter / Operator">
            <TextInput value={preloading.transporterName ?? selectedVehicle?.transporterName ?? ""} onChange={(e) => setPreloadingField("transporterName", e.target.value)} placeholder="Transport company" />
          </Field>
          <Field label="Registration Number"><TextInput readOnly value={selectedVehicle?.registrationNumber || ""} placeholder="Select a vehicle above" /></Field>
          <Field label="Make"><TextInput readOnly value={selectedVehicle?.make || ""} placeholder="Vehicle make" /></Field>
          <Field label="Chassis / VIN"><TextInput readOnly={Boolean(selectedVehicle?.chassisNumber)} value={selectedVehicle?.chassisNumber || preloading.chassisNumber || ""} onChange={(e) => setPreloadingField("chassisNumber", e.target.value)} placeholder="Enter chassis/VIN if missing from registry" /></Field>
          <Field label="Driver Licence Class">
            <TextInput value={preloading.driverLicenceClass || ""} onChange={(e) => setPreloadingField("driverLicenceClass", e.target.value)} placeholder="e.g. Class E" />
          </Field>
          <Field label="Inspection Premises" required={isPreloading}>
            <TextInput value={preloading.inspectionPremises || ""} onChange={(e) => setPreloadingField("inspectionPremises", e.target.value)} placeholder="Station, depot or loading site" />
          </Field>
        </div>
        {vehicleType === "bulk_tanker" && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <h3 className="mb-3 text-sm font-bold text-amber-950">Bulk tanker certificate & capacity</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Bulk Identification Number" required>
                <TextInput value={preloading.bulkIdentificationNumber || ""} onChange={(e) => setPreloadingField("bulkIdentificationNumber", e.target.value)} />
              </Field>
              <Field label="Bulk Capacity" required>
                <TextInput value={preloading.bulkCapacity || ""} onChange={(e) => setPreloadingField("bulkCapacity", e.target.value)} placeholder="e.g. 35,000 litres" />
              </Field>
              <Field label="Bulk Calibration Certificate Number" required>
                <TextInput value={preloading.bulkCalibrationCertificateNumber || ""} onChange={(e) => setPreloadingField("bulkCalibrationCertificateNumber", e.target.value)} />
              </Field>
              <Field label="Calibration Expiry Date" required>
                <TextInput type="date" value={preloading.bulkCalibrationExpiryDate || ""} onChange={(e) => setPreloadingField("bulkCalibrationExpiryDate", e.target.value)} />
              </Field>
            </div>
          </div>
        )}
        {isPreloading && (
          <p className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs leading-6 text-blue-950">
            Client checklist measurements (for example, 4 mm tanker tread, extinguisher quantities and underrun-guard dimensions) are used as the supplied pre-loading criteria; confirm any client-specific exceptions separately in writing. No failed safety check is automatically cleared.
          </p>
        )}
      </Card>

      {/* Live progress bar */}
      <Card className="p-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1 text-sm">
              <span className="font-semibold text-slate-900">Checklist Progress</span>
              <span className="text-slate-600">{answered} of {total} checked · {notChecked} outstanding{failed > 0 && <span className="text-red-600 font-semibold"> · {failed} failed</span>}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${(answered / Math.max(1, total)) * 100}%` }}
              />
            </div>
          </div>
          <div className="flex gap-1.5">
            <Badge tone="emerald">{passed} ✓</Badge>
            <Badge tone="red">{failed} ✗</Badge>
            <Badge tone="slate">{na} N/A</Badge>
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
                      {item.result === "unchecked" && <p className="mt-1 text-xs font-semibold text-amber-700">Not checked</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <ResultButton label="Pass" active={item.result === "pass"} tone="emerald" onClick={() => setItemResult(catIdx, itemIdx, "pass")}>
                        <Check className="h-4 w-4" />
                      </ResultButton>
                      <ResultButton label="Fail" active={item.result === "fail"} tone="red" onClick={() => setItemResult(catIdx, itemIdx, "fail")}>
                        <XCircle className="h-4 w-4" />
                      </ResultButton>
                      <ResultButton label={item.optional ? "Not applicable" : "Not applicable (not permitted for required item)"} active={item.result === "na"} tone="slate" disabled={!item.optional} onClick={() => setItemResult(catIdx, itemIdx, "na")}>
                        <Minus className="h-4 w-4" />
                      </ResultButton>
                    </div>
                  </div>

                  {(item.result === "fail" || item.result === "na") && (
                    <div className="mt-2 space-y-2">
                      <TextInput
                        placeholder={item.result === "na" ? "Explain why this equipment is not applicable..." : "Describe the defect and required action..."}
                        value={item.notes || ""}
                        onChange={(e) => setItemNotes(catIdx, itemIdx, e.target.value)}
                        className="text-xs"
                      />
                      {item.result === "fail" && <PhotoCapture
                        value={(item.photos || []).map((p, i) => ({ id: String(i), dataUrl: p, takenAt: new Date().toISOString() }))}
                        onChange={(photos) => setItemPhotos(catIdx, itemIdx, photos)}
                        label="Photo evidence"
                        maxPhotos={3}
                      />}
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
        {isPreloading && (
          <div className="mt-5 border-t border-slate-200 pt-5">
            <Field label="Inspector's Name" required>
              <TextInput value={preloading.inspectorName || ""} onChange={(e) => setPreloadingField("inspectorName", e.target.value)} placeholder="Full name of pre-loading inspector" />
            </Field>
            <div className="mt-4">
              <SignaturePad label="Pre-Loading Inspector Signature (required)" value={inspectorSignature} onChange={setInspectorSignature} />
            </div>
          </div>
        )}
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
        <Button type="submit" disabled={pending || !vehicleId || !signature || notChecked > 0}>
          {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</> : <>Submit Inspection</>}
        </Button>
      </div>
    </form>
  );
}

function ResultButton({ label, active, tone, onClick, disabled = false, children }: { label: string; active: boolean; tone: "emerald" | "red" | "slate"; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  const colors: Record<string, string> = {
    emerald: active ? "bg-emerald-600 text-white" : "text-emerald-600 hover:bg-emerald-50",
    red: active ? "bg-red-600 text-white" : "text-red-600 hover:bg-red-50",
    slate: active ? "bg-slate-700 text-white" : "text-slate-500 hover:bg-slate-100",
  };
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} aria-pressed={active} className={`h-9 w-9 grid place-items-center rounded-lg border transition ${active ? "border-transparent" : "border-slate-200"} ${colors[tone]}`}>
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
