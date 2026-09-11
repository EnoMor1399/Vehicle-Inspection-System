import {
  pgTable,
  varchar,
  integer,
  boolean,
  timestamp,
  date,
  text,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { locations, users } from "./schema";
import { trainingSessions } from "./training-schema";

export const trainingResources = pgTable(
  "training_resources",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    resourceCode: varchar("resource_code", { length: 40 }).notNull(),
    name: varchar("name", { length: 220 }).notNull(),
    resourceType: varchar("resource_type", { length: 30 }).notNull(),
    status: varchar("status", { length: 24 }).notNull().default("available"),
    locationId: varchar("location_id", { length: 36 }).references(() => locations.id, { onDelete: "set null" }),
    identifier: varchar("identifier", { length: 140 }),
    isExclusive: boolean("is_exclusive").notNull().default(true),
    availableQuantity: integer("available_quantity").notNull().default(1),
    capacity: integer("capacity").notNull().default(1),
    serviceDueDate: date("service_due_date"),
    inspectionDueDate: date("inspection_due_date"),
    notes: text("notes"),
    createdBy: varchar("created_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    codeIdx: uniqueIndex("training_resource_code_uidx").on(t.resourceCode),
    typeStatusIdx: index("training_resource_type_status_idx").on(t.resourceType, t.status),
    locationIdx: index("training_resource_location_idx").on(t.locationId),
    serviceDueIdx: index("training_resource_service_due_idx").on(t.serviceDueDate),
    inspectionDueIdx: index("training_resource_inspection_due_idx").on(t.inspectionDueDate),
  })
);

export const trainingResourceAllocations = pgTable(
  "training_resource_allocations",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    resourceId: varchar("resource_id", { length: 36 })
      .notNull()
      .references(() => trainingResources.id, { onDelete: "restrict" }),
    sessionId: varchar("session_id", { length: 36 })
      .notNull()
      .references(() => trainingSessions.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    status: varchar("status", { length: 24 }).notNull().default("reserved"),
    notes: text("notes"),
    allocatedBy: varchar("allocated_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    allocatedAt: timestamp("allocated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    resourceSessionIdx: uniqueIndex("training_resource_allocation_resource_session_uidx").on(t.resourceId, t.sessionId),
    resourceStatusIdx: index("training_resource_allocation_resource_status_idx").on(t.resourceId, t.status),
    sessionStatusIdx: index("training_resource_allocation_session_status_idx").on(t.sessionId, t.status),
  })
);
