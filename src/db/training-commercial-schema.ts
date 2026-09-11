import {
  pgTable,
  varchar,
  integer,
  timestamp,
  date,
  numeric,
  text,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./schema";
import { trainingRequests } from "./training-request-schema";

export const trainingQuotations = pgTable(
  "training_quotations",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    quotationNumber: varchar("quotation_number", { length: 50 }).notNull(),
    requestId: varchar("request_id", { length: 36 })
      .notNull()
      .references(() => trainingRequests.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull().default(1),
    currency: varchar("currency", { length: 3 }).notNull().default("GHS"),
    status: varchar("status", { length: 24 }).notNull().default("draft"),
    validUntil: date("valid_until").notNull(),
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull().default("0"),
    discountAmount: numeric("discount_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    taxRate: numeric("tax_rate", { precision: 6, scale: 3 }).notNull().default("0"),
    taxAmount: numeric("tax_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    terms: text("terms"),
    notes: text("notes"),
    preparedBy: varchar("prepared_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    approvedBy: varchar("approved_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    acceptedByName: varchar("accepted_by_name", { length: 200 }),
    acceptedByEmail: varchar("accepted_by_email", { length: 200 }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    clientDecisionNotes: text("client_decision_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    numberIdx: uniqueIndex("training_quotation_number_uidx").on(t.quotationNumber),
    requestVersionIdx: uniqueIndex("training_quotation_request_version_uidx").on(t.requestId, t.versionNumber),
    requestStatusIdx: index("training_quotation_request_status_idx").on(t.requestId, t.status),
    validUntilIdx: index("training_quotation_valid_until_idx").on(t.validUntil),
  })
);

export const trainingQuotationItems = pgTable(
  "training_quotation_items",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    quotationId: varchar("quotation_id", { length: 36 })
      .notNull()
      .references(() => trainingQuotations.id, { onDelete: "cascade" }),
    itemType: varchar("item_type", { length: 30 }).notNull(),
    description: varchar("description", { length: 500 }).notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
    unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
    lineTotal: numeric("line_total", { precision: 14, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    quotationIdx: index("training_quotation_item_quotation_idx").on(t.quotationId),
    typeIdx: index("training_quotation_item_type_idx").on(t.itemType),
  })
);
