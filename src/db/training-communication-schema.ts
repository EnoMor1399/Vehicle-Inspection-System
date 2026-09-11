import {
  pgTable,
  varchar,
  boolean,
  timestamp,
  text,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./schema";
import { trainingCertificates, trainingParticipants, trainingSessions } from "./training-schema";

export const trainingCommunicationPreferences = pgTable(
  "training_communication_preferences",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    participantId: varchar("participant_id", { length: 36 }).notNull().references(() => trainingParticipants.id, { onDelete: "cascade" }),
    emailOptIn: boolean("email_opt_in").notNull().default(false),
    smsOptIn: boolean("sms_opt_in").notNull().default(false),
    whatsappOptIn: boolean("whatsapp_opt_in").notNull().default(false),
    preferredChannel: varchar("preferred_channel", { length: 20 }),
    doNotContact: boolean("do_not_contact").notNull().default(false),
    consentSource: varchar("consent_source", { length: 500 }).notNull(),
    consentRecordedAt: timestamp("consent_recorded_at", { withTimezone: true }).notNull().defaultNow(),
    consentRecordedBy: varchar("consent_recorded_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    notes: text("notes"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    participantIdx: uniqueIndex("training_comm_pref_participant_uidx").on(t.participantId),
    channelIdx: index("training_comm_pref_channel_idx").on(t.preferredChannel),
    dncIdx: index("training_comm_pref_dnc_idx").on(t.doNotContact),
  })
);

export const trainingOutboundMessages = pgTable(
  "training_outbound_messages",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    participantId: varchar("participant_id", { length: 36 }).notNull().references(() => trainingParticipants.id, { onDelete: "cascade" }),
    sessionId: varchar("session_id", { length: 36 }).references(() => trainingSessions.id, { onDelete: "set null" }),
    certificateId: varchar("certificate_id", { length: 36 }).references(() => trainingCertificates.id, { onDelete: "set null" }),
    messageType: varchar("message_type", { length: 40 }).notNull(),
    channel: varchar("channel", { length: 20 }).notNull(),
    recipientName: varchar("recipient_name", { length: 200 }).notNull(),
    recipientAddress: varchar("recipient_address", { length: 255 }).notNull(),
    subject: varchar("subject", { length: 255 }),
    body: text("body").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    preparedBy: varchar("prepared_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    approvedBy: varchar("approved_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    queuedAt: timestamp("queued_at", { withTimezone: true }),
    providerMessageId: varchar("provider_message_id", { length: 255 }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    participantIdx: index("training_outbound_participant_idx").on(t.participantId, t.createdAt),
    sessionIdx: index("training_outbound_session_idx").on(t.sessionId, t.status),
    certificateIdx: index("training_outbound_certificate_idx").on(t.certificateId),
    statusIdx: index("training_outbound_status_idx").on(t.status, t.createdAt),
    queueIdx: index("training_outbound_queue_idx").on(t.status, t.queuedAt),
  })
);

export const trainingCommunicationEvents = pgTable(
  "training_communication_events",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    messageId: varchar("message_id", { length: 36 }).notNull().references(() => trainingOutboundMessages.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 30 }).notNull(),
    fromStatus: varchar("from_status", { length: 20 }),
    toStatus: varchar("to_status", { length: 20 }),
    summary: text("summary").notNull(),
    createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    messageCreatedIdx: index("training_comm_event_message_created_idx").on(t.messageId, t.createdAt),
  })
);
