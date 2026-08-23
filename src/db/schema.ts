import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  numeric,
  date,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============ ENUMS ============
export const userRoleEnum = pgEnum("user_role", [
  "super_admin",
  "admin",
  "operations_manager",
  "supervisor",
  "inspector",
  "data_entry",
  "auditor",
  "compliance_officer",
  "viewer",
  "transporter_user",
]);

export const vehicleStatusEnum = pgEnum("vehicle_status", [
  "active",
  "under_inspection",
  "failed",
  "passed",
  "suspended",
  "decommissioned",
]);

export const fuelTypeEnum = pgEnum("fuel_type", ["petrol", "diesel", "electric", "hybrid", "cng", "lpg"]);
export const transmissionEnum = pgEnum("transmission", ["manual", "automatic", "cvt", "semi-automatic"]);

export const inspectionResultEnum = pgEnum("inspection_result", [
  "pass",
  "conditional_pass",
  "reinspection_required",
  "fail",
]);

export const inspectionWorkflowEnum = pgEnum("inspection_workflow", [
  "draft",
  "scheduled",
  "in_progress",
  "completed",
  "approved",
  "failed",
  "reinspection",
  "archived",
]);

export const itemResultEnum = pgEnum("item_result", ["pass", "fail", "na"]);
export const severityEnum = pgEnum("severity", ["minor", "major", "critical"]);

export const docTypeEnum = pgEnum("doc_type", [
  "registration",
  "insurance",
  "roadworthy",
  "road_fund",
  "permit",
  "company",
  "photo",
  "certificate",
  "driver_license",
  "other",
]);

export const auditActionEnum = pgEnum("audit_action", [
  "create",
  "update",
  "delete",
  "restore",
  "archive",
  "inspect",
  "approve",
  "reject",
  "import",
  "export",
  "login",
  "logout",
  "login_failed",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "inspection_due",
  "certificate_expiring",
  "inspection_failed",
  "reinspection_due",
  "document_expiry",
  "monthly_summary",
  "system",
]);

export const importStatusEnum = pgEnum("import_status", [
  "pending",
  "validating",
  "processing",
  "completed",
  "failed",
  "rolled_back",
]);

export const signatureTypeEnum = pgEnum("signature_type", ["inspector", "supervisor"]);

export const dailyInspectionStatusEnum = pgEnum("daily_inspection_status", [
  "passed",
  "failed",
  "defect_noted",
]);

// ============ DAILY PRE-TRIP INSPECTIONS ============
// Separate from bi-annual comprehensive inspections.
// Must be completed before each trip to confirm the vehicle is roadworthy for that day.
export const dailyInspections = pgTable(
  "daily_inspections",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    vehicleId: varchar("vehicle_id", { length: 36 })
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    driverId: varchar("driver_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    driverName: varchar("driver_name", { length: 200 }),
    inspectionDate: date("inspection_date").notNull(),
    startTime: timestamp("start_time").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
    odometer: integer("odometer"),
    tripPurpose: text("trip_purpose"),
    routeDescription: text("route_description"),
    status: dailyInspectionStatusEnum("status").notNull().default("passed"),
    // Checklist data: array of { category, items: [{name, result: pass/fail/na, notes, photos}] }
    checklist: jsonb("checklist").$type<DailyChecklistCategory[]>().notNull().default([]),
    // Total counts
    totalItems: integer("total_items").notNull().default(0),
    passedItems: integer("passed_items").notNull().default(0),
    failedItems: integer("failed_items").notNull().default(0),
    // Critical defects requiring immediate attention
    criticalDefects: jsonb("critical_defects").$type<{ item: string; notes: string; photo?: string }[]>().default([]),
    // Driver attestation
    driverSignature: text("driver_signature"),
    supervisorReview: boolean("supervisor_review").notNull().default(false),
    supervisorId: varchar("supervisor_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    supervisorNotes: text("supervisor_notes"),
    // Cleared for trip? (false = vehicle must not leave the yard)
    clearedForTrip: boolean("cleared_for_trip").notNull().default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    vehicleIdx: index("daily_insp_vehicle_idx").on(t.vehicleId),
    dateIdx: index("daily_insp_date_idx").on(t.inspectionDate),
    driverIdx: index("daily_insp_driver_idx").on(t.driverId),
    statusIdx: index("daily_insp_status_idx").on(t.status),
  })
);

export interface DailyChecklistItem {
  name: string;
  result: "pass" | "fail" | "na";
  notes?: string;
  photos?: string[];
}
export interface DailyChecklistCategory {
  category: string;
  icon?: string;
  items: DailyChecklistItem[];
}

// ============ SYSTEM SETTINGS (singleton) ============
export const systemSettings = pgTable("system_settings", {
  id: varchar("id", { length: 36 }).primaryKey(),
  // Branding
  logoDataUrl: text("logo_data_url"),
  logoUrl: text("logo_url"),
  companyName: varchar("company_name", { length: 255 }).notNull().default("Road Safety Limited"),
  companyShortName: varchar("company_short_name", { length: 50 }).notNull().default("RSL"),
  tagline: varchar("tagline", { length: 255 }).default("Vehicle Inspection Management System"),
  themeColor: varchar("theme_color", { length: 20 }).notNull().default("#f59e0b"),
  accentColor: varchar("accent_color", { length: 20 }).notNull().default("#0f172a"),
  // Organization
  address: text("address"),
  city: varchar("city", { length: 100 }),
  region: varchar("region", { length: 100 }),
  country: varchar("country", { length: 100 }).default("Ghana"),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 200 }),
  website: varchar("website", { length: 200 }),
  taxId: varchar("tax_id", { length: 100 }),
  registrationNumber: varchar("registration_number", { length: 100 }),
  // Inspection defaults
  defaultStationId: varchar("default_station_id", { length: 36 }),
  certificateValidityMonths: integer("certificate_validity_months").notNull().default(6),
  reinspectionGraceDays: integer("reinspection_grace_days").notNull().default(14),
  requireSupervisorApproval: boolean("require_supervisor_approval").notNull().default(true),
  requireGpsCapture: boolean("require_gps_capture").notNull().default(false),
  requireDigitalSignature: boolean("require_digital_signature").notNull().default(true),
  // Certificate
  certificateHeader: text("certificate_header"),
  certificateFooter: text("certificate_footer").default("This is an electronically generated certificate. Verify at the URL printed on the QR code."),
  footerText: text("footer_text").default("© 2026 Road Safety Limited. All rights reserved."),
  // Security
  sessionTimeoutMinutes: integer("session_timeout_minutes").notNull().default(480),
  passwordMinLength: integer("password_min_length").notNull().default(12),
  passwordRequireUppercase: boolean("password_require_uppercase").notNull().default(true),
  passwordRequireNumber: boolean("password_require_number").notNull().default(true),
  maxFailedAttempts: integer("max_failed_attempts").notNull().default(5),
  lockoutDurationMinutes: integer("lockout_duration_minutes").notNull().default(15),
  // Notifications
  emailNotificationsEnabled: boolean("email_notifications_enabled").notNull().default(true),
  smsNotificationsEnabled: boolean("sms_notifications_enabled").notNull().default(false),
  reminderDaysBefore: integer("reminder_days_before").notNull().default(30),
  // Tracking
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: varchar("updated_by", { length: 36 }).references(() => users.id),
});

// ============ WEBHOOKS ============
export const webhooks = pgTable(
  "webhooks",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    events: jsonb("events").$type<string[]>().notNull().default([]),
    secret: text("secret"),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    lastTriggeredAt: timestamp("last_triggered_at"),
    failureCount: integer("failure_count").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("webhook_user_idx").on(t.userId),
  })
);

export const locationStatusEnum = pgEnum("location_status", ["active", "inactive", "maintenance"]);

// ============ LOCATIONS (Inspection Stations) ============
export const locations = pgTable(
  "locations",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    code: varchar("code", { length: 20 }).notNull().unique(),
    region: varchar("region", { length: 100 }),
    district: varchar("district", { length: 100 }),
    address: text("address"),
    gpsAddress: varchar("gps_address", { length: 100 }),
    phone: varchar("phone", { length: 50 }),
    email: varchar("email", { length: 200 }),
    managerName: varchar("manager_name", { length: 200 }),
    capacity: integer("capacity"), // daily inspection capacity
    equipment: jsonb("equipment").$type<string[]>().default([]),
    status: locationStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    codeIdx: index("location_code_idx").on(t.code),
    regionIdx: index("location_region_idx").on(t.region),
  })
);

// ============ USERS ============
export const users = pgTable(
  "users",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    email: varchar("email", { length: 200 }).notNull().unique(),
    role: userRoleEnum("role").notNull().default("viewer"),
    avatar: text("avatar"),
    passwordHash: text("password_hash"),
    phone: varchar("phone", { length: 50 }),
    locationId: varchar("location_id", { length: 36 }).references(() => locations.id, { onDelete: "set null" }),
    // Fine-grained permissions override (JSONB). Empty/null = use role defaults.
    permissions: jsonb("permissions").$type<Record<string, boolean>>().default({}),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at"),
    failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until"),
    // Two-factor authentication
    twoFactorSecret: text("two_factor_secret"),
    twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
    // Security metadata
    lastIp: varchar("last_ip", { length: 45 }),
    lastUserAgent: text("last_user_agent"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    roleIdx: index("user_role_idx").on(t.role),
    locationIdx: index("user_location_idx").on(t.locationId),
    emailIdx: index("user_email_idx").on(t.email),
  })
);

// ============ TRANSPORTERS ============
export const transporters = pgTable(
  "transporters",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    companyName: varchar("company_name", { length: 255 }).notNull(),
    registrationNumber: varchar("registration_number", { length: 100 }),
    tinNumber: varchar("tin_number", { length: 100 }),
    gpsAddress: varchar("gps_address", { length: 100 }),
    contactPerson: varchar("contact_person", { length: 200 }),
    mobile: varchar("mobile", { length: 50 }),
    email: varchar("email", { length: 200 }),
    physicalAddress: text("physical_address"),
    region: varchar("region", { length: 100 }),
    district: varchar("district", { length: 100 }),
    insuranceCompany: varchar("insurance_company", { length: 200 }),
    insuranceExpiry: date("insurance_expiry"),
    businessPermit: varchar("business_permit", { length: 200 }),
    permitExpiry: date("permit_expiry"),
    licenseNumber: varchar("license_number", { length: 200 }),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    deletedAt: timestamp("deleted_at"),
    archivedAt: timestamp("archived_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    companyIdx: index("transporter_company_idx").on(t.companyName),
    deletedIdx: index("transporter_deleted_idx").on(t.deletedAt),
  })
);

// ============ VEHICLES ============
export const vehicles = pgTable(
  "vehicles",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    transporterId: varchar("transporter_id", { length: 36 }).references(() => transporters.id, { onDelete: "set null" }),
    registrationNumber: varchar("registration_number", { length: 50 }).notNull().unique(),
    oldRegistrationNumber: varchar("old_registration_number", { length: 50 }),
    make: varchar("make", { length: 100 }).notNull(),
    model: varchar("model", { length: 100 }),
    variant: varchar("variant", { length: 100 }),
    bodyType: varchar("body_type", { length: 50 }),
    category: varchar("category", { length: 50 }),
    vehicleClass: varchar("vehicle_class", { length: 50 }),
    colour: varchar("colour", { length: 50 }),
    manufacturingYear: integer("manufacturing_year"),
    countryOfManufacture: varchar("country_of_manufacture", { length: 100 }),
    engineNumber: varchar("engine_number", { length: 100 }),
    chassisNumber: varchar("chassis_number", { length: 100 }),
    vin: varchar("vin", { length: 50 }),
    fuelType: fuelTypeEnum("fuel_type").default("diesel"),
    transmission: transmissionEnum("transmission").default("manual"),
    engineCapacity: integer("engine_capacity"),
    seatingCapacity: integer("seating_capacity"),
    grossWeight: numeric("gross_weight", { precision: 10, scale: 2 }),
    netWeight: numeric("net_weight", { precision: 10, scale: 2 }),
    numberOfAxles: integer("number_of_axles"),
    odometerReading: integer("odometer_reading"),
    ownerName: varchar("owner_name", { length: 200 }),
    ownerContact: varchar("owner_contact", { length: 100 }),
    insuranceCompany: varchar("insurance_company", { length: 200 }),
    policyNumber: varchar("policy_number", { length: 100 }),
    insuranceExpiry: date("insurance_expiry"),
    roadworthyExpiry: date("roadworthy_expiry"),
    roadFundExpiry: date("road_fund_expiry"),
    status: vehicleStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    regIdx: index("vehicle_reg_idx").on(t.registrationNumber),
    transporterIdx: index("vehicle_transporter_idx").on(t.transporterId),
    statusIdx: index("vehicle_status_idx").on(t.status),
  })
);

// ============ RFID TAG REGISTRY ============
export const rfidTags = pgTable(
  "rfid_tags",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    tagUid: varchar("tag_uid", { length: 128 }).notNull().unique(),
    vehicleId: varchar("vehicle_id", { length: 36 }).notNull().references(() => vehicles.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    assignedBy: varchar("assigned_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    assignedAt: timestamp("assigned_at").notNull().defaultNow(),
    lastScannedAt: timestamp("last_scanned_at"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    tagIdx: index("rfid_tag_uid_idx").on(t.tagUid),
    vehicleIdx: index("rfid_vehicle_idx").on(t.vehicleId),
    statusIdx: index("rfid_status_idx").on(t.status),
  })
);

// ============ INSPECTIONS ============
export const inspections = pgTable(
  "inspections",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    inspectionNumber: varchar("inspection_number", { length: 50 }).notNull().unique(),
    vehicleId: varchar("vehicle_id", { length: 36 })
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    locationId: varchar("location_id", { length: 36 }).references(() => locations.id, { onDelete: "set null" }),
    inspectionDate: timestamp("inspection_date").notNull().defaultNow(),
    scheduledDate: timestamp("scheduled_date"),
    inspectorId: varchar("inspector_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    inspectorName: varchar("inspector_name", { length: 200 }),
    supervisorId: varchar("supervisor_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    supervisorName: varchar("supervisor_name", { length: 200 }),
    station: varchar("station", { length: 200 }),
    odometerReading: integer("odometer_reading"),
    workflowStatus: inspectionWorkflowEnum("workflow_status").notNull().default("completed"),
    sectionData: jsonb("section_data").$type<InspectionSectionData[]>().notNull().default([]),
    serviceBrakeEfficiency: numeric("service_brake_efficiency", { precision: 5, scale: 2 }),
    parkingBrakeEfficiency: numeric("parking_brake_efficiency", { precision: 5, scale: 2 }),
    smokeTest: itemResultEnum("smoke_test"),
    noiseLevel: numeric("noise_level", { precision: 6, scale: 2 }),
    exhaustEmission: numeric("exhaust_emission", { precision: 6, scale: 2 }),
    opacityTest: numeric("opacity_test", { precision: 5, scale: 2 }),
    overallResult: inspectionResultEnum("overall_result").notNull().default("reinspection_required"),
    inspectorRemarks: text("inspector_remarks"),
    supervisorRemarks: text("supervisor_remarks"),
    nextInspectionDate: date("next_inspection_date"),
    reinspectionDate: date("reinspection_date"),
    inspectorSignature: text("inspector_signature"),
    supervisorSignature: text("supervisor_signature"),
    certificateQr: text("certificate_qr"),
    templateType: varchar("template_type", { length: 50 }), // bus, truck, tanker, trailer, taxi, private
    attachedDocuments: jsonb("attached_documents").$type<InspectionDocument[]>().default([]),
    totalPhotos: integer("total_photos").notNull().default(0),
    status: varchar("status", { length: 20 }).notNull().default("completed"),
    archivedAt: timestamp("archived_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    vehicleIdx: index("inspection_vehicle_idx").on(t.vehicleId),
    numberIdx: index("inspection_number_idx").on(t.inspectionNumber),
    dateIdx: index("inspection_date_idx").on(t.inspectionDate),
    locationIdx: index("inspection_location_idx").on(t.locationId),
    workflowIdx: index("inspection_workflow_idx").on(t.workflowStatus),
  })
);

export interface InspectionPhoto {
  id: string;
  dataUrl: string;
  caption?: string;
  takenAt: string;
}

export interface InspectionItem {
  name: string;
  result: "pass" | "fail" | "na";
  severity?: "minor" | "major" | "critical";
  remarks?: string;
  photos?: InspectionPhoto[];
}

export interface InspectionDocument {
  id: string;
  name: string;
  dataUrl: string;
  type: string;
  size: number;
}

export interface InspectionSectionData {
  section: string;
  title: string;
  items: InspectionItem[];
}

// ============ DOCUMENTS ============
export const documents = pgTable(
  "documents",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    ownerType: varchar("owner_type", { length: 20 }).notNull(),
    ownerId: varchar("owner_id", { length: 36 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    type: docTypeEnum("type").notNull().default("other"),
    url: text("url").notNull(),
    mimeType: varchar("mime_type", { length: 100 }),
    sizeBytes: integer("size_bytes"),
    version: integer("version").notNull().default(1),
    expiryDate: date("expiry_date"),
    uploadedBy: varchar("uploaded_by", { length: 36 }).references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    ownerIdx: index("doc_owner_idx").on(t.ownerType, t.ownerId),
    expiryIdx: index("doc_expiry_idx").on(t.expiryDate),
  })
);

// ============ AUDIT LOGS ============
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    userName: varchar("user_name", { length: 200 }),
    action: auditActionEnum("action").notNull(),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityId: varchar("entity_id", { length: 36 }),
    entityLabel: varchar("entity_label", { length: 255 }),
    summary: text("summary"),
    before: jsonb("before"),
    after: jsonb("after"),
    ipAddress: varchar("ip_address", { length: 50 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    entityIdx: index("audit_entity_idx").on(t.entityType, t.entityId),
    userIdx: index("audit_user_idx").on(t.userId),
    createdIdx: index("audit_created_idx").on(t.createdAt),
  })
);

// ============ NOTIFICATIONS ============
export const notifications = pgTable(
  "notifications",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).references(() => users.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message").notNull(),
    entityType: varchar("entity_type", { length: 50 }),
    entityId: varchar("entity_id", { length: 36 }),
    dueDate: date("due_date"),
    channel: varchar("channel", { length: 50 }).notNull().default("in_app"), // in_app, email, sms
    readAt: timestamp("read_at"),
    sentAt: timestamp("sent_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("notif_user_idx").on(t.userId),
    typeIdx: index("notif_type_idx").on(t.type),
    dueIdx: index("notif_due_idx").on(t.dueDate),
  })
);

// ============ IMPORT JOBS ============
export const importJobs = pgTable(
  "import_jobs",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    fileType: varchar("file_type", { length: 20 }).notNull(), // xlsx, xls, csv
    entityType: varchar("entity_type", { length: 50 }).notNull(), // vehicles, transporters, inspections
    status: importStatusEnum("status").notNull().default("pending"),
    totalRows: integer("total_rows").notNull().default(0),
    validRows: integer("valid_rows").notNull().default(0),
    invalidRows: integer("invalid_rows").notNull().default(0),
    importedRows: integer("imported_rows").notNull().default(0),
    columnMapping: jsonb("column_mapping").$type<Record<string, string>>(),
    errors: jsonb("errors").$type<{ row: number; field: string; message: string }[]>(),
    rollbackAt: timestamp("rollback_at"),
    createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
  },
  (t) => ({
    statusIdx: index("import_status_idx").on(t.status),
    createdIdx: index("import_created_idx").on(t.createdAt),
  })
);

// ============ API KEYS ============
export const apiKeys = pgTable(
  "api_keys",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    keyHash: varchar("key_hash", { length: 128 }).notNull().unique(),
    keyPrefix: varchar("key_prefix", { length: 12 }).notNull(),
    scopes: jsonb("scopes").$type<string[]>().default(["read"]),
    isActive: boolean("is_active").notNull().default(true),
    lastUsedAt: timestamp("last_used_at"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    userHashIdx: index("api_key_user_idx").on(t.userId),
    hashIdx: index("api_key_hash_idx").on(t.keyHash),
  })
);

// ============ SIGNATURES ============
export const signatures = pgTable(
  "signatures",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    inspectionId: varchar("inspection_id", { length: 36 })
      .notNull()
      .references(() => inspections.id, { onDelete: "cascade" }),
    type: signatureTypeEnum("type").notNull(),
    signerName: varchar("signer_name", { length: 200 }).notNull(),
    signerId: varchar("signer_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    dataUrl: text("data_url").notNull(),
    signedAt: timestamp("signed_at").notNull().defaultNow(),
    ipAddress: varchar("ip_address", { length: 50 }),
  },
  (t) => ({
    inspIdx: index("sig_inspection_idx").on(t.inspectionId),
  })
);

// ============ SECURITY ============
export const sessions = pgTable(
  "sessions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 255 }).notNull().unique(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    location: varchar("location", { length: 200 }),
    deviceInfo: jsonb("device_info").$type<{
      browser?: string;
      os?: string;
      device?: string;
    }>(),
    isActive: boolean("is_active").notNull().default(true),
    expiresAt: timestamp("expires_at").notNull(),
    lastActivityAt: timestamp("last_activity_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    userSessionIdx: index("session_user_idx").on(t.userId),
    tokenIdx: index("session_token_idx").on(t.token),
    activeIdx: index("session_active_idx").on(t.isActive),
  })
);

export const securityEvents = pgTable(
  "security_events",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    eventType: varchar("event_type", { length: 50 }).notNull(), // login_failed, login_success, password_change, 2fa_enabled, etc.
    severity: varchar("severity", { length: 20 }).notNull().default("info"), // info, warning, critical
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    description: text("description"),
    metadata: jsonb("metadata").$type<Record<string, any>>(),
    resolved: boolean("resolved").notNull().default(false),
    resolvedAt: timestamp("resolved_at"),
    resolvedBy: varchar("resolved_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    userEventIdx: index("security_event_user_idx").on(t.userId),
    eventTypeIdx: index("security_event_type_idx").on(t.eventType),
    severityIdx: index("security_event_severity_idx").on(t.severity),
    createdIdx: index("security_event_created_idx").on(t.createdAt),
  })
);

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    email: varchar("email", { length: 200 }).notNull(),
    ipAddress: varchar("ip_address", { length: 45 }).notNull(),
    userAgent: text("user_agent"),
    success: boolean("success").notNull(),
    twoFactorRequired: boolean("two_factor_required").notNull().default(false),
    failureReason: varchar("failure_reason", { length: 100 }), // invalid_password, account_locked, 2fa_failed, etc.
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: index("login_attempt_email_idx").on(t.email),
    ipIdx: index("login_attempt_ip_idx").on(t.ipAddress),
    createdIdx: index("login_attempt_created_idx").on(t.createdAt),
  })
);

// ============ RELATIONS ============
export const locationRelations = relations(locations, ({ many }) => ({
  users: many(users),
  inspections: many(inspections),
}));

export const userRelations = relations(users, ({ one }) => ({
  location: one(locations, { fields: [users.locationId], references: [locations.id] }),
}));

export const transporterRelations = relations(transporters, ({ many }) => ({
  vehicles: many(vehicles),
}));

export const vehicleRelations = relations(vehicles, ({ one, many }) => ({
  transporter: one(transporters, {
    fields: [vehicles.transporterId],
    references: [transporters.id],
  }),
  inspections: many(inspections),
}));

export const inspectionRelations = relations(inspections, ({ one }) => ({
  vehicle: one(vehicles, { fields: [inspections.vehicleId], references: [vehicles.id] }),
  inspector: one(users, { fields: [inspections.inspectorId], references: [users.id] }),
  supervisor: one(users, { fields: [inspections.supervisorId], references: [users.id] }),
  location: one(locations, { fields: [inspections.locationId], references: [locations.id] }),
}));
