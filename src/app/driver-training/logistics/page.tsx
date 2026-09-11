import type { ReactNode } from "react";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { AlertTriangle, Boxes, CalendarRange, CheckCircle2, PackageCheck, Truck } from "lucide-react";
import { db } from "@/db";
import { trainingSessions } from "@/db/training-schema";
import { trainingResourceAllocations, trainingResources } from "@/db/training-logistics-schema";
import { Badge, Button, Card, EmptyState, PageHeader, StatCard, TextArea, TextInput as Input } from "@/components/ui";
import { DRIVER_TRAINING_SERVICES } from "@/lib/driver-training";
import { requireInternalUser } from "@/lib/require-auth";
import { canManageTraining, canViewTraining } from "@/lib/training-access";
import { trainingResourceOperationalState } from "@/lib/training-logistics-policy";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  createTrainingResource,
  reserveTrainingResource,
  updateTrainingResourceAllocationStatus,
  updateTrainingResourceStatus,
} from "./actions";

export const dynamic = "force-dynamic";

const serviceNames = new Map(DRIVER_TRAINING_SERVICES.map((service) => [service.id, service.title]));
const ACTIVE_ALLOCATION_STATUSES = ["reserved", "confirmed"] as const;

export default async function TrainingLogisticsPage() {
  const user = await requireInternalUser();
  if (!canViewTraining(user)) {
    return <div className="p-8 text-sm text-slate-600">You do not have access to Driver Training & Assessment Services.</div>;
  }
  const canManage = canManageTraining(user);

  const [resources, allocations, scheduledSessions] = await Promise.all([
    db.select().from(trainingResources).orderBy(asc(trainingResources.resourceType), asc(trainingResources.resourceCode)).limit(400),
    db
      .select({ allocation: trainingResourceAllocations, resource: trainingResources, session: trainingSessions })
      .from(trainingResourceAllocations)
      .innerJoin(trainingResources, eq(trainingResources.id, trainingResourceAllocations.resourceId))
      .innerJoin(trainingSessions, eq(trainingSessions.id, trainingResourceAllocations.sessionId))
      .orderBy(desc(trainingSessions.startAt), desc(trainingResourceAllocations.allocatedAt))
      .limit(600),
    db
      .select()
      .from(trainingSessions)
      .where(eq(trainingSessions.status, "scheduled"))
      .orderBy(asc(trainingSessions.startAt))
      .limit(250),
  ]);

  const now = new Date();
  const states = new Map(resources.map((resource) => [resource.id, trainingResourceOperationalState(resource, now)]));
  const readyResources = resources.filter((resource) => ["ready", "attention"].includes(states.get(resource.id) || "")).length;
  const blockedResources = resources.filter((resource) => ["blocked", "retired", "overdue"].includes(states.get(resource.id) || "")).length;
  const activeAllocations = allocations.filter(({ allocation }) => ACTIVE_ALLOCATION_STATUSES.includes(allocation.status as typeof ACTIVE_ALLOCATION_STATUSES[number]));
  const atRiskAllocations = activeAllocations.filter(({ resource }) => ["blocked", "retired", "overdue"].includes(states.get(resource.id) || ""));

  return (
    <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Training Logistics & Resources"
        description="Control training vehicles, simulators, classrooms, equipment and materials; prevent booking conflicts; and surface maintenance or inspection risks before delivery."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Resources" value={resources.length} hint="Registered delivery assets" tone="blue" icon={<Boxes className="h-5 w-5" />} />
        <StatCard label="Operational" value={readyResources} hint="Ready or due for attention" tone="emerald" icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard label="Unavailable" value={blockedResources} hint="Blocked, overdue or retired" tone={blockedResources > 0 ? "red" : "slate"} icon={<AlertTriangle className="h-5 w-5" />} />
        <StatCard label="At-risk allocations" value={atRiskAllocations.length} hint={`${activeAllocations.length} active reservations`} tone={atRiskAllocations.length > 0 ? "amber" : "slate"} icon={<CalendarRange className="h-5 w-5" />} />
      </div>

      {canManage && (
        <section className="mt-6 grid gap-6 xl:grid-cols-2">
          <Card className="p-5 sm:p-6">
            <h2 className="font-semibold text-[var(--vims-ink)]">Register training resource</h2>
            <p className="mt-1 text-sm text-[var(--vims-ink-muted)]">Exclusive assets represent one bookable unit; shared resources use available quantity for concurrent demand checks.</p>
            <form action={createTrainingResource} className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Resource code"><Input name="resourceCode" required maxLength={40} placeholder="TRV-001" /></Field>
              <Field label="Resource type"><select name="resourceType" required className={selectClass}><option value="">Select type</option><option value="vehicle">Vehicle</option><option value="simulator">Simulator</option><option value="classroom">Classroom</option><option value="training_equipment">Training equipment</option><option value="safety_equipment">Safety equipment</option><option value="materials">Materials</option><option value="audiovisual">Audiovisual</option><option value="other">Other</option></select></Field>
              <Field label="Name" className="sm:col-span-2"><Input name="name" required maxLength={220} /></Field>
              <Field label="Identifier / registration"><Input name="identifier" maxLength={140} /></Field>
              <Field label="Status"><select name="status" defaultValue="available" className={selectClass}><option value="available">Available</option><option value="maintenance">Maintenance</option><option value="out_of_service">Out of service</option><option value="retired">Retired</option></select></Field>
              <Field label="Available quantity"><Input name="availableQuantity" type="number" min="1" max="100000" defaultValue="1" /></Field>
              <Field label="Capacity"><Input name="capacity" type="number" min="1" max="10000" defaultValue="1" /></Field>
              <Field label="Service due"><Input name="serviceDueDate" type="date" /></Field>
              <Field label="Inspection due"><Input name="inspectionDueDate" type="date" /></Field>
              <label className="sm:col-span-2 flex items-center gap-2 text-sm font-medium text-[var(--vims-ink-soft)]"><input type="checkbox" name="isExclusive" defaultChecked className="h-4 w-4 rounded border-slate-300" /> Exclusive resource — cannot serve overlapping sessions</label>
              <Field label="Notes" className="sm:col-span-2"><TextArea name="notes" maxLength={4000} className="min-h-[80px]" /></Field>
              <div className="sm:col-span-2 flex justify-end"><Button type="submit"><PackageCheck className="h-4 w-4" /> Register resource</Button></div>
            </form>
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="font-semibold text-[var(--vims-ink)]">Reserve resource for session</h2>
            <p className="mt-1 text-sm text-[var(--vims-ink-muted)]">Reservations are serialized per resource and checked against overlapping session windows and available quantity.</p>
            {resources.length === 0 || scheduledSessions.length === 0 ? <div className="mt-5"><EmptyState title="Resource and scheduled session required" /></div> : (
              <form action={reserveTrainingResource} className="mt-5 space-y-4">
                <Field label="Resource"><select name="resourceId" required className={selectClass}><option value="">Select resource</option>{resources.filter((resource) => !["retired", "out_of_service", "maintenance"].includes(resource.status)).map((resource) => <option key={resource.id} value={resource.id}>{resource.resourceCode} · {resource.name} · {resource.availableQuantity} available</option>)}</select></Field>
                <Field label="Scheduled session"><select name="sessionId" required className={selectClass}><option value="">Select session</option>{scheduledSessions.map((session) => <option key={session.id} value={session.id}>{session.referenceNumber} · {serviceNames.get(session.serviceId) || session.title} · {formatDateTime(session.startAt)}</option>)}</select></Field>
                <Field label="Quantity"><Input name="quantity" type="number" min="1" max="100000" defaultValue="1" /></Field>
                <Field label="Reservation notes"><TextArea name="notes" maxLength={2000} className="min-h-[80px]" /></Field>
                <div className="flex justify-end"><Button type="submit"><CalendarRange className="h-4 w-4" /> Reserve resource</Button></div>
              </form>
            )}
          </Card>
        </section>
      )}

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-[var(--vims-line)] px-5 py-4 sm:px-6"><h2 className="font-semibold text-[var(--vims-ink)]">Resource register</h2><p className="mt-1 text-sm text-[var(--vims-ink-muted)]">Operational state also considers service and inspection due dates.</p></div>
          {resources.length === 0 ? <div className="p-5"><EmptyState title="No training resources registered" /></div> : <div className="divide-y divide-[var(--vims-line)]">{resources.map((resource) => {
            const state = states.get(resource.id) || "ready";
            const activeForResource = activeAllocations.filter((item) => item.resource.id === resource.id).length;
            return <div key={resource.id} className="p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-[var(--vims-ink)]">{resource.resourceCode} · {resource.name}</p><Badge tone={state === "ready" ? "emerald" : state === "attention" ? "amber" : state === "retired" ? "slate" : "red"}>{state}</Badge><Badge tone="slate">{resource.resourceType.replaceAll("_", " ")}</Badge></div><p className="mt-1 text-xs text-[var(--vims-ink-muted)]">{resource.identifier || "No identifier"} · {resource.isExclusive ? "Exclusive" : `${resource.availableQuantity} shared units`} · Capacity {resource.capacity} · {activeForResource} active reservation{activeForResource === 1 ? "" : "s"}</p><p className="mt-1 text-xs text-[var(--vims-ink-muted)]">Service due {resource.serviceDueDate ? formatDate(resource.serviceDueDate) : "not set"} · Inspection due {resource.inspectionDueDate ? formatDate(resource.inspectionDueDate) : "not set"}</p></div>{canManage && resource.status !== "retired" && <form action={updateTrainingResourceStatus} className="flex flex-wrap items-center gap-2"><input type="hidden" name="resourceId" value={resource.id} /><select name="status" defaultValue={resource.status} className={`${selectClass} w-auto min-w-36`}><option value="available">Available</option><option value="maintenance">Maintenance</option><option value="out_of_service">Out of service</option><option value="retired">Retired</option></select><Button type="submit" size="sm">Update</Button></form>}</div>{resource.notes && <p className="mt-3 text-sm text-[var(--vims-ink-soft)]">{resource.notes}</p>}</div>;
          })}</div>}
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-[var(--vims-line)] px-5 py-4 sm:px-6"><h2 className="font-semibold text-[var(--vims-ink)]">Allocation calendar</h2><p className="mt-1 text-sm text-[var(--vims-ink-muted)]">Recent reservations and allocation state, including availability risks.</p></div>
          {allocations.length === 0 ? <div className="p-5"><EmptyState title="No resource allocations" /></div> : <div className="divide-y divide-[var(--vims-line)]">{allocations.slice(0, 80).map(({ allocation, resource, session }) => {
            const state = states.get(resource.id) || "ready";
            const risk = ACTIVE_ALLOCATION_STATUSES.includes(allocation.status as typeof ACTIVE_ALLOCATION_STATUSES[number]) && ["blocked", "retired", "overdue"].includes(state);
            return <div key={allocation.id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-[var(--vims-ink)]">{session.referenceNumber}</p><Badge tone={allocation.status === "confirmed" ? "emerald" : allocation.status === "reserved" ? "blue" : "slate"}>{allocation.status}</Badge>{risk && <Badge tone="red">reallocate</Badge>}</div><p className="mt-1 text-sm text-[var(--vims-ink-soft)]">{allocation.quantity} × {resource.resourceCode} · {resource.name}</p><p className="mt-1 text-xs text-[var(--vims-ink-muted)]">{formatDateTime(session.startAt)} – {formatDateTime(session.endAt)} · {serviceNames.get(session.serviceId) || session.title}</p></div><Truck className="h-5 w-5 text-[var(--vims-ink-muted)]" /></div>{canManage && ACTIVE_ALLOCATION_STATUSES.includes(allocation.status as typeof ACTIVE_ALLOCATION_STATUSES[number]) && <form action={updateTrainingResourceAllocationStatus} className="mt-4 flex flex-wrap items-end gap-2"><input type="hidden" name="allocationId" value={allocation.id} /><select name="status" defaultValue={allocation.status} className={`${selectClass} w-auto min-w-32`}>{allocation.status === "reserved" && <option value="confirmed">Confirm</option>}<option value="released">Release</option><option value="cancelled">Cancel</option></select><Input name="note" maxLength={1000} placeholder="Optional note" className="min-w-48 flex-1" /><Button type="submit" size="sm">Apply</Button></form>}</div>;
          })}</div>}
        </Card>
      </section>

      {atRiskAllocations.length > 0 && <Card className="mt-6 border-red-200 bg-red-50 p-5 sm:p-6"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 text-red-700" /><div><h2 className="font-semibold text-red-900">Resource reallocation required</h2><p className="mt-1 text-sm text-red-800">{atRiskAllocations.length} active reservation{atRiskAllocations.length === 1 ? " uses" : "s use"} a resource that is blocked, overdue, or retired. Replace those resources before delivery.</p></div></div></Card>}
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`block ${className}`}><span className="mb-1.5 block text-sm font-semibold text-[var(--vims-ink-soft)]">{label}</span>{children}</label>;
}

const selectClass = "min-h-10 w-full rounded-xl border border-[var(--vims-line)] bg-[var(--vims-panel-solid)] px-3 text-sm text-[var(--vims-ink)] outline-none focus:border-[var(--brand-accent)]";
