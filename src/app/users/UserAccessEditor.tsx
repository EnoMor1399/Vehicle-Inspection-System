"use client";

import { useState, useTransition } from "react";
import { updateUserAccess } from "./actions";
import { Button, Select } from "@/components/ui";
import { AlertTriangle, ShieldCheck, X } from "lucide-react";

const ROLE_OPTIONS = [
  ["super_admin", "Super Administrator"],
  ["admin", "Administrator"],
  ["operations_manager", "Operations Manager"],
  ["supervisor", "Supervisor"],
  ["inspector", "Inspector"],
  ["data_entry", "Data Entry Officer"],
  ["auditor", "Auditor"],
  ["compliance_officer", "Compliance Officer"],
  ["viewer", "Viewer"],
  ["transporter_user", "Transporter Portal User"],
] as const;

export function UserAccessEditor({
  user,
  locations,
  transporters,
}: {
  user: { id: string; name: string; email: string; role: string; isActive: boolean; locationId?: string | null; transporterId?: string | null };
  locations: { id: string; name: string }[];
  transporters: { id: string; companyName: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState(user.role);
  const [active, setActive] = useState(user.isActive);
  const [locationId, setLocationId] = useState(user.locationId || "");
  const [transporterId, setTransporterId] = useState(user.transporterId || "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await updateUserAccess({ userId: user.id, role, isActive: active, locationId, transporterId });
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to update user access");
      }
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-semibold text-[var(--brand-accent)] hover:opacity-75">
        Manage →
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-labelledby={`user-editor-${user.id}`}>
          <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white"><ShieldCheck className="h-5 w-5" /></div>
                <div>
                  <h2 id={`user-editor-${user.id}`} className="font-semibold text-slate-950">Manage account access</h2>
                  <p className="text-sm text-slate-500">{user.name} · {user.email}</p>
                </div>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close account editor" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Role</label>
                <Select value={role} onChange={(event) => setRole(event.target.value)}>
                  {ROLE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Inspection station</label>
                <Select value={locationId} onChange={(event) => setLocationId(event.target.value)}>
                  <option value="">No station assignment</option>
                  {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                </Select>
              </div>

              {role === "transporter_user" && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <label className="mb-1.5 block text-sm font-medium text-emerald-900">Linked transporter</label>
                  <Select value={transporterId} onChange={(event) => setTransporterId(event.target.value)}>
                    <option value="">Select transporter</option>
                    {transporters.map((transporter) => <option key={transporter.id} value={transporter.id}>{transporter.companyName}</option>)}
                  </Select>
                  <p className="mt-2 text-xs text-emerald-800">This link is the tenant boundary for portal fleet and inspection data.</p>
                </div>
              )}

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4">
                <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} className="h-4 w-4 rounded border-slate-300" />
                <span><strong className="block text-sm text-slate-900">Account active</strong><span className="text-xs text-slate-500">Inactive accounts cannot sign in.</span></span>
              </label>

              {error && <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"><AlertTriangle className="h-4 w-4" />{error}</div>}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
              <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
              <Button onClick={save} disabled={pending}>{pending ? "Saving..." : "Save access"}</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
