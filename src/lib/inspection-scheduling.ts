export const APPOINTMENT_STATUSES = [
  "scheduled",
  "confirmed",
  "checked_in",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

const TRANSITIONS: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  scheduled: ["confirmed", "cancelled"],
  confirmed: ["checked_in", "cancelled", "no_show"],
  checked_in: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  no_show: [],
};

export function canTransitionAppointment(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function appointmentStatusLabel(status: AppointmentStatus): string {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function capacityLoad(booked: number, capacity: number | null | undefined) {
  const safeBooked = Math.max(0, Math.trunc(booked || 0));
  const safeCapacity = capacity && capacity > 0 ? Math.trunc(capacity) : null;
  if (!safeCapacity) {
    return { booked: safeBooked, capacity: null, percent: null, state: "unknown" as const };
  }
  const percent = Math.round((safeBooked / safeCapacity) * 100);
  return {
    booked: safeBooked,
    capacity: safeCapacity,
    percent,
    state: percent >= 100 ? "full" as const : percent >= 80 ? "busy" as const : "available" as const,
  };
}
