import Link from "next/link";
import { desc, eq, isNull, sql } from "drizzle-orm";
import { CalendarDays, CheckCircle2, Clock3, Plus, UsersRound, XCircle } from "lucide-react";
import { db } from "@/db";
import { locations, transporters, users } from "@/db/schema";
import { trainingParticipants, trainingSessions } from "@/db/training-schema";
import { Badge, Button, Card, EmptyState, Field, PageHeader, Select, TextArea, TextInput } from "@/components/ui";
import { DRIVER_TRAINING_SERVICES } from "@/lib/driver-training";
import { requireInternalUser } from "@/lib/require-auth";
import { canManageTraining, canViewTraining } from "@/lib/training-access";
import { formatDateTime } from "@/lib/utils";
import { createTrainingSession, updateTrainingSessionStatus } from "../actions";

export const dynamic = "force-dynamic";

const serviceNames = new Map(DRIVER_TRAINING_SERVICES.map((service) => [service.id, service.title]));

function statusTone(status: string): "slate" | "emerald" | "amber" | "red" | "blue" {
  if (status === "completed") return "emerald";
  if (status === "in_progress") return "blue";
  if (status === "cancelled") return "red";
  if (status === "scheduled") return "amber";
  return "slate";
}

export default async function TrainingSessionsPage() {
  const user = await requireInternalUser();
  if (!canViewTraining(user)) return <div className="p-8 text-sm text-slate-600">You do not have access to Driver Training & Assessment Services.</div>;
  const canManage = canManageTraining(user);

  const [sessions, stationOptions, transporterOptions, instructorOptions] = await Promise.all([
    db
      .select({
        id: trainingSessions.id,
        referenceNumber: trainingSessions.referenceNumber,
        serviceId: trainingSessions.serviceId,
        title: trainingSessions.title,
        clientName: trainingSessions.clientName,
        venue: trainingSessions.venue,
        startAt: trainingSessions.startAt,
        endAt: trainingSessions.endAt,
        instructorName: trainingSessions.instructorName,
        capacity: trainingSessions.capacity,
        status: trainingSessions.status,
        participantCount: sql<number>`(select count(*)::int from ${trainingParticipants} p where p.session_id = ${trainingSessions.id})`,
      })
      .from(trainingSessions)
      .orderBy(desc(trainingSessions.startAt))
      .limit(100),
    db.select({ id: locations.id, name: locations.name }).from(locations).orderBy(locations.name),
    db
      .select({ id: transporters.id, companyName: transporters.companyName })
      .from(transporters)
      .where(isNull(transporters.deletedAt))
      .orderBy(transporters.companyName),
    db
      .select({ id: users.id, name: users.name, role: users.role })
      .from(users)
      .where(eq(users.isActive, true))
      .orderBy(users.name),
  ]);

  return (
    <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Training Sessions"
        description="Schedule, monitor, and close Driver Training & Assessment programmes without mixing them into vehicle-inspection workflows."
        action={<Link href="/driver-training" className="text-sm font-semibold text-[var(--brand-accent)] hover:opacity-75">Department overview →</Link>}
      />

      {canManage && (
        <Card className="mb-6 overflow-hidden">
          <div className="border-b border-[var(--vims-line)] px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-[var(--vims-ink)]">Schedule a training session</h2>
                <p className="text-sm text-[var(--vims-ink-muted)]">Create a controlled programme record for one of the six approved service lines.</p>
              </div>
            </div>
          </div>
          <form action={createTrainingSession} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-4">
            <Field label="Service" required>
              <Select name="serviceId" required defaultValue="">
                <option value="" disabled>Select service</option>
                {DRIVER_TRAINING_SERVICES.map((service) => <option key={service.id} value={service.id}>{service.title}</option>)}
              </Select>
            </Field>
            <Field label="Session title" required>
              <TextInput name="title" required maxLength={220} placeholder="e.g. Defensive Driving — Tema Fleet" />
            </Field>
            <Field label="Client / organization">
              <TextInput name="clientName" maxLength={220} placeholder="Organization name" />
            </Field>
            <Field label="Linked transporter">
              <Select name="transporterId" defaultValue="">
                <option value="">No linked transporter</option>
                {transporterOptions.map((item) => <option key={item.id} value={item.id}>{item.companyName}</option>)}
              </Select>
            </Field>
            <Field label="Start date & time" required>
              <TextInput name="startAt" type="datetime-local" required />
            </Field>
            <Field label="End date & time" required>
              <TextInput name="endAt" type="datetime-local" required />
            </Field>
            <Field label="Delivery mode" required>
              <Select name="deliveryMode" defaultValue="onsite">
                <option value="onsite">On-site</option>
                <option value="classroom">Classroom</option>
                <option value="practical">Practical</option>
                <option value="hybrid">Hybrid</option>
              </Select>
            </Field>
            <Field label="Capacity" required>
              <TextInput name="capacity" type="number" min={1} max={500} defaultValue={20} required />
            </Field>
            <Field label="Inspection station / facility">
              <Select name="locationId" defaultValue="">
                <option value="">No linked station</option>
                {stationOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
            </Field>
            <Field label="Venue">
              <TextInput name="venue" maxLength={300} placeholder="Training venue or route" />
            </Field>
            <Field label="Internal instructor">
              <Select name="instructorId" defaultValue="">
                <option value="">No internal instructor</option>
                {instructorOptions.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.role.replaceAll("_", " ")}</option>)}
              </Select>
            </Field>
            <Field label="Instructor / facilitator name">
              <TextInput name="instructorName" maxLength={200} placeholder="External or display name" />
            </Field>
            <div className="sm:col-span-2 xl:col-span-4">
              <Field label="Notes">
                <TextArea name="notes" maxLength={4000} className="min-h-[90px]" placeholder="Scope, equipment, route, client requirements, or safety notes" />
              </Field>
            </div>
            <div className="sm:col-span-2 xl:col-span-4 flex justify-end">
              <Button type="submit"><CalendarDays className="h-4 w-4" /> Schedule session</Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-[var(--vims-line)] px-5 py-4 sm:px-6">
          <h2 className="font-semibold text-[var(--vims-ink)]">Programme register</h2>
          <p className="mt-1 text-sm text-[var(--vims-ink-muted)]">Latest 100 sessions with live capacity and workflow status.</p>
        </div>
        {sessions.length === 0 ? (
          <div className="p-5 sm:p-6"><EmptyState icon={<CalendarDays className="h-5 w-5" />} title="No training sessions yet" description="Schedule the first programme to begin building the department’s operational record." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="bg-[var(--vims-panel-soft)] text-xs uppercase tracking-wide text-[var(--vims-ink-muted)]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Reference / service</th>
                  <th className="px-5 py-3 font-semibold">Schedule</th>
                  <th className="px-5 py-3 font-semibold">Client / venue</th>
                  <th className="px-5 py-3 font-semibold">Instructor</th>
                  <th className="px-5 py-3 font-semibold">Participants</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  {canManage && <th className="px-5 py-3 font-semibold">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--vims-line)]">
                {sessions.map((session) => (
                  <tr key={session.id} className="align-top hover:bg-[var(--vims-panel-soft)]/70">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-[var(--vims-ink)]">{session.referenceNumber}</p>
                      <p className="mt-1 max-w-xs text-xs text-[var(--vims-ink-muted)]">{serviceNames.get(session.serviceId) || session.title}</p>
                    </td>
                    <td className="px-5 py-4 text-[var(--vims-ink-soft)]">
                      <div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-slate-400" />{formatDateTime(session.startAt)}</div>
                      <p className="mt-1 pl-6 text-xs text-[var(--vims-ink-muted)]">to {formatDateTime(session.endAt)}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-[var(--vims-ink)]">{session.clientName || "Internal programme"}</p>
                      <p className="mt-1 text-xs text-[var(--vims-ink-muted)]">{session.venue || "Venue not recorded"}</p>
                    </td>
                    <td className="px-5 py-4 text-[var(--vims-ink-soft)]">{session.instructorName || "—"}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 font-semibold text-[var(--vims-ink)]"><UsersRound className="h-4 w-4 text-slate-400" />{session.participantCount}/{session.capacity}</div>
                    </td>
                    <td className="px-5 py-4"><Badge tone={statusTone(session.status)}>{session.status.replaceAll("_", " ")}</Badge></td>
                    {canManage && (
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          {session.status === "scheduled" && (
                            <form action={updateTrainingSessionStatus}>
                              <input type="hidden" name="sessionId" value={session.id} />
                              <input type="hidden" name="status" value="in_progress" />
                              <Button type="submit" size="sm" variant="secondary"><Clock3 className="h-3.5 w-3.5" /> Start</Button>
                            </form>
                          )}
                          {session.status === "in_progress" && (
                            <form action={updateTrainingSessionStatus}>
                              <input type="hidden" name="sessionId" value={session.id} />
                              <input type="hidden" name="status" value="completed" />
                              <Button type="submit" size="sm" variant="success"><CheckCircle2 className="h-3.5 w-3.5" /> Complete</Button>
                            </form>
                          )}
                          {(session.status === "scheduled" || session.status === "in_progress") && (
                            <form action={updateTrainingSessionStatus}>
                              <input type="hidden" name="sessionId" value={session.id} />
                              <input type="hidden" name="status" value="cancelled" />
                              <Button type="submit" size="sm" variant="ghost"><XCircle className="h-3.5 w-3.5" /> Cancel</Button>
                            </form>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
