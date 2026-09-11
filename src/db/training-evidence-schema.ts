import {
  pgTable,
  varchar,
  integer,
  boolean,
  timestamp,
  text,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./schema";
import { trainingParticipants, trainingSessions } from "./training-schema";

export const trainingAttendanceSignoffs = pgTable(
  "training_attendance_signoffs",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    participantId: varchar("participant_id", { length: 36 })
      .notNull()
      .references(() => trainingParticipants.id, { onDelete: "cascade" }),
    sessionId: varchar("session_id", { length: 36 })
      .notNull()
      .references(() => trainingSessions.id, { onDelete: "cascade" }),
    checkInAt: timestamp("check_in_at", { withTimezone: true }),
    checkOutAt: timestamp("check_out_at", { withTimezone: true }),
    attendanceMinutes: integer("attendance_minutes").notNull().default(0),
    status: varchar("status", { length: 24 }).notNull().default("open"),
    participantAcknowledged: boolean("participant_acknowledged").notNull().default(false),
    instructorConfirmed: boolean("instructor_confirmed").notNull().default(false),
    confirmedBy: varchar("confirmed_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    notes: text("notes"),
    createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    participantSessionIdx: uniqueIndex("training_attendance_participant_session_uidx").on(t.participantId, t.sessionId),
    sessionStatusIdx: index("training_attendance_session_status_idx").on(t.sessionId, t.status),
    participantIdx: index("training_attendance_participant_idx").on(t.participantId),
    confirmedIdx: index("training_attendance_confirmed_idx").on(t.confirmedAt),
  })
);

export const trainingEvidenceRecords = pgTable(
  "training_evidence_records",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    sessionId: varchar("session_id", { length: 36 })
      .notNull()
      .references(() => trainingSessions.id, { onDelete: "cascade" }),
    participantId: varchar("participant_id", { length: 36 }).references(() => trainingParticipants.id, { onDelete: "cascade" }),
    evidenceType: varchar("evidence_type", { length: 40 }).notNull(),
    title: varchar("title", { length: 220 }).notNull(),
    reference: varchar("reference", { length: 500 }).notNull(),
    sha256: varchar("sha256", { length: 64 }),
    status: varchar("status", { length: 24 }).notNull().default("pending"),
    capturedBy: varchar("captured_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
    verifiedBy: varchar("verified_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    reviewNotes: text("review_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sessionIdx: index("training_evidence_session_idx").on(t.sessionId, t.capturedAt),
    participantIdx: index("training_evidence_participant_idx").on(t.participantId),
    statusIdx: index("training_evidence_status_idx").on(t.status, t.capturedAt),
    typeIdx: index("training_evidence_type_idx").on(t.evidenceType),
  })
);
