"use client";

import { useState, useTransition } from "react";
import { Building2, Loader2, Pencil, Plus, X } from "lucide-react";
import { Button, Field, Select, TextArea, TextInput } from "@/components/ui";
import { saveStation, type StationInput } from "./actions";

type Station = StationInput & { id: string };

export function StationEditor({ station }: { station?: Station }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StationInput>(() => ({
    id: station?.id,
    name: station?.name || "",
    code: station?.code || "",
    region: station?.region || "",
    district: station?.district || "",
    address: station?.address || "",
    gpsAddress: station?.gpsAddress || "",
    phone: station?.phone || "",
    email: station?.email || "",
    managerName: station?.managerName || "",
    capacity: station?.capacity ?? null,
    equipment: station?.equipment || [],
    status: station?.status || "active",
  }));
  const [equipmentText, setEquipmentText] = useState((station?.equipment || []).join(", "));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await saveStation({
          ...data,
          equipment: equipmentText.split(",").map((item) => item.trim()).filter(Boolean),
        });
        setOpen(false);
        if (!station) {
          setData({ name: "", code: "", status: "active" });
          setEquipmentText("");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to save station");
      }
    });
  }

  return (
    <>
      {station ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <Pencil className="h-3.5 w-3.5" /> Edit
        </button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Add Station
        </Button>
      )}

      {open && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white"><Building2 className="h-5 w-5" /></div>
                <div>
                  <h2 className="font-semibold text-slate-950">{station ? "Edit Inspection Station" : "Add Inspection Station"}</h2>
                  <p className="text-xs text-slate-500">Maintain controlled station details and operational status.</p>
                </div>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close station editor"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={submit} className="space-y-5 p-5">
              {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Station Name" required><TextInput required value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} /></Field>
                <Field label="Station Code" required hint="2-20 letters/numbers; stored in uppercase"><TextInput required value={data.code} onChange={(e) => setData({ ...data, code: e.target.value })} /></Field>
                <Field label="Region"><TextInput value={data.region || ""} onChange={(e) => setData({ ...data, region: e.target.value })} /></Field>
                <Field label="District"><TextInput value={data.district || ""} onChange={(e) => setData({ ...data, district: e.target.value })} /></Field>
                <Field label="Manager"><TextInput value={data.managerName || ""} onChange={(e) => setData({ ...data, managerName: e.target.value })} /></Field>
                <Field label="Daily Capacity"><TextInput type="number" min={0} max={10000} value={data.capacity ?? ""} onChange={(e) => setData({ ...data, capacity: e.target.value ? Number(e.target.value) : null })} /></Field>
                <Field label="Phone"><TextInput value={data.phone || ""} onChange={(e) => setData({ ...data, phone: e.target.value })} /></Field>
                <Field label="Email"><TextInput type="email" value={data.email || ""} onChange={(e) => setData({ ...data, email: e.target.value })} /></Field>
                <Field label="GPS Address"><TextInput value={data.gpsAddress || ""} onChange={(e) => setData({ ...data, gpsAddress: e.target.value })} /></Field>
                <Field label="Status"><Select value={data.status || "active"} onChange={(e) => setData({ ...data, status: e.target.value as StationInput["status"] })}><option value="active">Active</option><option value="maintenance">Maintenance</option><option value="inactive">Inactive</option></Select></Field>
              </div>
              <Field label="Physical Address"><TextArea rows={2} value={data.address || ""} onChange={(e) => setData({ ...data, address: e.target.value })} /></Field>
              <Field label="Equipment" hint="Comma-separated equipment names"><TextInput value={equipmentText} onChange={(e) => setEquipmentText(e.target.value)} placeholder="Brake tester, headlamp tester, emission analyzer" /></Field>
              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
                <Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}{station ? "Save Changes" : "Create Station"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
