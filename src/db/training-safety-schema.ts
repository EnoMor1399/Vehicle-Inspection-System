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

export const trainingRiskAssessments = pgTable(
  "training_risk_assessments",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    sessionId: varchar("session_id", { length: 36 })
      .notNull()
      .references(() => trainingSessions.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 24 }).notNull().default("draft"),
    overallRisk: varchar("overall_risk", { length: 20 }).notNull().default("medium"),
    activityScope: text("activity_scope").notNull(),
    emergencyPlan: text("emergency_plan").notNull(),
    stopWorkRequired: boolean("stop_work_required").notNull().default(false),
    notes: text("notes"),
    assessedBy: varchar("assessed_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    assessedAt: timestamp("assessed_at", { withTimezone: true }).notNull().defaultNow(),
    approvedBy: varchar("approved_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sessionIdx: uniqueIndex("training_risk_assessment_session_uidx").on(t.sessionId),
    statusIdx: index("training_risk_assessment_status_idx").on(t.status),
    overallRiskIdx: index("training_risk_assessment_overall_risk_idx").on(t.overallRisk),
    assessedAtIdx: index("training_risk_assessment_assessed_at_idx").on(t.assessedAt),
  })
);

export const trainingSafetyHazards = pgTable(
  "training_safety_hazards",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    assessmentId: varchar("assessment_id", { length: 36 })
      .notNull()
      .references(() => trainingRiskAssessments.id, { onDelete: "cascade" }),
    hazard: text("hazard").notNull(),
    consequence: text("consequence").notNull(),
    likelihood: integer("likelihood").notNull(),
    severity: integer("severity").notNull(),
    initialRiskScore: integer("initial_risk_score").notNull(),
    controls: text("controls").notNull(),
    residualLikelihood: integer("residual_likelihood").notNull(),
    residualSeverity: integer("residual_severity").notNull(),
    residualRiskScore: integer("residual_risk_score").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("open"),
    ownerId: varchar("owner_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    assessmentStatusIdx: index("training_safety_hazard_assessment_status_idx").on(t.assessmentId, t.status),
    residualRiskIdx: index("training_safety_hazard_residual_risk_idx").on(t.residualRiskScore),
    ownerIdx: index("training_safety_hazard_owner_idx").on(t.ownerId),
  })
);

export const trainingSafetyIncidents = pgTable(
  "training_safety_incidents",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    incidentNumber: varchar("incident_number", { length: 40 }).notNull(),
    sessionId: varchar("session_id", { length: 36 })
      .notNull()
      .references(() => trainingSessions.id, { onDelete: "cascade" }),
    participantId: varchar("participant_id", { length: 36 }).references(() => trainingParticipants.id, { onDelete: "set null" }),
    incidentType: varchar("incident_type", { length: 30 }).notNull(),
    severity: varchar("severity", { length: 20 }).notNull().default("low"),
    status: varchar("status", { length: 24 }).notNull().default("open"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    location: varchar("location", { length: 300 }),
    description: text("description").notNull(),
    immediateActions: text("immediate_actions").notNull(),
    stopWork: boolean("stop_work").notNull().default(false),
    ownerId: varchar("owner_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    rootCause: text("root_cause"),
    correctiveActions: text("corrective_actions"),
    evidenceReference: varchar("evidence_reference", { length: 500 }),
    closureReview: text("closure_review"),
    reportedBy: varchar("reported_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    closedBy: varchar("closed_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    numberIdx: uniqueIndex("training_safety_incident_number_uidx").on(t.incidentNumber),
    sessionStatusIdx: index("training_safety_incident_session_status_idx").on(t.sessionId, t.status),
    severityIdx: index("training_safety_incident_severity_idx").on(t.severity),
    occurredIdx: index("training_safety_incident_occurred_idx").on(t.occurredAt),
    ownerIdx: index("training_safety_incident_owner_idx").on(t.ownerId),
  })
);
