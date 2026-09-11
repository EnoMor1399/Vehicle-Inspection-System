import { z } from "zod";

export const TRAINING_COMMUNICATION_CHANNELS = ["email", "sms", "whatsapp"] as const;
export const TRAINING_COMMUNICATION_TYPES = [
  "session_invitation",
  "session_reminder",
  "session_change",
  "certificate_expiry",
  "renewal_follow_up",
  "assessment_follow_up",
  "general",
] as const;
export const TRAINING_MESSAGE_STATUSES = ["draft", "approved", "queued", "sent", "failed", "cancelled"] as const;

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || undefined);

export const trainingCommunicationPreferenceSchema = z.object({
  participantId: z.string().uuid(),
  preferredChannel: z.enum(TRAINING_COMMUNICATION_CHANNELS).optional().or(z.literal("")).transform((value) => value || undefined),
  consentSource: z.string().trim().min(2).max(500),
  notes: optionalText(2000),
});

export const trainingMessageCreateSchema = z.object({
  participantId: z.string().uuid(),
  sessionId: z.string().uuid().optional().or(z.literal("")).transform((value) => value || undefined),
  certificateId: z.string().uuid().optional().or(z.literal("")).transform((value) => value || undefined),
  messageType: z.enum(TRAINING_COMMUNICATION_TYPES),
  channel: z.enum(TRAINING_COMMUNICATION_CHANNELS),
  subject: optionalText(255),
  body: z.string().trim().min(2).max(6000),
});

export const trainingMessageTransitionSchema = z.object({
  messageId: z.string().uuid(),
  status: z.enum(["draft", "approved", "queued", "cancelled"]),
});

const ALLOWED_TRANSITIONS: Record<string, ReadonlySet<string>> = {
  draft: new Set(["approved", "cancelled"]),
  approved: new Set(["draft", "queued", "cancelled"]),
  queued: new Set(["cancelled"]),
  sent: new Set(),
  failed: new Set(),
  cancelled: new Set(),
};

export function canTransitionTrainingMessage(fromStatus: string, toStatus: string) {
  if (fromStatus === toStatus) return false;
  return ALLOWED_TRANSITIONS[fromStatus]?.has(toStatus) ?? false;
}

export function trainingCommunicationValidationMessage(error: z.ZodError) {
  return error.issues.slice(0, 4).map((issue) => issue.message).join("; ") || "Invalid Driver Training communication data";
}

export type TrainingCommunicationPreferenceSnapshot = {
  emailOptIn: boolean;
  smsOptIn: boolean;
  whatsappOptIn: boolean;
  doNotContact: boolean;
};

export function channelHasConsent(preference: TrainingCommunicationPreferenceSnapshot | null | undefined, channel: string) {
  if (!preference || preference.doNotContact) return false;
  if (channel === "email") return preference.emailOptIn;
  if (channel === "sms") return preference.smsOptIn;
  if (channel === "whatsapp") return preference.whatsappOptIn;
  return false;
}

export function normalizeTrainingRecipient(channel: string, input: { email?: string | null; phone?: string | null }) {
  if (channel === "email") return input.email?.trim().toLowerCase() || null;
  if (channel === "sms" || channel === "whatsapp") return input.phone?.trim() || null;
  return null;
}

export function messageCanQueue(input: {
  status: string;
  channel: string;
  recipientAddress: string | null | undefined;
  preference: TrainingCommunicationPreferenceSnapshot | null | undefined;
}) {
  return input.status === "approved"
    && Boolean(input.recipientAddress?.trim())
    && channelHasConsent(input.preference, input.channel);
}

export function communicationPreferenceWarning(input: {
  channel: string;
  recipientAddress: string | null | undefined;
  preference: TrainingCommunicationPreferenceSnapshot | null | undefined;
}) {
  if (!input.preference) return "No communication preference has been recorded for this participant";
  if (input.preference.doNotContact) return "Participant is marked do not contact";
  if (!input.recipientAddress?.trim()) return `Participant has no ${input.channel === "email" ? "email address" : "phone number"} for this channel`;
  if (!channelHasConsent(input.preference, input.channel)) return `Participant has not opted in to ${input.channel}`;
  return null;
}
