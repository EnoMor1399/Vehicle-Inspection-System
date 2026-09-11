import {
  pgTable,
  varchar,
  integer,
  timestamp,
  date,
  text,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { locations, users } from "./schema";
import { trainingSessions } from "./training-schema";

export const trainingRequests = pgTable(
  "training_requests",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    requestNumber: varchar("request_number", { length: 40 }).notNull(),
    requestType: varchar("request_type", { length: 20 }).notNull().default("client"),
    serviceId: varchar("service_id", { length: 80 }).notNull(),
    title: varchar("title", { length: 220 }).notNull(),
    clientName: varchar("client_name", { length: 220 }),
    contactName: varchar("contact_name", { length: 180 }),
    contactEmail: varchar("contact_email", { length: 200 }),
    contactPhone: varchar("contact_phone", { length: 50 }),
    requestedParticipants: integer("requested_participants").notNull().default(1),
    preferredStartDate: date("preferred_start_date"),
    preferredEndDate: date("preferred_end_date"),
    locationId: varchar("location_id", { length: 36 }).references(() => locations.id, { onDelete: "set null" }),
    venue: varchar("venue", { length: 300 }),
    deliveryMode: varchar("delivery_mode", { length: 30 }).notNull().default("onsite"),
    priority: varchar("priority", { length: 20 }).notNull().default("normal"),
    status: varchar("status", { length: 24 }).notNull().default("draft"),
    businessNeed: text("business_need"),
    notes: text("notes"),
    requestedBy: varchar("requested_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewedBy: varchar("reviewed_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNotes: text("review_notes"),
    scheduledSessionId: varchar("scheduled_session_id", { length: 36 }).references(() => trainingSessions.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    requestNumberIdx: uniqueIndex("training_request_number_uidx").on(t.requestNumber),
    statusCreatedIdx: index("training_request_status_created_idx").on(t.status, t.createdAt),
    serviceIdx: index("training_request_service_idx").on(t.serviceId),
    clientIdx: index("training_request_client_idx").on(t.clientName),
    reviewerIdx: index("training_request_reviewer_idx").on(t.reviewedBy),
    scheduledSessionIdx: uniqueIndex("training_request_scheduled_session_uidx").on(t.scheduledSessionId),
  })
);

export const trainingRequestEvents = pgTable(
  "training_request_events",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    requestId: varchar("request_id", { length: 36 })
      .notNull()
      .references(() => trainingRequests.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 30 }).notNull(),
    fromStatus: varchar("from_status", { length: 24 }),
    toStatus: varchar("to_status", { length: 24 }),
    summary: text("summary").notNull(),
    createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    requestCreatedIdx: index("training_request_event_request_created_idx").on(t.requestId, t.createdAt),
  })
);
