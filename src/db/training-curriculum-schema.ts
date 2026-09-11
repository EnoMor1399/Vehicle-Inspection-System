import {
  pgTable,
  varchar,
  integer,
  boolean,
  timestamp,
  date,
  numeric,
  text,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./schema";
import { trainingSessions } from "./training-schema";

export const trainingCurricula = pgTable(
  "training_curricula",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    code: varchar("code", { length: 40 }).notNull(),
    serviceId: varchar("service_id", { length: 80 }).notNull(),
    title: varchar("title", { length: 220 }).notNull(),
    status: varchar("status", { length: 24 }).notNull().default("active"),
    ownerId: varchar("owner_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    codeIdx: uniqueIndex("training_curriculum_code_uidx").on(t.code),
    serviceIdx: index("training_curriculum_service_idx").on(t.serviceId),
    statusIdx: index("training_curriculum_status_idx").on(t.status),
    ownerIdx: index("training_curriculum_owner_idx").on(t.ownerId),
  })
);

export const trainingCurriculumVersions = pgTable(
  "training_curriculum_versions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    curriculumId: varchar("curriculum_id", { length: 36 })
      .notNull()
      .references(() => trainingCurricula.id, { onDelete: "cascade" }),
    versionNumber: varchar("version_number", { length: 20 }).notNull(),
    status: varchar("status", { length: 24 }).notNull().default("draft"),
    effectiveFrom: date("effective_from").notNull(),
    reviewDueDate: date("review_due_date").notNull(),
    totalHours: numeric("total_hours", { precision: 6, scale: 2 }).notNull(),
    theoryPassMark: integer("theory_pass_mark").notNull(),
    practicalPassMark: integer("practical_pass_mark").notNull(),
    minimumAttendanceMinutes: integer("minimum_attendance_minutes").notNull().default(0),
    learningObjectives: jsonb("learning_objectives").$type<string[]>().notNull().default([]),
    competencies: jsonb("competencies").$type<string[]>().notNull().default([]),
    modules: jsonb("modules").$type<string[]>().notNull().default([]),
    changeSummary: text("change_summary"),
    createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    approvedBy: varchar("approved_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    versionIdx: uniqueIndex("training_curriculum_version_uidx").on(t.curriculumId, t.versionNumber),
    curriculumStatusIdx: index("training_curriculum_version_status_idx").on(t.curriculumId, t.status),
    reviewIdx: index("training_curriculum_review_due_idx").on(t.reviewDueDate),
    effectiveIdx: index("training_curriculum_effective_idx").on(t.effectiveFrom),
  })
);

export const trainingSessionCurricula = pgTable(
  "training_session_curricula",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    sessionId: varchar("session_id", { length: 36 })
      .notNull()
      .references(() => trainingSessions.id, { onDelete: "cascade" }),
    curriculumVersionId: varchar("curriculum_version_id", { length: 36 })
      .notNull()
      .references(() => trainingCurriculumVersions.id, { onDelete: "restrict" }),
    assignedBy: varchar("assigned_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sessionIdx: uniqueIndex("training_session_curriculum_session_uidx").on(t.sessionId),
    versionIdx: index("training_session_curriculum_version_idx").on(t.curriculumVersionId),
  })
);

export const trainingMatrixRequirements = pgTable(
  "training_matrix_requirements",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    requirementKey: varchar("requirement_key", { length: 420 }).notNull(),
    scopeType: varchar("scope_type", { length: 20 }).notNull().default("global"),
    clientName: varchar("client_name", { length: 220 }),
    jobRole: varchar("job_role", { length: 160 }),
    serviceId: varchar("service_id", { length: 80 }).notNull(),
    recurrenceMonths: integer("recurrence_months").notNull().default(12),
    minimumLicenseClass: varchar("minimum_license_class", { length: 50 }),
    required: boolean("required").notNull().default(true),
    notes: text("notes"),
    createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    keyIdx: uniqueIndex("training_matrix_requirement_key_uidx").on(t.requirementKey),
    serviceIdx: index("training_matrix_service_idx").on(t.serviceId),
    scopeIdx: index("training_matrix_scope_idx").on(t.scopeType, t.clientName, t.jobRole),
  })
);
