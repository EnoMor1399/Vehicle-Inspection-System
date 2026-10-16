"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gte, lt, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  inspectionAppointments,
  locations,
  notifications,
  users,
  vehicles,
} from "@/db/schema";
import { canManageInspections, getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  canTransitionAppointment,
  type AppointmentStatus,
} from "@/lib/inspection-scheduling";
import { newId } from "@/lib/utils";

const APPOINTMENT_TYPES = new Set(["routine", "reinspection", "commercial", "priority"]);
const PRIORITIES = new Set(["normal", "high", "urgent"]);
const ASSIGNABLE_ROLES = new Set([
  "super_admin",
  "vehicle_inspection_admin",
  "admin",
  "operations_manager",
  "supervisor",
  "inspector",
]);

export type AppointmentInput = {
  vehicleId: string;
  locationId: string;
  scheduledAt: string;
  durationMinutes?: number;
  appointmentType?: string;
  priority?: string;
  assignedInspectorId?: string;
  notes?: string;
};

async function requireScheduler() {
  const user = await getCurrentUser();
  if (!canManageInspections(user)) throw new Error("Not authorised to manage inspection scheduling");
  return user;
}

function appointmentNumber(id: string, scheduledAt: Date) {
  const stamp = scheduledAt.toISOString().slice(0, 10).replaceAll("-", "");
  return `VIMS-APT-${stamp}-${id.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

function dayRange(value: Date) {
  const start = new Date(value);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 86_400_000);
  return { start, end };
}

export async function createAppointment(input: AppointmentInput) {
  const user = await requireScheduler();

  if (!input.vehicleId) throw new Error("Vehicle is required");
  if (!input.locationId) throw new Error("Inspection station is required");

  const scheduledAt = new Date(input.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) throw new Error("Appointment date and time are invalid");
  if (scheduledAt.getTime() < Date.now() - 15 * 60_000) throw new Error("Appointment cannot be scheduled in the past");
  if (scheduledAt.getTime() > Date.now() + 366 * 86_400_000) throw new Error("Appointment cannot be more than one year ahead");

  const durationMinutes = Math.trunc(Number(input.durationMinutes || 45));
  if (!Number.isFinite(durationMinutes) || durationMinutes < 15 || durationMinutes > 240) {
    throw new Error("Appointment duration must be between 15 and 240 minutes");
  }

  const appointmentType = input.appointmentType || "routine";
  if (!APPOINTMENT_TYPES.has(appointmentType)) throw new Error("Appointment type is invalid");

  const priority = input.priority || "normal";
  if (!PRIORITIES.has(priority)) throw new Error("Appointment priority is invalid");

  const notes = input.notes?.trim() || null;
  if (notes && notes.length > 2000) throw new Error("Appointment notes must not exceed 2000 characters");

  const [[vehicle], [station]] = await Promise.all([
    db.select().from(vehicles).where(and(
      eq(vehicles.organizationId, user.organizationId),
      eq(vehicles.id, input.vehicleId),
    )).limit(1),
    db.select().from(locations).where(and(
      eq(locations.organizationId, user.organizationId),
      eq(locations.id, input.locationId),
    )).limit(1),
  ]);
  if (!vehicle) throw new Error("Vehicle not found");
  if (vehicle.status === "decommissioned") throw new Error("A decommissioned vehicle cannot be scheduled");
  if (!station) throw new Error("Inspection station not found");
  if (station.status !== "active") throw new Error("Appointments can only be scheduled at active stations");

  let assignedInspector: typeof users.$inferSelect | null = null;
  if (input.assignedInspectorId) {
    [assignedInspector] = await db
      .select()
      .from(users)
      .where(and(
        eq(users.organizationId, user.organizationId),
        eq(users.id, input.assignedInspectorId),
      ))
      .limit(1);
    if (!assignedInspector || !assignedInspector.isActive || !ASSIGNABLE_ROLES.has(assignedInspector.role)) {
      throw new Error("Assigned inspector is not available for inspection scheduling");
    }
  }

  const id = newId();
  const number = appointmentNumber(id, scheduledAt);
  const { start, end } = dayRange(scheduledAt);

  await db.transaction(async (tx) => {
    const lockKey = `inspection-schedule:${station.id}:${start.toISOString().slice(0, 10)}`;
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKey}))`);

    const [capacityRow] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(inspectionAppointments)
      .where(
        and(
          eq(inspectionAppointments.organizationId, user.organizationId),
          eq(inspectionAppointments.locationId, station.id),
          gte(inspectionAppointments.scheduledAt, start),
          lt(inspectionAppointments.scheduledAt, end),
          notInArray(inspectionAppointments.status, ["cancelled", "no_show"]),
        ),
      );

    if (station.capacity && Number(capacityRow?.count || 0) >= station.capacity) {
      throw new Error(`${station.name} has reached its configured daily capacity for this date`);
    }

    const [vehicleBooking] = await tx
      .select({ id: inspectionAppointments.id })
      .from(inspectionAppointments)
      .where(
        and(
          eq(inspectionAppointments.organizationId, user.organizationId),
          eq(inspectionAppointments.vehicleId, vehicle.id),
          gte(inspectionAppointments.scheduledAt, start),
          lt(inspectionAppointments.scheduledAt, end),
          notInArray(inspectionAppointments.status, ["cancelled", "no_show"]),
        ),
      )
      .limit(1);

    if (vehicleBooking) {
      throw new Error("This vehicle already has an active appointment on the selected date");
    }

    await tx.insert(inspectionAppointments).values({
      id,
      organizationId: user.organizationId,
      appointmentNumber: number,
      vehicleId: vehicle.id,
      locationId: station.id,
      scheduledAt,
      durationMinutes,
      appointmentType,
      priority,
      status: "scheduled",
      assignedInspectorId: assignedInspector?.id || null,
      notes,
      bookedBy: user.id,
    });

    if (assignedInspector) {
      await tx.insert(notifications).values({
        id: newId(),
        organizationId: user.organizationId,
        userId: assignedInspector.id,
        type: "system",
        title: "Inspection appointment assigned",
        message: `${vehicle.registrationNumber} is scheduled at ${station.name} for ${scheduledAt.toLocaleString("en-GB")}.`,
        entityType: "inspection_appointment",
        entityId: id,
        dueDate: scheduledAt.toISOString().slice(0, 10),
        channel: "in_app",
      });
    }
  });

  await logAudit({
    organizationId: user.organizationId,
    userId: user.id,
    userName: user.name,
    action: "create",
    entityType: "inspection_appointment",
    entityId: id,
    entityLabel: number,
    summary: `Scheduled ${number} for ${vehicle.registrationNumber} at ${station.name}`,
    after: {
      vehicle: vehicle.registrationNumber,
      station: station.name,
      scheduledAt: scheduledAt.toISOString(),
      assignedInspector: assignedInspector?.name || null,
      priority,
      appointmentType,
    },
  });

  revalidatePath("/schedule");
  revalidatePath("/");
  revalidatePath("/notifications");
  return { id, appointmentNumber: number };
}

export async function updateAppointmentStatus(id: string, nextStatus: AppointmentStatus) {
  const user = await requireScheduler();
  if (!id || id.length > 64) throw new Error("Appointment reference is invalid");

  const [row] = await db
    .select({
      appointment: inspectionAppointments,
      registrationNumber: vehicles.registrationNumber,
      stationName: locations.name,
    })
    .from(inspectionAppointments)
    .innerJoin(vehicles, eq(vehicles.id, inspectionAppointments.vehicleId))
    .leftJoin(locations, eq(locations.id, inspectionAppointments.locationId))
    .where(and(
      eq(inspectionAppointments.organizationId, user.organizationId),
      eq(vehicles.organizationId, user.organizationId),
      eq(inspectionAppointments.id, id),
    ))
    .limit(1);

  if (!row) throw new Error("Appointment not found");
  if (!canTransitionAppointment(row.appointment.status, nextStatus)) {
    throw new Error(`Cannot move appointment from ${row.appointment.status} to ${nextStatus}`);
  }
  if (nextStatus === "completed" && !row.appointment.linkedInspectionId) {
    throw new Error("Complete the linked inspection to close this appointment");
  }

  await db
    .update(inspectionAppointments)
    .set({ status: nextStatus, updatedAt: new Date() })
    .where(and(
      eq(inspectionAppointments.organizationId, user.organizationId),
      eq(inspectionAppointments.id, id),
    ));

  await logAudit({
    organizationId: user.organizationId,
    userId: user.id,
    userName: user.name,
    action: "update",
    entityType: "inspection_appointment",
    entityId: id,
    entityLabel: row.appointment.appointmentNumber,
    summary: `Changed appointment ${row.appointment.appointmentNumber} from ${row.appointment.status} to ${nextStatus}`,
    before: { status: row.appointment.status },
    after: { status: nextStatus },
  });

  revalidatePath("/schedule");
  revalidatePath("/");
  return { updated: true };
}
