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
import { locations, transporters, users } from "./schema";

export const trainingSessions = pgTable(
  "training_sessions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    referenceNumber: varchar("reference_number", { length: 40 }).notNull(),
    serviceId: varchar("service_id", { length: 80 }).notNull(),
    title: varchar("title", { length: 220 }).notNull(),
    clientName: varchar("client_name", { length: 220 }),
    transporterId: varchar("transporter_id", { length: 36 }).references(() => transporters.id, { onDelete: "set null" }),
    locationId: varchar("location_id", { length: 36 }).references(() => locations.id, { onDelete: "set null" }),
    venue: varchar("venue", { length: 300 }),
    deliveryMode: varchar("delivery_mode", { length: 30 }).notNull().default("onsite"),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    instructorId: varchar("instructor_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    instructorName: varchar("instructor_name", { length: 200 }),
    capacity: integer("capacity").notNull().default(20),
    status: varchar("status", { length: 24 }).notNull().default("scheduled"),
    notes: text("notes"),
    createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    referenceIdx: uniqueIndex("training_session_reference_uidx").on(t.referenceNumber),
    serviceIdx: index("training_session_service_idx").on(t.serviceId),
    statusStartIdx: index("training_session_status_start_idx").on(t.status, t.startAt),
    transporterIdx: index("training_session_transporter_idx").on(t.transporterId),
    instructorIdx: index("training_session_instructor_idx").on(t.instructorId),
  })
);

export const trainingParticipants = pgTable(
  "training_participants",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    sessionId: varchar("session_id", { length: 36 })
      .notNull()
      .references(() => trainingSessions.id, { onDelete: "cascade" }),
    fullName: varchar("full_name", { length: 200 }).notNull(),
    companyName: varchar("company_name", { length: 220 }),
    employeeNumber: varchar("employee_number", { length: 100 }),
    phone: varchar("phone", { length: 50 }),
    email: varchar("email", { length: 200 }),
    driverLicenseNumber: varchar("driver_license_number", { length: 100 }),
    driverLicenseClass: varchar("driver_license_class", { length: 50 }),
    driverLicenseExpiry: date("driver_license_expiry"),
    attendanceStatus: varchar("attendance_status", { length: 24 }).notNull().default("registered"),
    riskLevel: varchar("risk_level", { length: 20 }),
    assessmentStatus: varchar("assessment_status", { length: 24 }).notNull().default("pending"),
    certificateEligible: boolean("certificate_eligible").notNull().default(false),
    notes: text("notes"),
    createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sessionIdx: index("training_participant_session_idx").on(t.sessionId),
    licenseIdx: index("training_participant_license_idx").on(t.driverLicenseNumber),
    emailIdx: index("training_participant_email_idx").on(t.email),
    assessmentIdx: index("training_participant_assessment_idx").on(t.assessmentStatus),
  })
);

export const trainingAssessments = pgTable(
  "training_assessments",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    participantId: varchar("participant_id", { length: 36 })
      .notNull()
      .references(() => trainingParticipants.id, { onDelete: "cascade" }),
    sessionId: varchar("session_id", { length: 36 })
      .notNull()
      .references(() => trainingSessions.id, { onDelete: "cascade" }),
    assessorId: varchar("assessor_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    assessmentType: varchar("assessment_type", { length: 40 }).notNull(),
    theoryScore: numeric("theory_score", { precision: 5, scale: 2 }),
    practicalScore: numeric("practical_score", { precision: 5, scale: 2 }),
    overallScore: numeric("overall_score", { precision: 5, scale: 2 }),
    result: varchar("result", { length: 30 }).notNull(),
    riskLevel: varchar("risk_level", { length: 20 }),
    strengths: text("strengths"),
    improvementAreas: jsonb("improvement_areas").$type<string[]>().notNull().default([]),
    remarks: text("remarks"),
    assessedAt: timestamp("assessed_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    participantIdx: index("training_assessment_participant_idx").on(t.participantId, t.assessedAt),
    sessionIdx: index("training_assessment_session_idx").on(t.sessionId),
    resultIdx: index("training_assessment_result_idx").on(t.result),
  })
);

export const trainingCertificates = pgTable(
  "training_certificates",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    certificateNumber: varchar("certificate_number", { length: 50 }).notNull(),
    verificationCode: varchar("verification_code", { length: 64 }).notNull(),
    participantId: varchar("participant_id", { length: 36 })
      .notNull()
      .references(() => trainingParticipants.id, { onDelete: "restrict" }),
    sessionId: varchar("session_id", { length: 36 })
      .notNull()
      .references(() => trainingSessions.id, { onDelete: "restrict" }),
    serviceId: varchar("service_id", { length: 80 }).notNull(),
    issueDate: date("issue_date").notNull(),
    expiryDate: date("expiry_date"),
    status: varchar("status", { length: 24 }).notNull().default("active"),
    issuedBy: varchar("issued_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revocationReason: text("revocation_reason"),
  },
  (t) => ({
    certificateNumberIdx: uniqueIndex("training_certificate_number_uidx").on(t.certificateNumber),
    verificationIdx: uniqueIndex("training_certificate_verification_uidx").on(t.verificationCode),
    participantIdx: index("training_certificate_participant_idx").on(t.participantId),
    sessionIdx: index("training_certificate_session_idx").on(t.sessionId),
    statusIdx: index("training_certificate_status_idx").on(t.status),
  })
);
