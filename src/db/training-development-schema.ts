import {
  pgTable,
  varchar,
  timestamp,
  date,
  text,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./schema";
import { trainingAssessments, trainingParticipants } from "./training-schema";

export const trainingDevelopmentPlans = pgTable(
  "training_development_plans",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    participantId: varchar("participant_id", { length: 36 })
      .notNull()
      .references(() => trainingParticipants.id, { onDelete: "cascade" }),
    sourceAssessmentId: varchar("source_assessment_id", { length: 36 }).references(() => trainingAssessments.id, { onDelete: "set null" }),
    title: varchar("title", { length: 220 }).notNull(),
    status: varchar("status", { length: 24 }).notNull().default("open"),
    priority: varchar("priority", { length: 20 }).notNull().default("medium"),
    competencyGaps: jsonb("competency_gaps").$type<string[]>().notNull().default([]),
    targetDate: date("target_date"),
    ownerId: varchar("owner_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    verificationSummary: text("verification_summary"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedBy: varchar("completed_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    participantIdx: index("training_development_participant_idx").on(t.participantId, t.createdAt),
    statusTargetIdx: index("training_development_status_target_idx").on(t.status, t.targetDate),
    priorityIdx: index("training_development_priority_idx").on(t.priority),
    ownerIdx: index("training_development_owner_idx").on(t.ownerId),
    assessmentIdx: index("training_development_assessment_idx").on(t.sourceAssessmentId),
  })
);

export const trainingDevelopmentActions = pgTable(
  "training_development_actions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    planId: varchar("plan_id", { length: 36 })
      .notNull()
      .references(() => trainingDevelopmentPlans.id, { onDelete: "cascade" }),
    actionType: varchar("action_type", { length: 30 }).notNull(),
    description: text("description").notNull(),
    dueDate: date("due_date"),
    status: varchar("status", { length: 24 }).notNull().default("pending"),
    evidenceReference: varchar("evidence_reference", { length: 500 }),
    notes: text("notes"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedBy: varchar("completed_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    planStatusIdx: index("training_development_action_plan_status_idx").on(t.planId, t.status),
    dueIdx: index("training_development_action_due_idx").on(t.status, t.dueDate),
    typeIdx: index("training_development_action_type_idx").on(t.actionType),
  })
);
