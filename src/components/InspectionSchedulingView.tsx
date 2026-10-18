import { and, asc, eq, gte, inArray, ne } from "drizzle-orm";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Gauge,
  UserRoundCheck,
} from "lucide-react";
import { db } from "@/db";
import {
  inspectionAppointments,
  locations,
  users,
  vehicles,
} from "@/db/schema";
import { Badge, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import {
  appointmentStatusLabel,
  capacityLoad,
  type AppointmentStatus,
} from "@/lib/inspection-scheduling";
import { formatDateTime } from "@/lib/utils";
import { AppointmentActions } from "@/app/schedule/AppointmentActions";
import { ScheduleAppointmentForm } from "@/app/schedule/ScheduleAppointmentForm";

const ACTIVE_STATUSES: AppointmentStatus[] = ["scheduled", "confirmed", "checked_in", "in_progress"];
const ASSIGNABLE_ROLES = ["super_admin", "vehicle_inspection_admin", "admin", "operations_manager", "supervisor", "inspector"] as const;

function toneForStatus(status: AppointmentStatus): "slate" | "blue" | "amber" | "emerald" | "red" | "violet" {
  if (status === "scheduled") return "slate";
  if (status === "confirmed") return "blue";
  if (status === "checked_in") return "amber";
  if (status === "in_progress") return "violet";
  if (status === "completed") return "emerald";
  if (status === "no_show") return "red";
  return "slate";
}

function toneForPriority(priority: string): "slate" | "amber" | "red" {
  if (priority === "urgent") return "red";
  if (priority === "high") return "amber";
  return "slate";
}

function sameUtcDate(a: Date, b: Date) {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

export async function InspectionSchedulingView({ organizationId, canSchedule = false }: { organizationId: string; canSchedule?: boolean }) {

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const listStart = new Date(todayStart.getTime() - 86_400_000);
  const sevenDayEnd = new Date(todayStart.getTime() + 7 * 86_400_000);

  const [appointments, stationRows, vehicleRows, inspectorRows] = await Promise.all([
    db
      .select({
        id: inspectionAppointments.id,
        appointmentNumber: inspectionAppointments.appointmentNumber,
        vehicleId: inspectionAppointments.vehicleId,
        locationId: inspectionAppointments.locationId,
        scheduledAt: inspectionAppointments.scheduledAt,
        durationMinutes: inspectionAppointments.durationMinutes,
        appointmentType: inspectionAppointments.appointmentType,
        priority: inspectionAppointments.priority,
        status: inspectionAppointments.status,
        notes: inspectionAppointments.notes,
        assignedInspectorId: inspectionAppointments.assignedInspectorId,
        linkedInspectionId: inspectionAppointments.linkedInspectionId,
        registrationNumber: vehicles.registrationNumber,
        make: vehicles.make,
        model: vehicles.model,
        stationName: locations.name,
        inspectorName: users.name,
      })
      .from(inspectionAppointments)
      .innerJoin(vehicles, and(eq(vehicles.id, inspectionAppointments.vehicleId), eq(vehicles.organizationId, organizationId)))
      .leftJoin(locations, and(eq(locations.id, inspectionAppointments.locationId), eq(locations.organizationId, organizationId)))
      .leftJoin(users, and(eq(users.id, inspectionAppointments.assignedInspectorId), eq(users.organizationId, organizationId)))
      .where(and(
        eq(inspectionAppointments.organizationId, organizationId),
        eq(vehicles.organizationId, organizationId),
        gte(inspectionAppointments.scheduledAt, listStart),
      ))
      .orderBy(asc(inspectionAppointments.scheduledAt))
      .limit(250),
    db
      .select({
        id: locations.id,
        name: locations.name,
        code: locations.code,
        capacity: locations.capacity,
        region: locations.region,
      })
      .from(locations)
      .where(and(
        eq(locations.organizationId, organizationId),
        eq(locations.status, "active"),
      ))
      .orderBy(asc(locations.name)),
    db
      .select({
        id: vehicles.id,
        registrationNumber: vehicles.registrationNumber,
        make: vehicles.make,
        model: vehicles.model,
      })
      .from(vehicles)
      .where(and(
        eq(vehicles.organizationId, organizationId),
        ne(vehicles.status, "decommissioned"),
      ))
      .orderBy(asc(vehicles.registrationNumber)),
    db
      .select({ id: users.id, name: users.name, role: users.role })
      .from(users)
      .where(
        and(
          eq(users.organizationId, organizationId),
          eq(users.isActive, true),
          inArray(users.role, [...ASSIGNABLE_ROLES]),
        ),
      )
      .orderBy(asc(users.name)),
  ]);

  const visibleInspectors = inspectorRows.filter((item) => Boolean(item.name));
  const active = appointments.filter((item) => ACTIVE_STATUSES.includes(item.status));
  const today = active.filter((item) => sameUtcDate(new Date(item.scheduledAt), now));
  const nextSevenDays = active.filter((item) => {
    const at = new Date(item.scheduledAt);
    return at >= todayStart && at < sevenDayEnd;
  });
  const inService = active.filter((item) => item.status === "checked_in" || item.status === "in_progress").length;
  const unassigned = active.filter((item) => !item.assignedInspectorId).length;

  const stationLoad = stationRows.map((station) => {
    const count = today.filter((item) => item.locationId === station.id).length;
    return { ...station, load: capacityLoad(count, station.capacity) };
  });

  return (
    <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8 xl:p-10">
      <PageHeader
        title="Inspection Scheduling & Capacity"
        description="Book inspections, balance station workload, assign inspectors, check vehicles in and hand scheduled work directly into the A–P inspection workflow."
        action={<Badge tone="blue"><CalendarClock className="h-3.5 w-3.5" /> Operations scheduling</Badge>}
      />

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Appointments today"
          value={today.length}
          hint="Active bookings"
          tone="blue"
          icon={<CalendarClock className="h-5 w-5" />}
        />
        <StatCard
          label="Next 7 days"
          value={nextSevenDays.length}
          hint="Scheduled workload"
          tone="violet"
          icon={<Clock3 className="h-5 w-5" />}
        />
        <StatCard
          label="Checked in / active"
          value={inService}
          hint="Vehicles at stations"
          tone={inService ? "amber" : "emerald"}
          icon={<UserRoundCheck className="h-5 w-5" />}
        />
        <StatCard
          label="Unassigned"
          value={unassigned}
          hint="Needs inspector assignment"
          tone={unassigned ? "amber" : "emerald"}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </section>

      {canSchedule && (
        <ScheduleAppointmentForm
          vehicles={vehicleRows.map((item) => ({
            id: item.id,
            label: `${item.registrationNumber} · ${item.make} ${item.model || ""}`.trim(),
          }))}
          stations={stationRows.map((item) => ({
            id: item.id,
            label: `${item.name} · ${item.code}`,
            capacity: item.capacity,
          }))}
          inspectors={visibleInspectors.map((item) => ({
            id: item.id,
            label: `${item.name} · ${item.role.replaceAll("_", " ")}`,
          }))}
        />
      )}

      <section className="mb-6">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-semibold text-[var(--vims-ink)]">Today’s station capacity</h2>
            <p className="mt-1 text-sm text-[var(--vims-ink-muted)]">Current active bookings against configured daily station capacity.</p>
          </div>
        </div>
        {stationLoad.length === 0 ? (
          <Card className="p-5">
            <EmptyState title="No active inspection stations" description="Activate a station before accepting inspection appointments." />
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {stationLoad.map((station) => (
              <Card key={station.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[var(--vims-ink)]">{station.name}</p>
                    <p className="mt-0.5 text-xs text-[var(--vims-ink-muted)]">
                      {station.region || "Region not recorded"} · {station.code}
                    </p>
                  </div>
                  <Gauge className="h-5 w-5 shrink-0 text-[var(--vims-ink-muted)]" />
                </div>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-2xl font-semibold text-[var(--vims-ink)]">
                      {station.load.booked}{station.load.capacity ? `/${station.load.capacity}` : ""}
                    </p>
                    <p className="text-xs text-[var(--vims-ink-muted)]">booked today</p>
                  </div>
                  <Badge tone={
                    station.load.state === "full"
                      ? "red"
                      : station.load.state === "busy"
                        ? "amber"
                        : station.load.state === "available"
                          ? "emerald"
                          : "slate"
                  }>
                    {station.load.percent === null ? "Capacity not set" : `${station.load.percent}% load`}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3">
          <h2 className="font-semibold text-[var(--vims-ink)]">Appointment queue</h2>
          <p className="mt-1 text-sm text-[var(--vims-ink-muted)]">Yesterday onward, ordered by scheduled time.</p>
        </div>

        {appointments.length === 0 ? (
          <Card className="p-5 sm:p-6">
            <EmptyState
              icon={<CalendarClock className="h-9 w-9" />}
              title="No appointments scheduled"
              description={canSchedule ? "Use the scheduling form above to create the first inspection appointment." : "Scheduled inspections will appear here."}
            />
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-sm">
                <thead className="border-b border-[var(--vims-line)] bg-[var(--vims-panel-soft)]">
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--vims-ink-muted)]">
                    <th className="px-4 py-3">Appointment</th>
                    <th className="px-4 py-3">Vehicle</th>
                    <th className="px-4 py-3">Scheduled</th>
                    <th className="px-4 py-3">Station</th>
                    <th className="px-4 py-3">Inspector</th>
                    <th className="px-4 py-3">Type / priority</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Workflow</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--vims-line)]">
                  {appointments.map((item) => (
                    <tr key={item.id} className="align-top hover:bg-[var(--vims-panel-soft)]">
                      <td className="px-4 py-4">
                        <p className="font-mono text-xs font-semibold text-[var(--vims-ink)]">{item.appointmentNumber}</p>
                        <p className="mt-1 text-[11px] text-[var(--vims-ink-muted)]">{item.durationMinutes} min</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-semibold text-[var(--vims-ink)]">{item.registrationNumber}</p>
                        <p className="mt-1 text-xs text-[var(--vims-ink-muted)]">{item.make} {item.model || ""}</p>
                      </td>
                      <td className="px-4 py-4 text-[var(--vims-ink-soft)]">{formatDateTime(item.scheduledAt)}</td>
                      <td className="px-4 py-4 text-[var(--vims-ink-soft)]">{item.stationName || "Station removed"}</td>
                      <td className="px-4 py-4 text-[var(--vims-ink-soft)]">{item.inspectorName || "Unassigned"}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          <Badge tone="blue">{item.appointmentType.replaceAll("_", " ")}</Badge>
                          <Badge tone={toneForPriority(item.priority)}>{item.priority}</Badge>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge tone={toneForStatus(item.status)}>
                          {item.status === "completed" && <CheckCircle2 className="h-3.5 w-3.5" />}
                          {appointmentStatusLabel(item.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-right">
                        {canSchedule ? (
                          <AppointmentActions
                            id={item.id}
                            status={item.status}
                            vehicleId={item.vehicleId}
                            stationName={item.stationName}
                            linkedInspectionId={item.linkedInspectionId}
                          />
                        ) : (
                          <span className="text-xs text-[var(--vims-ink-muted)]">View only</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}
