"use client";

import { useState } from "react";
import { Radio, Scan, Loader2, Car, AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, Badge, Button } from "@/components/ui";

export function RfidScanner() {
  const [tag, setTag] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function scan() {
    if (!tag.trim()) {
      setError("Please enter or scan an RFID tag");
      return;
    }
    setScanning(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/v1/rfid?tag=${encodeURIComponent(tag.trim())}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error.message);
      } else if (!data.found) {
        setError("No vehicle found for this RFID tag");
      } else {
        setResult(data);
      }
    } catch (err: any) {
      setError(err.message || "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  function simulateScan() {
    // Simulate an RFID scanner reading a tag
    setTag("YV3R1234567890123");
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-12 w-12 rounded-xl bg-violet-100 text-violet-700 grid place-items-center">
            <Radio className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">RFID Vehicle Scanner</h2>
            <p className="text-sm text-slate-500">Scan an RFID tag to instantly retrieve vehicle details</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <input
              type="text"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && scan()}
              placeholder="Enter RFID tag, VIN, or registration..."
              className="w-full px-4 py-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 font-mono"
              autoFocus
            />
            <Scan className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          </div>

          <div className="flex gap-2">
            <Button onClick={scan} disabled={scanning}>
              {scanning ? <><Loader2 className="h-4 w-4 animate-spin" /> Scanning...</> : <><Scan className="h-4 w-4" /> Scan</>}
            </Button>
            <Button variant="secondary" onClick={simulateScan}>
              Simulate Scanner
            </Button>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> {error}
            </div>
          )}

          {result && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <p className="font-semibold text-emerald-900">Vehicle Found</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Info label="Registration" value={result.data.registrationNumber} />
                <Info label="Make / Model" value={`${result.data.make} ${result.data.model || ""}`} />
                <Info label="VIN" value={result.data.vin} />
                <Info label="Status" value={result.data.status} />
                <Info label="Body Type" value={result.data.bodyType} />
                <Info label="Mfg. Year" value={result.data.manufacturingYear} />
              </div>
              <div className="mt-3 flex gap-2">
                <a
                  href={`/vehicles/${result.data.id}`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800"
                >
                  <Car className="h-3 w-3" /> View Vehicle
                </a>
                <a
                  href={`/inspections/new?vehicleId=${result.data.id}`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700"
                >
                  Start Inspection
                </a>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold text-slate-950 mb-3">Integration Guide</h3>
        <p className="text-sm text-slate-600 mb-3">
          Connect your RFID hardware scanner via USB/Bluetooth. The scanner acts as a keyboard input —
          simply focus this field and scan.
        </p>
        <pre className="rounded-lg bg-slate-900 text-slate-100 p-3 text-xs overflow-x-auto">
{`# API endpoint
GET /api/v1/rfid?tag=<rfid-tag-id>

# Headers
X-API-Key: rsl_live_...

# Response
{
  "data": { /* vehicle */ },
  "found": true,
  "tag": "...",
  "scanned_at": "..."
}`}
        </pre>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-medium text-slate-900">{value || "—"}</p>
    </div>
  );
}
