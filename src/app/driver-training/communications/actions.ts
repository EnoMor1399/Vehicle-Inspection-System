"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  trainingCommunicationEvents,
  trainingCommunicationPreferences,
  trainingOutboundMessages,
} from "@/db/training-communication-schema";
import { trainingCertificates, trainingParticipants, trainingSessions } from "@/db/training-schema";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { canManageTraining } from "@/lib/training-access";
import {
  canTransitionTrainingMessage,
  communicationPreferenceWarning,
  messageCanQueue,
  normalizeTrainingRecipient,
  trainingCommunicationPreferenceSchema,
  trainingCommunicationValidationMessage,
  trainingMessageCreateSchema,
  trainingMessageTransitionSchema,
} from "@/lib/training-communication-policy";
import { newId } from "@/lib/utils";

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function refreshCommunicationPaths() {
  revalidatePath("/driver-training");
  revalidatePath("/driver-training/communications");
  revalidatePath("/driver-training/sessions");
  revalidatePath("/driver-training/certificates");
}

async function requireTrainingManager() {
  const user = await getCurrentUser();
  if (!canManageTraining(user)) throw new Error("You do not have permission to manage Driver Training communications");
  return user;
}

async function loadParticipantPreference(participantId: string) {
  const [[participant], [preference]] = await Promise.all([
    db.select().from(trainingParticipants).where(eq(trainingParticipants.id, participantId)).limit(1),
    db.select().from(trainingCommunicationPreferences).where(eq(trainingCommunicationPreferences.participantId, participantId)).limit(1),
  ]);
  return { participant, preference };
}

export async function upsertTrainingCommunicationPreference(formData: FormData) {
  const user = await requireTrainingManager();
  const parsed = trainingCommunicationPreferenceSchema.safeParse({
    participantId: field(formData, "participantId"),
    preferredChannel: field(formData, "preferredChannel"),
    consentSource: field(formData, "consentSource"),
    notes: field(formData, "notes"),
  });
  if (!parsed.success) throw new Error(trainingCommunicationValidationMessage(parsed.error));
  const data = parsed.data;
  const emailOptIn = formData.has("emailOptIn");
  const smsOptIn = formData.has("smsOptIn");
  const whatsappOptIn = formData.has("whatsappOptIn");
  const doNotContact = formData.has("doNotContact");

  const [participant] = await db.select().from(trainingParticipants).where(eq(trainingParticipants.id, data.participantId)).limit(1);
  if (!participant) throw new Error("Training participant not found");

  const effective = doNotContact
    ? { emailOptIn: false, smsOptIn: false, whatsappOptIn: false, preferredChannel: null }
    : { emailOptIn, smsOptIn, whatsappOptIn, preferredChannel: data.preferredChannel || null };
  if (effective.preferredChannel === "email" && !effective.emailOptIn) throw new Error("Preferred email channel requires email opt-in");
  if (effective.preferredChannel === "sms" && !effective.smsOptIn) throw new Error("Preferred SMS channel requires SMS opt-in");
  if (effective.preferredChannel === "whatsapp" && !effective.whatsappOptIn) throw new Error("Preferred WhatsApp channel requires WhatsApp opt-in");

  const now = new Date();
  const [existing] = await db.select().from(trainingCommunicationPreferences).where(eq(trainingCommunicationPreferences.participantId, participant.id)).limit(1);
  const values = {
    emailOptIn: effective.emailOptIn,
    smsOptIn: effective.smsOptIn,
    whatsappOptIn: effective.whatsappOptIn,
    preferredChannel: effective.preferredChannel,
    doNotContact,
    consentSource: data.consentSource,
    consentRecordedAt: now,
    consentRecordedBy: user.id,
    notes: data.notes || null,
    updatedAt: now,
  } as const;

  if (existing) await db.update(trainingCommunicationPreferences).set(values).where(eq(trainingCommunicationPreferences.id, existing.id));
  else await db.insert(trainingCommunicationPreferences).values({ id: newId(), participantId: participant.id, ...values });

  await logAudit({
    userId: user.id,
    userName: user.name,
    action: existing ? "update" : "create",
    entityType: "training_communication_preference",
    entityId: participant.id,
    entityLabel: participant.fullName,
    summary: `Recorded Driver Training communication preferences for ${participant.fullName}`,
    before: existing || null,
    after: values,
  });
  refreshCommunicationPaths();
}

export async function createTrainingOutboundMessage(formData: FormData) {
  const user = await requireTrainingManager();
  const parsed = trainingMessageCreateSchema.safeParse({
    participantId: field(formData, "participantId"),
    sessionId: field(formData, "sessionId"),
    certificateId: field(formData, "certificateId"),
    messageType: field(formData, "messageType"),
    channel: field(formData, "channel"),
    subject: field(formData, "subject"),
    body: field(formData, "body"),
  });
  if (!parsed.success) throw new Error(trainingCommunicationValidationMessage(parsed.error));
  const data = parsed.data;
  const { participant } = await loadParticipantPreference(data.participantId);
  if (!participant) throw new Error("Training participant not found");

  if (data.sessionId) {
    const [session] = await db.select().from(trainingSessions).where(eq(trainingSessions.id, data.sessionId)).limit(1);
    if (!session || session.id !== participant.sessionId) throw new Error("Selected session does not belong to this participant");
  }
  if (data.certificateId) {
    const [certificate] = await db.select().from(trainingCertificates).where(eq(trainingCertificates.id, data.certificateId)).limit(1);
    if (!certificate || certificate.participantId !== participant.id) throw new Error("Selected certificate does not belong to this participant");
  }

  const recipientAddress = normalizeTrainingRecipient(data.channel, participant);
  if (!recipientAddress) throw new Error(`Participant has no usable ${data.channel === "email" ? "email address" : "phone number"} for this channel`);
  const id = newId();
  const values = {
    id,
    participantId: participant.id,
    sessionId: data.sessionId || participant.sessionId,
    certificateId: data.certificateId || null,
    messageType: data.messageType,
    channel: data.channel,
    recipientName: participant.fullName,
    recipientAddress,
    subject: data.subject || null,
    body: data.body,
    status: "draft",
    preparedBy: user.id,
    updatedAt: new Date(),
  } as const;

  await db.transaction(async (tx) => {
    await tx.insert(trainingOutboundMessages).values(values);
    await tx.insert(trainingCommunicationEvents).values({
      id: newId(),
      messageId: id,
      eventType: "created",
      fromStatus: null,
      toStatus: "draft",
      summary: `Prepared ${data.channel} message for ${participant.fullName}`,
      createdBy: user.id,
    });
  });
  await logAudit({ userId: user.id, userName: user.name, action: "create", entityType: "training_outbound_message", entityId: id, entityLabel: participant.fullName, summary: `Prepared Driver Training ${data.messageType} message`, after: values });
  refreshCommunicationPaths();
}

export async function transitionTrainingOutboundMessage(formData: FormData) {
  const user = await requireTrainingManager();
  const parsed = trainingMessageTransitionSchema.safeParse({ messageId: field(formData, "messageId"), status: field(formData, "status") });
  if (!parsed.success) throw new Error(trainingCommunicationValidationMessage(parsed.error));
  const data = parsed.data;

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${data.messageId}))`);
    const [message] = await tx.select().from(trainingOutboundMessages).where(eq(trainingOutboundMessages.id, data.messageId)).limit(1);
    if (!message) return { ok: false as const, error: "Outbound training message not found" };
    if (!canTransitionTrainingMessage(message.status, data.status)) return { ok: false as const, error: `Message cannot move from ${message.status} to ${data.status}` };

    const [participant] = await tx.select().from(trainingParticipants).where(eq(trainingParticipants.id, message.participantId)).limit(1);
    const [preference] = await tx.select().from(trainingCommunicationPreferences).where(eq(trainingCommunicationPreferences.participantId, message.participantId)).limit(1);
    if (!participant) return { ok: false as const, error: "Training participant not found" };
    const currentAddress = normalizeTrainingRecipient(message.channel, participant);

    if (data.status === "approved" || data.status === "queued") {
      const warning = communicationPreferenceWarning({ channel: message.channel, recipientAddress: currentAddress, preference });
      if (warning) return { ok: false as const, error: warning };
    }
    if (data.status === "queued" && !messageCanQueue({ status: message.status, channel: message.channel, recipientAddress: currentAddress, preference })) {
      return { ok: false as const, error: "Message no longer satisfies queue consent or destination requirements" };
    }

    const now = new Date();
    const patch = data.status === "draft"
      ? { status: "draft", approvedBy: null, approvedAt: null, queuedAt: null, recipientAddress: currentAddress || message.recipientAddress, updatedAt: now }
      : data.status === "approved"
        ? { status: "approved", approvedBy: user.id, approvedAt: now, recipientAddress: currentAddress || message.recipientAddress, updatedAt: now }
        : data.status === "queued"
          ? { status: "queued", queuedAt: now, recipientAddress: currentAddress || message.recipientAddress, updatedAt: now }
          : { status: "cancelled", updatedAt: now };

    await tx.update(trainingOutboundMessages).set(patch).where(eq(trainingOutboundMessages.id, message.id));
    await tx.insert(trainingCommunicationEvents).values({
      id: newId(),
      messageId: message.id,
      eventType: data.status === "queued" ? "queued" : data.status === "approved" ? "approved" : data.status === "cancelled" ? "cancelled" : "returned_to_draft",
      fromStatus: message.status,
      toStatus: data.status,
      summary: `Message moved from ${message.status} to ${data.status}`,
      createdBy: user.id,
    });
    return { ok: true as const, message, patch };
  });
  if (!result.ok) throw new Error(result.error);

  await logAudit({
    userId: user.id,
    userName: user.name,
    action: data.status === "approved" ? "approve" : "update",
    entityType: "training_outbound_message",
    entityId: result.message.id,
    entityLabel: result.message.recipientName,
    summary: `Changed Driver Training outbound message status to ${data.status}`,
    before: { status: result.message.status },
    after: result.patch,
  });
  refreshCommunicationPaths();
}

function preferredEligibleChannel(participant: typeof trainingParticipants.$inferSelect, preference: typeof trainingCommunicationPreferences.$inferSelect | undefined) {
  if (!preference || preference.doNotContact) return null;
  const candidates = [preference.preferredChannel, "email", "whatsapp", "sms"].filter(Boolean) as string[];
  for (const channel of candidates) {
    const address = normalizeTrainingRecipient(channel, participant);
    if (!communicationPreferenceWarning({ channel, recipientAddress: address, preference })) return { channel, address: address! };
  }
  return null;
}

export async function prepareTrainingSessionReminderDrafts(formData: FormData) {
  const user = await requireTrainingManager();
  const sessionId = field(formData, "sessionId");
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) throw new Error("Invalid training session");
  const [session] = await db.select().from(trainingSessions).where(eq(trainingSessions.id, sessionId)).limit(1);
  if (!session || session.status !== "scheduled") throw new Error("Session reminders can only be prepared for scheduled training sessions");

  const participants = await db.select().from(trainingParticipants).where(and(eq(trainingParticipants.sessionId, session.id), inArray(trainingParticipants.attendanceStatus, ["registered", "attended"])));
  const preferences = await db.select().from(trainingCommunicationPreferences).where(inArray(trainingCommunicationPreferences.participantId, participants.map((participant) => participant.id)));
  const prefByParticipant = new Map(preferences.map((preference) => [preference.participantId, preference]));
  let created = 0;

  for (const participant of participants) {
    const preference = prefByParticipant.get(participant.id);
    const target = preferredEligibleChannel(participant, preference);
    if (!target) continue;
    const existing = await db.select({ id: trainingOutboundMessages.id }).from(trainingOutboundMessages).where(and(
      eq(trainingOutboundMessages.participantId, participant.id),
      eq(trainingOutboundMessages.sessionId, session.id),
      eq(trainingOutboundMessages.messageType, "session_reminder"),
      inArray(trainingOutboundMessages.status, ["draft", "approved", "queued", "sent"]),
    )).limit(1);
    if (existing.length) continue;

    const id = newId();
    await db.insert(trainingOutboundMessages).values({
      id,
      participantId: participant.id,
      sessionId: session.id,
      certificateId: null,
      messageType: "session_reminder",
      channel: target.channel,
      recipientName: participant.fullName,
      recipientAddress: target.address,
      subject: `Training reminder: ${session.title}`,
      body: `Reminder: ${session.title} is scheduled for ${session.startAt.toLocaleString()}. Venue: ${session.venue || "to be confirmed"}. Please contact the training team if your availability has changed.`,
      status: "draft",
      preparedBy: user.id,
      updatedAt: new Date(),
    });
    await db.insert(trainingCommunicationEvents).values({ id: newId(), messageId: id, eventType: "generated", fromStatus: null, toStatus: "draft", summary: `Generated session reminder draft for ${participant.fullName}`, createdBy: user.id });
    created += 1;
  }

  await logAudit({ userId: user.id, userName: user.name, action: "create", entityType: "training_communication_batch", entityId: session.id, entityLabel: session.referenceNumber, summary: `Prepared ${created} session reminder drafts`, after: { created } });
  refreshCommunicationPaths();
}

export async function prepareTrainingCertificateExpiryDrafts() {
  const user = await requireTrainingManager();
  const today = new Date();
  const horizon = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
  const certificates = await db.select().from(trainingCertificates).where(eq(trainingCertificates.status, "active"));
  const expiring = certificates.filter((certificate) => {
    if (!certificate.expiryDate) return false;
    const expiry = new Date(`${certificate.expiryDate}T23:59:59.999Z`);
    return expiry.getTime() >= today.getTime() && expiry.getTime() <= horizon.getTime();
  });
  if (!expiring.length) return;

  const participantIds = [...new Set(expiring.map((certificate) => certificate.participantId))];
  const participants = await db.select().from(trainingParticipants).where(inArray(trainingParticipants.id, participantIds));
  const preferences = await db.select().from(trainingCommunicationPreferences).where(inArray(trainingCommunicationPreferences.participantId, participantIds));
  const participantById = new Map(participants.map((participant) => [participant.id, participant]));
  const prefByParticipant = new Map(preferences.map((preference) => [preference.participantId, preference]));
  let created = 0;

  for (const certificate of expiring) {
    const participant = participantById.get(certificate.participantId);
    if (!participant) continue;
    const target = preferredEligibleChannel(participant, prefByParticipant.get(participant.id));
    if (!target) continue;
    const existing = await db.select({ id: trainingOutboundMessages.id }).from(trainingOutboundMessages).where(and(
      eq(trainingOutboundMessages.certificateId, certificate.id),
      eq(trainingOutboundMessages.messageType, "certificate_expiry"),
      inArray(trainingOutboundMessages.status, ["draft", "approved", "queued", "sent"]),
    )).limit(1);
    if (existing.length) continue;

    const id = newId();
    await db.insert(trainingOutboundMessages).values({
      id,
      participantId: participant.id,
      sessionId: certificate.sessionId,
      certificateId: certificate.id,
      messageType: "certificate_expiry",
      channel: target.channel,
      recipientName: participant.fullName,
      recipientAddress: target.address,
      subject: `Training certificate expiry notice: ${certificate.certificateNumber}`,
      body: `Your Driver Training certificate ${certificate.certificateNumber} is due to expire on ${certificate.expiryDate}. Please contact the training team to arrange renewal or refresher requirements before expiry.`,
      status: "draft",
      preparedBy: user.id,
      updatedAt: new Date(),
    });
    await db.insert(trainingCommunicationEvents).values({ id: newId(), messageId: id, eventType: "generated", fromStatus: null, toStatus: "draft", summary: `Generated certificate-expiry reminder draft for ${participant.fullName}`, createdBy: user.id });
    created += 1;
  }

  await logAudit({ userId: user.id, userName: user.name, action: "create", entityType: "training_communication_batch", entityId: null, entityLabel: "Certificate expiry reminders", summary: `Prepared ${created} certificate-expiry reminder drafts`, after: { created, horizonDays: 60 } });
  refreshCommunicationPaths();
}
