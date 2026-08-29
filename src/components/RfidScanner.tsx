"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Copy,
  Loader2,
  Radio,
  RotateCcw,
  ScanLine,
  Search,
  Truck,
  X,
} from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";

type VehicleResult = {
  id: string;
  registrationNumber?: string | null;
  make?: string | null;
  model?: string | null;
  vin?: string | null;
  chassisNumber?: string | null;
  bodyType?: string | null;
  manufacturingYear?: number | null;
  status?: string | null;
  category?: string | null;
  colour?: string | null;
};

type ScanResult = {
  found: true;
  data: VehicleResult;
  rfid?: {
    id?: string;
    tag_uid?: string;
    assigned_at?: string | null;
  };
  scanned_at?: string;
};

type RecentScan = {
  tag: string;
  vehicleId: string;
  registrationNumber: string;
  makeModel: string;
  scannedAt: string;
};

export function RfidScanner() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [tag, setTag] = useState("");
  const [scanning, setScanning] = useState(false);
  const [focused, setFocused] = useState(true);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);
  const [copied, setCopied] = useState(false);

  async function scan(overrideTag?: string) {
    const value = (overrideTag ?? tag).trim();
    if (!value) {
      setError("Scan or enter an RFID tag first.");
      inputRef.current?.focus();
      return;
    }
    if (scanning) return;

    setScanning(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/v1/rfid?tag=${encodeURIComponent(value)}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error?.message || data?.message || `RFID lookup failed (${res.status}).`);
      }
      if (!data?.found || !data?.data) {
        setError("No active vehicle is assigned to this RFID tag.");
        return;
      }

      const found = data as ScanResult;
      setResult(found);
      setTag(value);

      const registrationNumber = found.data.registrationNumber || "Unregistered";
      const makeModel = [found.data.make, found.data.model].filter(Boolean).join(" ") || "Vehicle";
      const scannedAt = found.scanned_at || new Date().toISOString();

      setRecentScans((current) => {
        const next: RecentScan = {
          tag: value,
          vehicleId: found.data.id,
          registrationNumber,
          makeModel,
          scannedAt,
        };
        return [next, ...current.filter((item) => item.tag !== value)].slice(0, 6);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to complete the RFID scan.");
    } finally {
      setScanning(false);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  function clearScan() {
    setTag("");
    setResult(null);
    setError(null);
    setCopied(false);
    inputRef.current?.focus();
  }

  async function copyTag() {
    if (!tag.trim()) return;
    try {
      await navigator.clipboard.writeText(tag.trim());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Unable to copy the tag. Select it manually instead.");
    }
  }

  const statusTone = vehicleStatusTone(result?.data.status);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-5">
        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-950 px-5 py-5 text-white sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <Radio className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Scan vehicle tag</h2>
                  <p className="mt-0.5 text-sm text-slate-300">Keep this field focused, then scan with the RFID reader.</p>
                </div>
              </div>
              <Badge tone={focused ? "emerald" : "slate"}>
                <span className={`h-1.5 w-1.5 rounded-full ${focused ? "bg-emerald-500" : "bg-slate-400"}`} />
                {focused ? "Input ready" : "Click scan field"}
              </Badge>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <label className="mb-2 block text-sm font-semibold text-slate-700">RFID tag UID</label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <ScanLine className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={tag}
                  onChange={(event) => {
                    setTag(event.target.value);
                    setError(null);
                  }}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void scan();
                    }
                  }}
                  placeholder="Scan or enter RFID tag"
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-12 pr-20 font-mono text-sm text-slate-950 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={128}
                />
                {tag && (
                  <button
                    type="button"
                    onClick={clearScan}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Clear RFID tag"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button onClick={() => void scan()} disabled={scanning} className="h-12 sm:min-w-32">
                {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {scanning ? "Reading…" : "Scan"}
              </Button>
            </div>
            <p className="mt-2 text-xs text-slate-500">USB and Bluetooth keyboard-wedge readers can submit automatically with Enter.</p>

            {error && (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </Card>

        {result ? (
          <Card className="overflow-hidden border-emerald-200">
            <div className="flex flex-col gap-4 border-b border-emerald-100 bg-emerald-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-white">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Vehicle identified</p>
                  <h3 className="mt-0.5 text-xl font-bold text-slate-950">{result.data.registrationNumber || "Registration not recorded"}</h3>
                </div>
              </div>
              <Badge tone={statusTone}>{formatStatus(result.data.status)}</Badge>
            </div>

            <div className="p-5 sm:p-6">
              <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                <Info label="Make / Model" value={[result.data.make, result.data.model].filter(Boolean).join(" ")} />
                <Info label="VIN" value={result.data.vin} mono />
                <Info label="Chassis Number" value={result.data.chassisNumber} mono />
                <Info label="Body Type" value={result.data.bodyType} />
                <Info label="Category" value={result.data.category} />
                <Info label="Manufacturing Year" value={result.data.manufacturingYear} />
              </div>

              <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-5">
                <Link href={`/vehicles/${result.data.id}`} className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">
                  <Truck className="h-4 w-4" /> View Vehicle
                </Link>
                <Link href={`/inspections/new?vehicleId=${result.data.id}`} className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700">
                  Start Inspection
                </Link>
                <Link href={`/daily-inspections/new?vehicleId=${result.data.id}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  Start Pre-Trip
                </Link>
                <Button variant="ghost" size="sm" onClick={copyTag} className="ml-auto">
                  <Copy className="h-4 w-4" /> {copied ? "Copied" : "Copy tag"}
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="grid min-h-56 place-items-center p-6 text-center">
            <div>
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
                <ScanLine className="h-6 w-6" />
              </div>
              <p className="mt-3 font-semibold text-slate-900">Waiting for a vehicle tag</p>
              <p className="mt-1 text-sm text-slate-500">A matched vehicle will appear here immediately after scanning.</p>
            </div>
          </Card>
        )}

        <details className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-800 sm:px-6">
            RFID reader & API setup
          </summary>
          <div className="border-t border-slate-200 px-5 py-5 text-sm text-slate-600 sm:px-6">
            <p>Connect a USB or Bluetooth keyboard-wedge RFID reader and keep the scan field focused. API integrations can call the secured RFID endpoint using a VIMS API key with Read scope.</p>
            <div className="mt-4 rounded-xl bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-200">
              GET /api/v1/rfid?tag=&lt;rfid-tag-uid&gt;<br />
              X-API-Key: vims_live_…
            </div>
          </div>
        </details>
      </div>

      <aside className="space-y-5">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-950">Recent scans</h3>
              <p className="mt-1 text-xs text-slate-500">Current browser session</p>
            </div>
            {recentScans.length > 0 && <Badge tone="slate">{recentScans.length}</Badge>}
          </div>

          {recentScans.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              <Clock3 className="mx-auto mb-2 h-6 w-6 text-slate-300" />
              No scans yet
            </div>
          ) : (
            <div className="mt-4 divide-y divide-slate-100">
              {recentScans.map((item) => (
                <div key={`${item.tag}-${item.scannedAt}`} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/vehicles/${item.vehicleId}`} className="font-semibold text-slate-900 hover:underline">
                        {item.registrationNumber}
                      </Link>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{item.makeModel}</p>
                      <p className="mt-1 truncate font-mono text-[11px] text-slate-400">{item.tag}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setTag(item.tag);
                        void scan(item.tag);
                      }}
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      aria-label={`Scan ${item.registrationNumber} again`}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">{formatTime(item.scannedAt)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-slate-950">Scanner workflow</h3>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <Step number="1" text="Focus the RFID scan field." />
            <Step number="2" text="Scan the vehicle tag with the reader." />
            <Step number="3" text="Verify the registration and vehicle status." />
            <Step number="4" text="Open the vehicle, inspection or Pre-Trip workflow." />
          </div>
        </Card>
      </aside>
    </div>
  );
}

function Info({ label, value, mono = false }: { label: string; value: unknown; mono?: boolean }) {
  const display = value === null || value === undefined || value === "" ? "—" : String(value);
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-400">{label}</p>
      <p className={`mt-1 font-semibold text-slate-900 ${mono ? "font-mono text-sm" : ""}`}>{display}</p>
    </div>
  );
}

function Step({ number, text }: { number: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{number}</span>
      <span className="pt-0.5">{text}</span>
    </div>
  );
}

function formatStatus(value?: string | null) {
  if (!value) return "Status unknown";
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function vehicleStatusTone(value?: string | null): "emerald" | "amber" | "red" | "slate" {
  const normalized = (value || "").toLowerCase();
  if (["active", "compliant", "roadworthy"].includes(normalized)) return "emerald";
  if (["inactive", "suspended", "grounded", "out_of_service"].includes(normalized)) return "red";
  if (["maintenance", "pending", "due"].includes(normalized)) return "amber";
  return "slate";
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}
