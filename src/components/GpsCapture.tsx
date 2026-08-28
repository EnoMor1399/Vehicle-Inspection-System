"use client";

import { useState } from "react";
import { MapPin, Navigation, Loader2 } from "lucide-react";

interface GpsData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string;
}

export function GpsCapture({
  value,
  onChange,
}: {
  value: GpsData | null;
  onChange: (data: GpsData | null) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function capture() {
    if (!("geolocation" in navigator)) {
      setError("Geolocation not supported on this device");
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: new Date().toISOString(),
        });
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
          <MapPin className="h-4 w-4" /> GPS Location
        </p>
        <button
          type="button"
          onClick={capture}
          disabled={loading}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Navigation className="h-3 w-3" />}
          {value ? "Update" : "Capture"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {value ? (
        <div className="text-xs space-y-1">
          <p className="font-mono text-slate-700">
            {value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}
          </p>
          <p className="text-slate-500">
            ±{Math.round(value.accuracy)}m · {new Date(value.timestamp).toLocaleTimeString()}
          </p>
          <a
            href={`https://www.google.com/maps?q=${value.latitude},${value.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--brand-accent)] hover:underline inline-flex items-center gap-1"
          >
            <MapPin className="h-3 w-3" /> View on map
          </a>
        </div>
      ) : (
        <p className="text-xs text-slate-500">Capture GPS coordinates for this inspection</p>
      )}
    </div>
  );
}
