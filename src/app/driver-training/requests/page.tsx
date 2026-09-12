import Link from "next/link";
import type { ReactNode } from "react";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { CalendarCheck2, ClipboardPlus, Clock3, FileCheck2, Send, ShieldCheck } from "lucide-react";
import { db } from "@/db";
import { locations, users } from "@/db/schema";
import { trainingSessions } from "@/db/training-schema";
import { trainingRequestEvents, trainingRequests } from "@/db/training-request-schema";
import { Badge, Button, Card, EmptyState, PageHeader, StatCard, TextArea, TextInput as Input } from "@/components/ui";
import { DRIVER_TRAINING_SERVICES } from "@/lib/driver-training";
import { requireInternalUser } from "@/lib/require-auth";
import { canManageTraining, canViewTraining } from "@/lib/training-access";
import { canTransitionTrainingRequest } from "@/lib/training-request-policy";
import { formatDate, formatDateTime } from "@/lib/utils";
import { createTrainingRequest, scheduleApprovedTrainingRequest, transitionTrainingRequest } from "./actions";

export const dynamic = "force-dynamic";

const serviceNames = new Map(DRIVER_TRAINING_SERVICES.map((service) => [service.id, service.title]));

export default async function TrainingRequestsPage() {
  const user = await requireInternalUser();
  if (!canViewTraining(user)) {
    return <div className="p-8 text-sm text-slate-600">You do not have access to Driver Training & Assessment Services.</div>;
  }
  const canManage = canManageTraining(user);

  const [requests, events, trainingLocations, internalUsers, sessions] = await Promise.all([
    db.select().from(trainingRequests).orderBy(desc(trainingRequests.createdAt)).limit(300),
    db.select().from(trainingRequestEvents).orderBy(desc(trainingRequestEvents.createdAt)).limit(1200),
    db.select({ id: locations.id, name: locations.name }).from(locations).orderBy(asc(locations.name)).limit(300),
    db
      .select({ id: users.id, name: users.name, role: users.role })
      .from(users)
      .where(and(eq(users.isActive, true), ne(users.role, "transporter_user")))
      .orderBy(asc(users.name))
      .limit(300),
    db.select({ id: trainingSessions.id, referenceNumber: trainingSessions.referenceNumber }).from(trainingSessions).limit(1000),
  ]);

  const eventByRequest = new Map<string, typeof events>();
  for (const event of events) {
    const items = eventByRequest.get(event.requestId) || [];
    items.push(event);
    eventByRequest.set(event.requestId, items);
  }
  const sessionById = new Map(sessions.map((session) => [session.id, session.referenceNumber]));
  const awaitingReview = requests.filter((item) => item.status === "submitted" || item.status === "under_review").length;
  const approvedAwaitingSchedule = requests.filter((item) => item.status === "approved").length;
  const scheduled = requests.filter((item) => item.status === "scheduled").length;
  const urgentOpen = requests.filter((item) => item.priority === "urgent" && !["scheduled", "rejected", "cancelled"].includes(item.status)).length;

  return (
    <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Training Requests"
        description="Manage training demand, approval and scheduling."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Awaiting review" value={awaitingReview} hint="Submitted / review" tone="amber" icon={<Clock3 className="h-5 w-5" />} />
        <StatCard label="Approved" value={approvedAwaitingSchedule} hint="Awaiting schedule" tone="emerald" icon={<ShieldCheck className="h-5 w-5" />} />
        <StatCard label="Scheduled" value={scheduled} hint="Sessions created" tone="blue" icon={<CalendarCheck2 className="h-5 w-5" />} />
        <StatCard label="Urgent" value={urgentOpen} hint="Requires action" tone={urgentOpen > 0 ? "red" : "slate"} icon={<FileCheck2 className="h-5 w-5" />} />
      </div>

      {canManage && (
        <Card className="mt-6 p-5 sm:p-6">
          <h2 className="font-semibold text-[var(--vims-ink)]">New Request</h2>
          <form action={createTrainingRequest} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Request type">
              <select name="requestType" defaultValue="client" className={selectClass}><option value="client">Client</option><option value="internal">Internal</option></select>
            </Field>
            <Field label="Training service">
              <select name="serviceId" required className={selectClass}><option value="">Select service</option>{DRIVER_TRAINING_SERVICES.map((service) => <option key={service.id} value={service.id}>{service.title}</option>)}</select>
            </Field>
            <Field label="Request title" className="md:col-span-2"><Input name="title" required maxLength={220} placeholder="Defensive driving training for fleet drivers" /></Field>
            <Field label="Client name"><Input name="clientName" maxLength={220} /></Field>
            <Field label="Contact person"><Input name="contactName" maxLength={180} /></Field>
            <Field label="Contact email"><Input name="contactEmail" type="email" maxLength={200} /></Field>
            <Field label="Contact phone"><Input name="contactPhone" maxLength={50} /></Field>
            <Field label="Participants"><Input name="requestedParticipants" type="number" min="1" max="5000" defaultValue="20" required /></Field>
            <Field label="Preferred start"><Input name="preferredStartDate" type="date" /></Field>
            <Field label="Preferred end"><Input name="preferredEndDate" type="date" /></Field>
            <Field label="Priority"><select name="priority" defaultValue="normal" className={selectClass}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></Field>
            <Field label="Delivery mode"><select name="deliveryMode" defaultValue="onsite" className={selectClass}><option value="onsite">Onsite</option><option value="classroom">Classroom</option><option value="practical">Practical</option><option value="hybrid">Hybrid</option></select></Field>
            <Field label="Station"><select name="locationId" className={selectClass}><option value="">Not specified</option>{trainingLocations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></Field>
            <Field label="Venue" className="md:col-span-2"><Input name="venue" maxLength={300} /></Field>
            <Field label="Operational requirement" className="md:col-span-2"><TextArea name="businessNeed" maxLength={4000} className="min-h-[90px]" /></Field>
            <Field label="Notes" className="md:col-span-2"><TextArea name="notes" maxLength={4000} className="min-h-[90px]" /></Field>
            <div className="md:col-span-2 xl:col-span-4 flex justify-end"><Button type="submit"><ClipboardPlus className="h-4 w-4" /> Create Draft</Button></div>
          </form>
        </Card>
      )}

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-[var(--vims-line)] px-5 py-4 sm:px-6">
          <h2 className="font-semibold text-[var(--vims-ink)]">Request Register</h2>
        </div>
        {requests.length === 0 ? <div className="p-5"><EmptyState title="No requests recorded" description="Create a request to begin." /></div> : (
          <div className="divide-y divide-[var(--vims-line)]">
            {requests.map((request) => {
              const requestEvents = eventByRequest.get(request.id) || [];
              const scheduledReference = request.scheduledSessionId ? sessionById.get(request.scheduledSessionId) : undefined;
              return (
                <article key={request.id} className="p-5 sm:p-6">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-[var(--vims-ink)]">{request.requestNumber}</p>
                        <Badge tone={statusTone(request.status)}>{request.status.replaceAll("_", " ")}</Badge>
                        <Badge tone={priorityTone(request.priority)}>{request.priority}</Badge>
                        <Badge tone="slate">{request.requestType}</Badge>
                      </div>
                      <h3 className="mt-2 text-base font-semibold text-[var(--vims-ink)]">{request.title}</h3>
                      <p className="mt-1 text-sm text-[var(--vims-ink-soft)]">{serviceNames.get(request.serviceId) || request.serviceId}{request.clientName ? ` · ${request.clientName}` : ""}</p>
                      <div className="mt-3 grid gap-x-6 gap-y-1 text-xs text-[var(--vims-ink-muted)] sm:grid-cols-2 lg:grid-cols-4">
                        <span>Participants: <strong className="text-[var(--vims-ink)]">{request.requestedParticipants}</strong></span>
                        <span>Mode: <strong className="text-[var(--vims-ink)]">{request.deliveryMode}</strong></span>
                        <span>Preferred: <strong className="text-[var(--vims-ink)]">{request.preferredStartDate ? formatDate(request.preferredStartDate) : "Not set"}{request.preferredEndDate ? ` – ${formatDate(request.preferredEndDate)}` : ""}</strong></span>
                        <span>Created: <strong className="text-[var(--vims-ink)]">{formatDateTime(request.createdAt)}</strong></span>
                      </div>
                      {(request.contactName || request.contactEmail || request.contactPhone) && <p className="mt-2 text-xs text-[var(--vims-ink-muted)]">Contact: {[request.contactName, request.contactEmail, request.contactPhone].filter(Boolean).join(" · ")}</p>}
                      {request.businessNeed && <p className="mt-3 max-w-4xl text-sm text-[var(--vims-ink-soft)]">{request.businessNeed}</p>}
                      {request.reviewNotes && <div className="mt-3 rounded-xl border border-[var(--vims-line)] bg-[var(--vims-panel-soft)] p-3 text-sm text-[var(--vims-ink-soft)]"><strong className="text-[var(--vims-ink)]">Review:</strong> {request.reviewNotes}</div>}
                      {request.status === "scheduled" && request.scheduledSessionId && <p className="mt-3 text-sm font-medium text-[var(--vims-ink)]">Session: <Link href="/driver-training/sessions" className="underline underline-offset-4">{scheduledReference || request.scheduledSessionId}</Link></p>}
                    </div>

                    {canManage && <div className="w-full max-w-xl space-y-3 xl:w-[430px]">
                      <TransitionControls requestId={request.id} status={request.status} />
                      {request.status === "approved" && (
                        <form action={scheduleApprovedTrainingRequest} className="rounded-xl border border-[var(--vims-line)] bg-[var(--vims-panel-soft)] p-4">
                          <input type="hidden" name="requestId" value={request.id} />
                          <p className="text-sm font-semibold text-[var(--vims-ink)]">Schedule Request</p>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <Field label="Start"><Input name="startAt" type="datetime-local" required /></Field>
                            <Field label="End"><Input name="endAt" type="datetime-local" required /></Field>
                            <Field label="Capacity"><Input name="capacity" type="number" min={request.requestedParticipants} max="5000" defaultValue={request.requestedParticipants} required /></Field>
                            <Field label="Instructor"><select name="instructorId" className={selectClass}><option value="">Unassigned</option>{internalUsers.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.role.replaceAll("_", " ")}</option>)}</select></Field>
                            <Field label="Instructor name"><Input name="instructorName" maxLength={200} /></Field>
                            <Field label="Station"><select name="locationId" defaultValue={request.locationId || ""} className={selectClass}><option value="">Not specified</option>{trainingLocations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></Field>
                            <Field label="Venue" className="sm:col-span-2"><Input name="venue" maxLength={300} defaultValue={request.venue || ""} /></Field>
                            <Field label="Notes" className="sm:col-span-2"><TextArea name="notes" maxLength={4000} className="min-h-[70px]" /></Field>
                          </div>
                          <div className="mt-3 flex justify-end"><Button type="submit"><CalendarCheck2 className="h-4 w-4" /> Create Session</Button></div>
                        </form>
                      )}
                    </div>}
                  </div>

                  <div className="mt-5 border-t border-[var(--vims-line)] pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--vims-ink-muted)]">History</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {requestEvents.slice(0, 8).map((event) => <span key={event.id} className="rounded-full border border-[var(--vims-line)] px-2.5 py-1 text-xs text-[var(--vims-ink-muted)]">{event.eventType.replaceAll("_", " ")} · {formatDateTime(event.createdAt)}</span>)}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function TransitionControls({ requestId, status }: { requestId: string; status: string }) {
  const actions: Array<{ status: string; label: string; tone?: "primary" | "secondary" | "danger" }> = [];
  if (canTransitionTrainingRequest(status, "submitted")) actions.push({ status: "submitted", label: "Submit", tone: "primary" });
  if (canTransitionTrainingRequest(status, "under_review")) actions.push({ status: "under_review", label: "Review", tone: "secondary" });
  if (canTransitionTrainingRequest(status, "approved")) actions.push({ status: "approved", label: "Approve", tone: "primary" });
  if (canTransitionTrainingRequest(status, "cancelled")) actions.push({ status: "cancelled", label: "Cancel", tone: "secondary" });

  return (
    <div className="space-y-3">
      {actions.length > 0 && <div className="flex flex-wrap justify-end gap-2">{actions.map((item) => (
        <form key={item.status} action={transitionTrainingRequest}>
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="status" value={item.status} />
          <Button type="submit" size="sm" variant={item.tone === "secondary" ? "secondary" : undefined}>{item.status === "submitted" ? <Send className="h-4 w-4" /> : item.status === "approved" ? <ShieldCheck className="h-4 w-4" /> : null}{item.label}</Button>
        </form>
      ))}</div>}
      {canTransitionTrainingRequest(status, "rejected") && (
        <form action={transitionTrainingRequest} className="rounded-xl border border-red-200 bg-red-50/60 p-3">
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="status" value="rejected" />
          <Field label="Rejection reason"><TextArea name="reviewNotes" required maxLength={4000} className="min-h-[70px]" /></Field>
          <div className="mt-2 flex justify-end"><Button type="submit" size="sm" variant="secondary">Reject</Button></div>
        </form>
      )}
    </div>
  );
}

function statusTone(status: string): "blue" | "emerald" | "amber" | "red" | "slate" | "violet" {
  if (status === "scheduled") return "blue";
  if (status === "approved") return "emerald";
  if (status === "submitted" || status === "under_review") return "amber";
  if (status === "rejected" || status === "cancelled") return "red";
  return "slate";
}

function priorityTone(priority: string): "red" | "amber" | "blue" | "slate" {
  if (priority === "urgent") return "red";
  if (priority === "high") return "amber";
  if (priority === "normal") return "blue";
  return "slate";
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`block ${className}`}><span className="mb-1.5 block text-xs font-medium text-[var(--vims-ink-soft)]">{label}</span>{children}</label>;
}

const selectClass = "min-h-10 w-full rounded-lg border border-[var(--vims-line)] bg-[var(--vims-panel-solid)] px-3 py-2 text-sm text-[var(--vims-ink)] outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
