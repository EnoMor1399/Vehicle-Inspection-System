"use client";

import { useState, useTransition } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Plus } from "lucide-react";
import { Button, Card, Field, Select, TextArea, TextInput } from "@/components/ui";
import { createAppointment } from "./server";

type Option = { id: string; label: string };

function defaultScheduledAt() {
  const value = new Date(Date.now() + 60 * 60_000);
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function ScheduleAppointmentForm({
  vehicles,
  stations,
  inspectors,
}: {
  vehicles: Option[];
  stations: Array<Option & { capacity?: number | null }>;
  inspectors: Option[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const form = event.currentTarget;
    const data = new FormData(form);
    const scheduledAt = String(data.get("scheduledAt") || "");
    const parsed = new Date(scheduledAt);
    if (Number.isNaN(parsed.getTime())) {
      setError("Choose a valid appointment date and time.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await createAppointment({
          vehicleId: String(data.get("vehicleId") || ""),
          locationId: String(data.get("locationId") || ""),
          scheduledAt: parsed.toISOString(),
          durationMinutes: Number(data.get("durationMinutes") || 45),
          appointmentType: String(data.get("appointmentType") || "routine"),
          priority: String(data.get("priority") || "normal"),
          assignedInspectorId: String(data.get("assignedInspectorId") || "") || undefined,
          notes: String(data.get("notes") || "") || undefined,
        });
        setSuccess(`Appointment ${result.appointmentNumber} created.`);
        form.reset();
        const dateInput = form.elements.namedItem("scheduledAt") as HTMLInputElement | null;
        if (dateInput) dateInput.value = defaultScheduledAt();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to create appointment.");
      }
    });
  }

  return (
    <Card className="mb-6 p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900">
          <CalendarClock className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-semibold text-[var(--vims-ink)]">Schedule inspection appointment</h2>
          <p className="mt-1 text-sm text-[var(--vims-ink-muted)]">
            Book a vehicle into an active station and optionally assign an inspector.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Vehicle" required>
            <Select name="vehicleId" required defaultValue="">
              <option value="" disabled>Select vehicle</option>
              {vehicles.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </Select>
          </Field>
          <Field label="Inspection station" required>
            <Select name="locationId" required defaultValue="">
              <option value="" disabled>Select station</option>
              {stations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}{item.capacity ? ` · ${item.capacity}/day` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date & time" required>
            <TextInput name="scheduledAt" type="datetime-local" required defaultValue={defaultScheduledAt()} />
          </Field>
          <Field label="Duration">
            <Select name="durationMinutes" defaultValue="45">
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">60 minutes</option>
              <option value="90">90 minutes</option>
              <option value="120">120 minutes</option>
            </Select>
          </Field>
          <Field label="Appointment type">
            <Select name="appointmentType" defaultValue="routine">
              <option value="routine">Routine inspection</option>
              <option value="reinspection">Re-inspection</option>
              <option value="commercial">Commercial / fleet</option>
              <option value="priority">Priority inspection</option>
            </Select>
          </Field>
          <Field label="Priority">
            <Select name="priority" defaultValue="normal">
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </Select>
          </Field>
          <Field label="Assigned inspector">
            <Select name="assignedInspectorId" defaultValue="">
              <option value="">Assign later</option>
              {inspectors.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </Select>
          </Field>
          <Field label="Operational notes">
            <TextArea name="notes" maxLength={2000} placeholder="Optional booking, fleet or access notes" className="min-h-[44px]" />
          </Field>
        </div>

        {(error || success) && (
          <div
            role="status"
            className={`rounded-xl border px-4 py-3 text-sm ${error
              ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/35 dark:text-red-300"
              : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-300"}`}
          >
            {error || success}
          </div>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            <Plus className="h-4 w-4" />
            {pending ? "Scheduling…" : "Schedule appointment"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
