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

export const trainingRegulatoryRequirements = pgTable(
  "training_regulatory_requirements",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    requirementCode: varchar("requirement_code", { length: 50 }).notNull(),
    serviceId: varchar("service_id", { length: 80 }),
    title: varchar("title", { length: 240 }).notNull(),
    authority: varchar("authority", { length: 240 }).notNull(),
    standardReference: varchar("standard_reference", { length: 240 }),
    requirementType: varchar("requirement_type", { length: 30 }).notNull(),
    mandatory: boolean("mandatory").notNull().default(true),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    reviewDueDate: date("review_due_date"),
    notes: text("notes"),
    createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    codeIdx: uniqueIndex("training_regulatory_requirement_code_uidx").on(t.requirementCode),
    serviceStatusIdx: index("training_regulatory_requirement_service_status_idx").on(t.serviceId, t.status),
    reviewIdx: index("training_regulatory_requirement_review_idx").on(t.reviewDueDate),
  })
);

export const trainingAccreditationRecords = pgTable(
  "training_accreditation_records",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    requirementId: varchar("requirement_id", { length: 36 })
      .notNull()
      .references(() => trainingRegulatoryRequirements.id, { onDelete: "cascade" }),
    credentialNumber: varchar("credential_number", { length: 120 }),
    issuingAuthority: varchar("issuing_authority", { length: 240 }).notNull(),
    issuedDate: date("issued_date"),
    validFrom: date("valid_from").notNull(),
    validUntil: date("valid_until"),
    evidenceReference: varchar("evidence_reference", { length: 500 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    verificationNotes: text("verification_notes"),
    verifiedBy: varchar("verified_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    requirementIdx: index("training_accreditation_requirement_idx").on(t.requirementId),
    statusValidityIdx: index("training_accreditation_status_validity_idx").on(t.status, t.validUntil),
    credentialIdx: index("training_accreditation_credential_idx").on(t.credentialNumber),
  })
);

export const trainingSessionComplianceReviews = pgTable(
  "training_session_compliance_reviews",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    sessionId: varchar("session_id", { length: 36 })
      .notNull()
      .references(() => trainingSessions.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 20 }).notNull().default("blocked"),
    blockers: jsonb("blockers").$type<string[]>().notNull().default([]),
    reviewedBy: varchar("reviewed_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull().defaultNow(),
    notes: text("notes"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sessionIdx: uniqueIndex("training_session_compliance_session_uidx").on(t.sessionId),
    statusIdx: index("training_session_compliance_status_idx").on(t.status),
    reviewedIdx: index("training_session_compliance_reviewed_idx").on(t.reviewedAt),
  })
);
