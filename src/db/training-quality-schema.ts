import {
  pgTable,
  varchar,
  integer,
  boolean,
  timestamp,
  date,
  text,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./schema";
import { trainingParticipants, trainingSessions } from "./training-schema";

export const trainingSessionFeedback = pgTable(
  "training_session_feedback",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    sessionId: varchar("session_id", { length: 36 })
      .notNull()
      .references(() => trainingSessions.id, { onDelete: "cascade" }),
    participantId: varchar("participant_id", { length: 36 }).references(() => trainingParticipants.id, { onDelete: "set null" }),
    respondentType: varchar("respondent_type", { length: 24 }).notNull(),
    contentRating: integer("content_rating").notNull(),
    instructorRating: integer("instructor_rating").notNull(),
    practicalRating: integer("practical_rating").notNull(),
    safetyRating: integer("safety_rating").notNull(),
    overallRating: integer("overall_rating").notNull(),
    wouldRecommend: boolean("would_recommend"),
    comments: text("comments"),
    improvementSuggestions: text("improvement_suggestions"),
    anonymous: boolean("anonymous").notNull().default(false),
    submittedBy: varchar("submitted_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sessionIdx: index("training_feedback_session_idx").on(t.sessionId, t.createdAt),
    participantIdx: index("training_feedback_participant_idx").on(t.participantId),
    ratingIdx: index("training_feedback_rating_idx").on(t.overallRating),
  })
);

export const trainingQualityFindings = pgTable(
  "training_quality_findings",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    sessionId: varchar("session_id", { length: 36 })
      .notNull()
      .references(() => trainingSessions.id, { onDelete: "cascade" }),
    participantId: varchar("participant_id", { length: 36 }).references(() => trainingParticipants.id, { onDelete: "set null" }),
    source: varchar("source", { length: 30 }).notNull(),
    category: varchar("category", { length: 40 }).notNull(),
    severity: varchar("severity", { length: 20 }).notNull().default("medium"),
    status: varchar("status", { length: 24 }).notNull().default("open"),
    title: varchar("title", { length: 220 }).notNull(),
    description: text("description").notNull(),
    rootCause: text("root_cause"),
    actionPlan: text("action_plan"),
    ownerId: varchar("owner_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    dueDate: date("due_date"),
    closureEvidence: text("closure_evidence"),
    effectivenessReview: text("effectiveness_review"),
    createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    closedBy: varchar("closed_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sessionIdx: index("training_quality_session_idx").on(t.sessionId, t.createdAt),
    statusDueIdx: index("training_quality_status_due_idx").on(t.status, t.dueDate),
    severityIdx: index("training_quality_severity_idx").on(t.severity),
    ownerIdx: index("training_quality_owner_idx").on(t.ownerId, t.status),
  })
);

export const trainingQualityEvents = pgTable(
  "training_quality_events",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    findingId: varchar("finding_id", { length: 36 })
      .notNull()
      .references(() => trainingQualityFindings.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 30 }).notNull(),
    summary: text("summary").notNull(),
    createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    findingCreatedIdx: index("training_quality_event_finding_created_idx").on(t.findingId, t.createdAt),
  })
);
