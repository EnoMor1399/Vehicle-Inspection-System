import {
  pgTable,
  varchar,
  boolean,
  timestamp,
  date,
  text,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./schema";
import { trainingSessions } from "./training-schema";

export const trainingInstructorProfiles = pgTable(
  "training_instructor_profiles",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    instructorCode: varchar("instructor_code", { length: 40 }).notNull(),
    status: varchar("status", { length: 24 }).notNull().default("active"),
    specialties: jsonb("specialties").$type<string[]>().notNull().default([]),
    driverLicenseNumber: varchar("driver_license_number", { length: 100 }),
    driverLicenseExpiry: date("driver_license_expiry"),
    trainerCertification: varchar("trainer_certification", { length: 220 }),
    trainerCertificationExpiry: date("trainer_certification_expiry"),
    firstAidExpiry: date("first_aid_expiry"),
    medicalFitnessExpiry: date("medical_fitness_expiry"),
    notes: text("notes"),
    createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: uniqueIndex("training_instructor_user_uidx").on(t.userId),
    codeIdx: uniqueIndex("training_instructor_code_uidx").on(t.instructorCode),
    statusIdx: index("training_instructor_status_idx").on(t.status),
    certificationExpiryIdx: index("training_instructor_cert_expiry_idx").on(t.trainerCertificationExpiry),
    medicalExpiryIdx: index("training_instructor_medical_expiry_idx").on(t.medicalFitnessExpiry),
  })
);

export const trainingSessionReadiness = pgTable(
  "training_session_readiness",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    sessionId: varchar("session_id", { length: 36 })
      .notNull()
      .references(() => trainingSessions.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 24 }).notNull().default("not_ready"),
    instructorConfirmed: boolean("instructor_confirmed").notNull().default(false),
    venueConfirmed: boolean("venue_confirmed").notNull().default(false),
    vehicleEquipmentReady: boolean("vehicle_equipment_ready").notNull().default(false),
    trainingMaterialsReady: boolean("training_materials_ready").notNull().default(false),
    participantListConfirmed: boolean("participant_list_confirmed").notNull().default(false),
    riskAssessmentComplete: boolean("risk_assessment_complete").notNull().default(false),
    emergencyPlanConfirmed: boolean("emergency_plan_confirmed").notNull().default(false),
    clientConfirmationReceived: boolean("client_confirmation_received").notNull().default(false),
    blockers: jsonb("blockers").$type<string[]>().notNull().default([]),
    notes: text("notes"),
    reviewedBy: varchar("reviewed_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sessionIdx: uniqueIndex("training_readiness_session_uidx").on(t.sessionId),
    statusIdx: index("training_readiness_status_idx").on(t.status),
    reviewedIdx: index("training_readiness_reviewed_idx").on(t.reviewedAt),
  })
);
