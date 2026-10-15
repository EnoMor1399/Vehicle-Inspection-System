"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowRight, Ban, Check, LogIn, Play, UserX } from "lucide-react";
import { Button } from "@/components/ui";
import type { AppointmentStatus } from "@/lib/inspection-scheduling";
import { updateAppointmentStatus } from "./server";

export function AppointmentActions({
  id,
  status,
  vehicleId,
  stationName,
  linkedInspectionId,
}: {
  id: string;
  status: AppointmentStatus;
  vehicleId: string;
  stationName?: string | null;
  linkedInspectionId?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function change(nextStatus: AppointmentStatus) {
    setError(null);
    startTransition(async () => {
      try {
        await updateAppointmentStatus(id, nextStatus);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to update appointment.");
      }
    });
  }

  if (status === "completed" && linkedInspectionId) {
    return (
      <Link
        href={`/inspections/${linkedInspectionId}`}
        className="inline-flex items-center gap-1 rounded-lg border border-[var(--vims-line-strong)] bg-[var(--vims-panel-solid)] px-2.5 py-1.5 text-xs font-semibold text-[var(--vims-ink-soft)] hover:bg-[var(--vims-panel-soft)]"
      >
        View inspection <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    );
  }

  return (
    <div className="flex min-w-[180px] flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-1.5">
        {status === "scheduled" && (
          <>
            <Button size="sm" variant="success" disabled={pending} onClick={() => change("confirmed")}>
              <Check className="h-3.5 w-3.5" /> Confirm
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => change("cancelled")}>
              <Ban className="h-3.5 w-3.5" /> Cancel
            </Button>
          </>
        )}
        {status === "confirmed" && (
          <>
            <Button size="sm" variant="success" disabled={pending} onClick={() => change("checked_in")}>
              <LogIn className="h-3.5 w-3.5" /> Check in
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => change("no_show")}>
              <UserX className="h-3.5 w-3.5" /> No show
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => change("cancelled")}>
              <Ban className="h-3.5 w-3.5" /> Cancel
            </Button>
          </>
        )}
        {status === "checked_in" && (
          <>
            <Button size="sm" variant="success" disabled={pending} onClick={() => change("in_progress")}>
              <Play className="h-3.5 w-3.5" /> Begin
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => change("cancelled")}>
              <Ban className="h-3.5 w-3.5" /> Cancel
            </Button>
          </>
        )}
        {status === "in_progress" && (
          <>
            <Link
              href={`/inspections/new?vehicleId=${encodeURIComponent(vehicleId)}&appointmentId=${encodeURIComponent(id)}&station=${encodeURIComponent(stationName || "")}`}
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-[var(--brand-color)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:brightness-95"
            >
              Open A–P inspection <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => change("cancelled")}>
              <Ban className="h-3.5 w-3.5" /> Cancel
            </Button>
          </>
        )}
      </div>
      {error && <p className="max-w-[260px] text-right text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
