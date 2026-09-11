import type { ReactNode } from "react";
import { asc, desc } from "drizzle-orm";
import { BellRing, CheckCircle2, Clock3, MailCheck, MessageSquareWarning, Send, ShieldCheck } from "lucide-react";
import { db } from "@/db";
import {
  trainingCommunicationEvents,
  trainingCommunicationPreferences,
  trainingOutboundMessages,
} from "@/db/training-communication-schema";
import { trainingCertificates, trainingParticipants, trainingSessions } from "@/db/training-schema";
import { Badge, Button, Card, EmptyState, PageHeader, StatCard, TextArea, TextInput as Input } from "@/components/ui";
import { requireInternalUser } from "@/lib/require-auth";
import { canManageTraining, canViewTraining } from "@/lib/training-access";
import { communicationPreferenceWarning, normalizeTrainingRecipient } from "@/lib/training-communication-policy";
import { formatDateTime } from "@/lib/utils";
import {
  createTrainingOutboundMessage,
  prepareTrainingCertificateExpiryDrafts,
  prepareTrainingSessionReminderDrafts,
  transitionTrainingOutboundMessage,
  upsertTrainingCommunicationPreference,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function TrainingCommunicationsPage() {
  const user = await requireInternalUser();
  if (!canViewTraining(user)) return <div className="p-8 text-sm text-slate-600">You do not have access to Driver Training & Assessment Services.</div>;
  const canManage = canManageTraining(user);

  const [participants, sessions, certificates, preferences, messages, events] = await Promise.all([
    db.select().from(trainingParticipants).orderBy(asc(trainingParticipants.fullName)).limit(2000),
    db.select().from(trainingSessions).orderBy(desc(trainingSessions.startAt)).limit(500),
    db.select().from(trainingCertificates).orderBy(desc(trainingCertificates.issuedAt)).limit(1000),
    db.select().from(trainingCommunicationPreferences).orderBy(desc(trainingCommunicationPreferences.updatedAt)).limit(2000),
    db.select().from(trainingOutboundMessages).orderBy(desc(trainingOutboundMessages.createdAt)).limit(500),
    db.select().from(trainingCommunicationEvents).orderBy(desc(trainingCommunicationEvents.createdAt)).limit(1000),
  ]);

  const participantById = new Map(participants.map((participant) => [participant.id, participant]));
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const certificateById = new Map(certificates.map((certificate) => [certificate.id, certificate]));
  const prefByParticipant = new Map(preferences.map((preference) => [preference.participantId, preference]));
  const eventsByMessage = new Map<string, typeof events>();
  for (const event of events) {
    const list = eventsByMessage.get(event.messageId) || [];
    list.push(event);
    eventsByMessage.set(event.messageId, list);
  }

  const participantsWithPreference = new Set(preferences.map((preference) => preference.participantId));
  const optedIn = preferences.filter((preference) => !preference.doNotContact && (preference.emailOptIn || preference.smsOptIn || preference.whatsappOptIn)).length;
  const drafts = messages.filter((message) => message.status === "draft").length;
  const awaitingQueue = messages.filter((message) => message.status === "approved").length;
  const queued = messages.filter((message) => message.status === "queued").length;
  const scheduledSessions = sessions.filter((session) => session.status === "scheduled");

  return (
    <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Training Communications & Reminders"
        description="Record participant communication consent, prepare training and certificate reminders, approve outbound content, and place validated messages into an auditable delivery queue. This workspace does not dispatch external messages by itself."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="No preference" value={participants.length - participantsWithPreference.size} hint="Participants without recorded communication choice" tone="amber" icon={<MessageSquareWarning className="h-5 w-5" />} />
        <StatCard label="Opted in" value={optedIn} hint="At least one permitted external channel" tone="emerald" icon={<ShieldCheck className="h-5 w-5" />} />
        <StatCard label="Draft messages" value={drafts} hint="Prepared but not approved" tone="blue" icon={<MailCheck className="h-5 w-5" />} />
        <StatCard label="Awaiting queue" value={awaitingQueue} hint="Approved, pending explicit queue action" tone={awaitingQueue ? "amber" : "slate"} icon={<Clock3 className="h-5 w-5" />} />
        <StatCard label="Queued" value={queued} hint="Awaiting future external delivery integration" tone="violet" icon={<Send className="h-5 w-5" />} />
      </div>

      {canManage && (
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Card className="p-5 sm:p-6">
            <h2 className="font-semibold text-[var(--vims-ink)]">Participant communication consent</h2>
            <p className="mt-1 text-sm text-[var(--vims-ink-muted)]">Record the participant’s current channel preferences. Do not contact overrides all opt-ins.</p>
            <form action={upsertTrainingCommunicationPreference} className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Participant" className="sm:col-span-2"><select name="participantId" required className={selectClass}><option value="">Select participant</option>{participants.map((participant) => <option key={participant.id} value={participant.id}>{participant.fullName} · {sessionById.get(participant.sessionId)?.referenceNumber || participant.sessionId}</option>)}</select></Field>
              <label className={checkClass}><input type="checkbox" name="emailOptIn" /> Email opt-in</label>
              <label className={checkClass}><input type="checkbox" name="smsOptIn" /> SMS opt-in</label>
              <label className={checkClass}><input type="checkbox" name="whatsappOptIn" /> WhatsApp opt-in</label>
              <label className={checkClass}><input type="checkbox" name="doNotContact" /> Do not contact</label>
              <Field label="Preferred channel"><select name="preferredChannel" className={selectClass}><option value="">No preference</option><option value="email">Email</option><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option></select></Field>
              <Field label="Consent source"><Input name="consentSource" required maxLength={500} placeholder="Registration form, signed consent, verbal confirmation..." /></Field>
              <Field label="Notes" className="sm:col-span-2"><TextArea name="notes" maxLength={2000} className="min-h-[90px]" /></Field>
              <div className="sm:col-span-2 flex justify-end"><Button type="submit"><ShieldCheck className="h-4 w-4" /> Save communication preference</Button></div>
            </form>
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="font-semibold text-[var(--vims-ink)]">Reminder preparation</h2>
            <p className="mt-1 text-sm text-[var(--vims-ink-muted)]">Batch actions create drafts only. Every draft still requires explicit approval and queueing.</p>
            <form action={prepareTrainingSessionReminderDrafts} className="mt-5 space-y-3 rounded-xl border border-[var(--vims-line)] p-4">
              <Field label="Scheduled session"><select name="sessionId" required className={selectClass}><option value="">Select session</option>{scheduledSessions.map((session) => <option key={session.id} value={session.id}>{session.referenceNumber} · {session.title}</option>)}</select></Field>
              <Button type="submit" variant="secondary"><BellRing className="h-4 w-4" /> Prepare session reminder drafts</Button>
            </form>
            <form action={prepareTrainingCertificateExpiryDrafts} className="mt-4 rounded-xl border border-[var(--vims-line)] p-4">
              <p className="text-sm text-[var(--vims-ink-soft)]">Create draft renewal notices for active certificates expiring within the next 60 days, where valid participant consent and contact details exist.</p>
              <Button type="submit" variant="secondary" className="mt-3"><BellRing className="h-4 w-4" /> Prepare certificate-expiry drafts</Button>
            </form>
          </Card>
        </div>
      )}

      {canManage && (
        <Card className="mt-6 p-5 sm:p-6">
          <h2 className="font-semibold text-[var(--vims-ink)]">Prepare individual outbound message</h2>
          <form action={createTrainingOutboundMessage} className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Participant"><select name="participantId" required className={selectClass}><option value="">Select participant</option>{participants.map((participant) => <option key={participant.id} value={participant.id}>{participant.fullName}</option>)}</select></Field>
            <Field label="Message type"><select name="messageType" required className={selectClass}><option value="session_invitation">Session invitation</option><option value="session_reminder">Session reminder</option><option value="session_change">Session change</option><option value="certificate_expiry">Certificate expiry</option><option value="renewal_follow_up">Renewal follow-up</option><option value="assessment_follow_up">Assessment follow-up</option><option value="general">General</option></select></Field>
            <Field label="Channel"><select name="channel" required className={selectClass}><option value="email">Email</option><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option></select></Field>
            <Field label="Related session"><select name="sessionId" className={selectClass}><option value="">Participant session by default</option>{sessions.map((session) => <option key={session.id} value={session.id}>{session.referenceNumber} · {session.title}</option>)}</select></Field>
            <Field label="Related certificate"><select name="certificateId" className={selectClass}><option value="">None</option>{certificates.map((certificate) => <option key={certificate.id} value={certificate.id}>{certificate.certificateNumber}</option>)}</select></Field>
            <Field label="Subject" className="md:col-span-1 xl:col-span-3"><Input name="subject" maxLength={255} /></Field>
            <Field label="Message" className="md:col-span-2 xl:col-span-4"><TextArea name="body" required maxLength={6000} className="min-h-[120px]" /></Field>
            <div className="md:col-span-2 xl:col-span-4 flex justify-end"><Button type="submit"><MailCheck className="h-4 w-4" /> Save as draft</Button></div>
          </form>
        </Card>
      )}

      <section className="mt-6 space-y-4">
        <div><h2 className="text-lg font-semibold text-[var(--vims-ink)]">Outbound queue</h2><p className="text-sm text-[var(--vims-ink-muted)]">The queue is intentionally delivery-provider neutral. A future provider worker must record sent/failed outcomes.</p></div>
        {messages.length === 0 ? <Card className="p-5"><EmptyState title="No outbound Driver Training messages" /></Card> : messages.map((message) => {
          const participant = participantById.get(message.participantId);
          const preference = prefByParticipant.get(message.participantId);
          const currentAddress = participant ? normalizeTrainingRecipient(message.channel, participant) : null;
          const warning = communicationPreferenceWarning({ channel: message.channel, recipientAddress: currentAddress, preference });
          const messageEvents = eventsByMessage.get(message.id) || [];
          return (
            <Card key={message.id} className="p-5 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-[var(--vims-ink)]">{message.recipientName}</h3><Badge tone={statusTone(message.status)}>{message.status}</Badge><Badge tone="slate">{message.channel}</Badge></div>
                  <p className="mt-1 text-sm text-[var(--vims-ink-soft)]">{message.messageType.replaceAll("_", " ")} · {message.recipientAddress}</p>
                  {message.subject && <p className="mt-2 text-sm font-medium text-[var(--vims-ink)]">{message.subject}</p>}
                  <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--vims-ink-soft)]">{message.body}</p>
                  <p className="mt-2 text-xs text-[var(--vims-ink-muted)]">Prepared {formatDateTime(message.createdAt)}{message.sessionId ? ` · ${sessionById.get(message.sessionId)?.referenceNumber || message.sessionId}` : ""}{message.certificateId ? ` · ${certificateById.get(message.certificateId)?.certificateNumber || message.certificateId}` : ""}</p>
                  {warning && message.status !== "sent" && message.status !== "cancelled" && <p className="mt-2 text-xs font-semibold text-amber-700">Current queue blocker: {warning}</p>}
                  {messageEvents.length > 0 && <p className="mt-2 text-xs text-[var(--vims-ink-muted)]">Latest event: {messageEvents[0].summary} · {formatDateTime(messageEvents[0].createdAt)}</p>}
                </div>
                {canManage && <MessageActions message={message} blocked={Boolean(warning)} />}
              </div>
            </Card>
          );
        })}
      </section>
    </div>
  );
}

function MessageActions({ message, blocked }: { message: typeof trainingOutboundMessages.$inferSelect; blocked: boolean }) {
  if (message.status === "draft") return <div className="flex shrink-0 flex-wrap gap-2"><TransitionButton id={message.id} status="approved" label="Approve" disabled={blocked} /><TransitionButton id={message.id} status="cancelled" label="Cancel" secondary /></div>;
  if (message.status === "approved") return <div className="flex shrink-0 flex-wrap gap-2"><TransitionButton id={message.id} status="queued" label="Queue" disabled={blocked} /><TransitionButton id={message.id} status="draft" label="Return to draft" secondary /><TransitionButton id={message.id} status="cancelled" label="Cancel" secondary /></div>;
  if (message.status === "queued") return <div className="shrink-0"><TransitionButton id={message.id} status="cancelled" label="Cancel queued item" secondary /></div>;
  return <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />;
}

function TransitionButton({ id, status, label, secondary = false, disabled = false }: { id: string; status: string; label: string; secondary?: boolean; disabled?: boolean }) {
  return <form action={transitionTrainingOutboundMessage}><input type="hidden" name="messageId" value={id} /><input type="hidden" name="status" value={status} /><Button type="submit" size="sm" variant={secondary ? "secondary" : undefined} disabled={disabled}>{label}</Button></form>;
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`block ${className}`}><span className="mb-1.5 block text-xs font-semibold text-[var(--vims-ink-soft)]">{label}</span>{children}</label>;
}

function statusTone(status: string): "emerald" | "amber" | "blue" | "red" | "violet" | "slate" {
  if (status === "sent") return "emerald";
  if (status === "queued") return "violet";
  if (status === "approved") return "blue";
  if (status === "failed") return "red";
  if (status === "draft") return "amber";
  return "slate";
}

const selectClass = "min-h-10 w-full rounded-lg border border-[var(--vims-line)] bg-[var(--vims-panel-solid)] px-3 py-2 text-sm text-[var(--vims-ink)] outline-none focus:border-sky-400";
const checkClass = "flex min-h-10 items-center gap-2 rounded-lg border border-[var(--vims-line)] bg-[var(--vims-panel-soft)] px-3 py-2 text-sm text-[var(--vims-ink-soft)]";
