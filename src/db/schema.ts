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
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ============ ENUMS ============
export const userRoleEnum = pgEnum("user_role", [
  "super_admin",
  "organization_owner",
  "vehicle_inspection_admin",
  "driver_training_admin",
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

export const inspectionAppointmentStatusEnum = pgEnum("inspection_appointment_status", [
  "scheduled",
  "confirmed",
  "checked_in",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
]);

export const organizationStatusEnum = pgEnum("organization_status", [
  "pending",
  "provisioning",
  "active",
  "suspended",
  "cancelled",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "grace",
  "suspended",
  "cancelled",
  "expired",
]);

export const billingCycleEnum = pgEnum("billing_cycle", ["monthly", "annual", "custom"]);

export const onboardingRequestStatusEnum = pgEnum("onboarding_request_status", [
  "pending",
  "reviewing",
  "approved",
  "rejected",
  "converted",
]);

// ============ MULTI-ORGANIZATION CONTROL PLANE ============
export const organizations = pgTable(
  "organizations",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    legalName: varchar("legal_name", { length: 255 }),
    registrationNumber: varchar("registration_number", { length: 100 }),
    taxId: varchar("tax_id", { length: 100 }),
    industry: varchar("industry", { length: 120 }),
    country: varchar("country", { length: 100 }).notNull().default("Ghana"),
    region: varchar("region", { length: 100 }),
    city: varchar("city", { length: 100 }),
    address: text("address"),
    phone: varchar("phone", { length: 50 }),
    email: varchar("email", { length: 200 }),
    website: varchar("website", { length: 200 }),
    logoDataUrl: text("logo_data_url"),
    logoUrl: text("logo_url"),
    themeColor: varchar("theme_color", { length: 20 }).notNull().default("#039703"),
    accentColor: varchar("accent_color", { length: 20 }).notNull().default("#026b02"),
    enabledModules: jsonb("enabled_modules").$type<string[]>().notNull().default([
      "vehicle_inspection",
      "driver_training",
      "reports",
    ]),
    status: organizationStatusEnum("status").notNull().default("pending"),
    onboardingStage: varchar("onboarding_stage", { length: 50 }).notNull().default("company_profile"),
    operationalAccessEnabled: boolean("operational_access_enabled").notNull().default(false),
    dataIsolationVerifiedAt: timestamp("data_isolation_verified_at"),
    createdBy: varchar("created_by", { length: 36 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    slugIdx: index("organization_slug_idx").on(t.slug),
    statusIdx: index("organization_status_idx").on(t.status),
    createdIdx: index("organization_created_idx").on(t.createdAt),
  }),
);

// Global platform copy is distinct from each subscriber's organization settings.
export const platformContent = pgTable(
  "platform_content",
  {
    key: varchar("key", { length: 100 }).primaryKey(),
    draftText: text("draft_text"),
    publishedText: text("published_text"),
    revision: integer("revision").notNull().default(0),
    updatedBy: varchar("updated_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    publishedAt: timestamp("published_at"),
  },
);

export const subscriptionPlans = pgTable(
  "subscription_plans",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    code: varchar("code", { length: 50 }).notNull().unique(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    billingCycle: billingCycleEnum("billing_cycle").notNull().default("monthly"),
    price: numeric("price", { precision: 12, scale: 2 }).notNull().default("0"),
    currency: varchar("currency", { length: 3 }).notNull().default("GHS"),
    trialDays: integer("trial_days").notNull().default(14),
    maxUsers: integer("max_users").notNull().default(10),
    maxStations: integer("max_stations").notNull().default(2),
    maxVehicles: integer("max_vehicles").notNull().default(500),
    maxInspectionsPerMonth: integer("max_inspections_per_month").notNull().default(1000),
    modules: jsonb("modules").$type<string[]>().notNull().default(["vehicle_inspection", "reports"]),
    features: jsonb("features").$type<Record<string, boolean>>().notNull().default({}),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    codeIdx: index("subscription_plan_code_idx").on(t.code),
    activeOrderIdx: index("subscription_plan_active_order_idx").on(t.isActive, t.sortOrder),
  }),
);

export const organizationSubscriptions = pgTable(
  "organization_subscriptions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    planId: varchar("plan_id", { length: 36 })
      .notNull()
      .references(() => subscriptionPlans.id, { onDelete: "restrict" }),
    status: subscriptionStatusEnum("status").notNull().default("trialing"),
    provider: varchar("provider", { length: 40 }).notNull().default("manual"),
    providerCustomerId: varchar("provider_customer_id", { length: 150 }),
    providerSubscriptionId: varchar("provider_subscription_id", { length: 150 }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull().default("0"),
    currency: varchar("currency", { length: 3 }).notNull().default("GHS"),
    checkoutEnabled: boolean("checkout_enabled").notNull().default(false),
    currentPeriodStart: timestamp("current_period_start").notNull().defaultNow(),
    currentPeriodEnd: timestamp("current_period_end"),
    trialEndsAt: timestamp("trial_ends_at"),
    graceEndsAt: timestamp("grace_ends_at"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    seats: integer("seats").notNull().default(1),
    notes: text("notes"),
    createdBy: varchar("created_by", { length: 36 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    organizationIdx: index("organization_subscription_org_idx").on(t.organizationId, t.createdAt.desc()),
    statusIdx: index("organization_subscription_status_idx").on(t.status),
    providerIdx: index("organization_subscription_provider_idx").on(t.provider, t.providerSubscriptionId),
  }),
);

// Subscription payment attempts are tenant-bound; no card numbers, CVVs, MoMo PINs
// or provider secret keys are persisted in VIMS.
export const subscriptionPayments = pgTable(
  "subscription_payments",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 }).notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    subscriptionId: varchar("subscription_id", { length: 36 }).notNull()
      .references(() => organizationSubscriptions.id, { onDelete: "restrict" }),
    billingPeriodStart: timestamp("billing_period_start").notNull(),
    initiatedBy: varchar("initiated_by", { length: 36 }).notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    provider: varchar("provider", { length: 24 }).notNull().default("paystack"),
    reference: varchar("reference", { length: 90 }).notNull().unique(),
    amountSubunits: integer("amount_subunits").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("GHS"),
    channel: varchar("channel", { length: 20 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    customerEmail: varchar("customer_email", { length: 200 }).notNull(),
    gatewayTransactionId: varchar("gateway_transaction_id", { length: 40 }),
    gatewayMessage: varchar("gateway_message", { length: 240 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    paidAt: timestamp("paid_at"),
  },
  (t) => ({
    organizationCreatedIdx: index("subscription_payment_org_created_idx").on(t.organizationId, t.createdAt.desc()),
    subscriptionIdx: index("subscription_payment_subscription_idx").on(t.subscriptionId),
    statusIdx: index("subscription_payment_status_idx").on(t.status),
  }),
);

export const organizationInvitations = pgTable(
  "organization_invitations",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 200 }).notNull(),
    name: varchar("name", { length: 200 }),
    role: userRoleEnum("role").notNull().default("viewer"),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    acceptedAt: timestamp("accepted_at"),
    revokedAt: timestamp("revoked_at"),
    createdBy: varchar("created_by", { length: 36 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    organizationIdx: index("organization_invitation_org_idx").on(t.organizationId),
    emailIdx: index("organization_invitation_email_idx").on(t.email),
    expiryIdx: index("organization_invitation_expiry_idx").on(t.expiresAt),
  }),
);

export const organizationOnboardingRequests = pgTable(
  "organization_onboarding_requests",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    companyName: varchar("company_name", { length: 255 }).notNull(),
    contactName: varchar("contact_name", { length: 200 }).notNull(),
    contactEmail: varchar("contact_email", { length: 200 }).notNull(),
    contactPhone: varchar("contact_phone", { length: 50 }),
    country: varchar("country", { length: 100 }).notNull().default("Ghana"),
    industry: varchar("industry", { length: 120 }),
    estimatedUsers: integer("estimated_users"),
    estimatedVehicles: integer("estimated_vehicles"),
    desiredPlanCode: varchar("desired_plan_code", { length: 50 }),
    requestedModules: jsonb("requested_modules").$type<string[]>().notNull().default(["vehicle_inspection"]),
    notes: text("notes"),
    status: onboardingRequestStatusEnum("status").notNull().default("pending"),
    reviewNotes: text("review_notes"),
    reviewedBy: varchar("reviewed_by", { length: 36 }),
    reviewedAt: timestamp("reviewed_at"),
    sourceIpHash: varchar("source_ip_hash", { length: 64 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index("organization_onboarding_status_idx").on(t.status, t.createdAt.desc()),
    emailIdx: index("organization_onboarding_email_idx").on(t.contactEmail),
  }),
);

// ============ DAILY PRE-TRIP INSPECTIONS ============
// Separate from bi-annual comprehensive inspections.
// Must be completed before each trip to confirm the vehicle is roadworthy for that day.
export const dailyInspections = pgTable(
  "daily_inspections",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
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
    organizationIdx: index("daily_insp_organization_idx").on(t.organizationId),
    organizationDateIdx: index("daily_insp_organization_date_idx").on(t.organizationId, t.inspectionDate.desc()),
    vehicleIdx: index("daily_insp_vehicle_idx").on(t.vehicleId),
    dateIdx: index("daily_insp_date_idx").on(t.inspectionDate),
    driverIdx: index("daily_insp_driver_idx").on(t.driverId),
    statusIdx: index("daily_insp_status_idx").on(t.status),
    vehicleDateIdx: index("daily_insp_vehicle_date_idx").on(t.vehicleId, t.inspectionDate.desc()),
    vehicleClearanceDateIdx: index("daily_insp_vehicle_clearance_date_idx").on(
      t.vehicleId,
      t.clearedForTrip,
      t.inspectionDate.desc(),
    ),
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
  organizationId: varchar("organization_id", { length: 36 })
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
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
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
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
    organizationIdx: index("webhook_organization_idx").on(t.organizationId),
    userIdx: index("webhook_user_idx").on(t.userId),
  })
);

export const locationStatusEnum = pgEnum("location_status", ["active", "inactive", "maintenance"]);

// ============ LOCATIONS (Inspection Stations) ============
export const locations = pgTable(
  "locations",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 200 }).notNull(),
    code: varchar("code", { length: 20 }).notNull(),
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
    organizationIdx: index("location_organization_idx").on(t.organizationId),
    organizationCodeIdx: uniqueIndex("location_organization_code_uidx").on(t.organizationId, t.code),
    codeIdx: index("location_code_idx").on(t.code),
    regionIdx: index("location_region_idx").on(t.region),
  })
);

// ============ USERS ============
export const users = pgTable(
  "users",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 200 }).notNull(),
    email: varchar("email", { length: 200 }).notNull().unique(),
    role: userRoleEnum("role").notNull().default("viewer"),
    avatar: text("avatar"),
    passwordHash: text("password_hash"),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    phone: varchar("phone", { length: 50 }),
    locationId: varchar("location_id", { length: 36 }).references(() => locations.id, { onDelete: "set null" }),
    transporterId: varchar("transporter_id", { length: 36 }).references(() => transporters.id, { onDelete: "set null" }),
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
    organizationIdx: index("user_organization_idx").on(t.organizationId),
    organizationRoleIdx: index("user_organization_role_idx").on(t.organizationId, t.role),
    roleIdx: index("user_role_idx").on(t.role),
    locationIdx: index("user_location_idx").on(t.locationId),
    transporterIdx: index("user_transporter_idx").on(t.transporterId),
    emailIdx: index("user_email_idx").on(t.email),
  })
);

// ============ TRANSPORTERS ============
export const transporters = pgTable(
  "transporters",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
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
    organizationIdx: index("transporter_organization_idx").on(t.organizationId),
    organizationCompanyIdx: index("transporter_organization_company_idx").on(t.organizationId, t.companyName),
    companyIdx: index("transporter_company_idx").on(t.companyName),
    deletedIdx: index("transporter_deleted_idx").on(t.deletedAt),
    regionDeletedIdx: index("transporter_region_deleted_idx").on(t.region, t.deletedAt),
  })
);

// ============ VEHICLES ============
export const vehicles = pgTable(
  "vehicles",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    transporterId: varchar("transporter_id", { length: 36 }).references(() => transporters.id, { onDelete: "set null" }),
    registrationNumber: varchar("registration_number", { length: 50 }).notNull(),
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
    organizationIdx: index("vehicle_organization_idx").on(t.organizationId),
    organizationRegIdx: uniqueIndex("vehicle_organization_reg_uidx").on(t.organizationId, t.registrationNumber),
    organizationStatusIdx: index("vehicle_organization_status_idx").on(t.organizationId, t.status),
    regIdx: index("vehicle_reg_idx").on(t.registrationNumber),
    transporterIdx: index("vehicle_transporter_idx").on(t.transporterId),
    statusIdx: index("vehicle_status_idx").on(t.status),
    transporterStatusIdx: index("vehicle_transporter_status_idx").on(t.transporterId, t.status),
  })
);

// ============ RFID TAG REGISTRY ============
export const rfidTags = pgTable(
  "rfid_tags",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    tagUid: varchar("tag_uid", { length: 128 }).notNull(),
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
    organizationIdx: index("rfid_organization_idx").on(t.organizationId),
    organizationTagIdx: uniqueIndex("rfid_organization_tag_uidx").on(t.organizationId, t.tagUid),
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
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    inspectionNumber: varchar("inspection_number", { length: 50 }).notNull(),
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
    organizationIdx: index("inspection_organization_idx").on(t.organizationId),
    organizationNumberIdx: uniqueIndex("inspection_organization_number_uidx").on(t.organizationId, t.inspectionNumber),
    organizationDateIdx: index("inspection_organization_date_idx").on(t.organizationId, t.inspectionDate.desc()),
    organizationResultDateIdx: index("inspection_organization_result_date_idx").on(t.organizationId, t.overallResult, t.inspectionDate.desc()),
    vehicleIdx: index("inspection_vehicle_idx").on(t.vehicleId),
    numberIdx: index("inspection_number_idx").on(t.inspectionNumber),
    dateIdx: index("inspection_date_idx").on(t.inspectionDate),
    locationIdx: index("inspection_location_idx").on(t.locationId),
    workflowIdx: index("inspection_workflow_idx").on(t.workflowStatus),
    vehicleDateIdx: index("inspection_vehicle_date_idx").on(t.vehicleId, t.inspectionDate.desc()),
    vehicleResultDateIdx: index("inspection_vehicle_result_date_idx").on(
      t.vehicleId,
      t.overallResult,
      t.inspectionDate.desc(),
    ),
    locationDateIdx: index("inspection_location_date_idx").on(t.locationId, t.inspectionDate.desc()),
    resultDateIdx: index("inspection_result_date_idx").on(t.overallResult, t.inspectionDate.desc()),
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

// ============ INSPECTION APPOINTMENTS ============
export const inspectionAppointments = pgTable(
  "inspection_appointments",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    appointmentNumber: varchar("appointment_number", { length: 50 }).notNull(),
    vehicleId: varchar("vehicle_id", { length: 36 })
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    locationId: varchar("location_id", { length: 36 })
      .references(() => locations.id, { onDelete: "set null" }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(45),
    appointmentType: varchar("appointment_type", { length: 30 }).notNull().default("routine"),
    priority: varchar("priority", { length: 20 }).notNull().default("normal"),
    status: inspectionAppointmentStatusEnum("status").notNull().default("scheduled"),
    assignedInspectorId: varchar("assigned_inspector_id", { length: 36 })
      .references(() => users.id, { onDelete: "set null" }),
    linkedInspectionId: varchar("linked_inspection_id", { length: 36 })
      .references(() => inspections.id, { onDelete: "set null" }),
    notes: text("notes"),
    bookedBy: varchar("booked_by", { length: 36 })
      .references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    organizationIdx: index("inspection_appointment_organization_idx").on(t.organizationId),
    organizationNumberIdx: uniqueIndex("inspection_appointment_organization_number_uidx").on(t.organizationId, t.appointmentNumber),
    organizationScheduledIdx: index("inspection_appointment_organization_scheduled_idx").on(t.organizationId, t.scheduledAt),
    scheduledIdx: index("inspection_appointment_scheduled_idx").on(t.scheduledAt),
    locationScheduledIdx: index("inspection_appointment_location_scheduled_idx").on(t.locationId, t.scheduledAt),
    statusScheduledIdx: index("inspection_appointment_status_scheduled_idx").on(t.status, t.scheduledAt),
    vehicleScheduledIdx: index("inspection_appointment_vehicle_scheduled_idx").on(t.vehicleId, t.scheduledAt),
    inspectorScheduledIdx: index("inspection_appointment_inspector_scheduled_idx").on(t.assignedInspectorId, t.scheduledAt),
    linkedInspectionIdx: index("inspection_appointment_linked_inspection_idx").on(t.linkedInspectionId),
  }),
);

// ============ DOCUMENTS ============
export const documents = pgTable(
  "documents",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
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
    organizationIdx: index("document_organization_idx").on(t.organizationId),
    organizationOwnerIdx: index("document_organization_owner_idx").on(t.organizationId, t.ownerType, t.ownerId),
    ownerIdx: index("doc_owner_idx").on(t.ownerType, t.ownerId),
    expiryIdx: index("doc_expiry_idx").on(t.expiryDate),
    ownerExpiryIdx: index("doc_owner_expiry_idx").on(t.ownerType, t.ownerId, t.expiryDate),
  })
);

// ============ AUDIT LOGS ============
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
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
    previousHash: varchar("previous_hash", { length: 64 }),
    eventHash: varchar("event_hash", { length: 64 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    organizationIdx: index("audit_organization_idx").on(t.organizationId),
    organizationCreatedIdx: index("audit_organization_created_idx").on(t.organizationId, t.createdAt.desc()),
    entityIdx: index("audit_entity_idx").on(t.entityType, t.entityId),
    userIdx: index("audit_user_idx").on(t.userId),
    createdIdx: index("audit_created_idx").on(t.createdAt),
    entityCreatedIdx: index("audit_entity_created_idx").on(t.entityType, t.entityId, t.createdAt.desc()),
    userCreatedIdx: index("audit_user_created_idx").on(t.userId, t.createdAt.desc()),
    hashIdx: index("audit_event_hash_idx").on(t.eventHash),
  })
);

// ============ NOTIFICATIONS ============
export const notifications = pgTable(
  "notifications",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
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
    organizationIdx: index("notification_organization_idx").on(t.organizationId),
    organizationCreatedIdx: index("notification_organization_created_idx").on(t.organizationId, t.createdAt.desc()),
    userIdx: index("notif_user_idx").on(t.userId),
    typeIdx: index("notif_type_idx").on(t.type),
    dueIdx: index("notif_due_idx").on(t.dueDate),
    userUnreadCreatedIdx: index("notification_user_unread_created_idx")
      .on(t.userId, t.createdAt.desc())
      .where(sql`${t.readAt} is null`),
  })
);

// ============ PLATFORM CHANGE NOTICES ============
// Null organizationId means an explicitly platform-wide notice. Other notices
// are scoped to one subscriber organization and never exposed cross-tenant.
export const platformChangeNotices = pgTable(
  "platform_change_notices",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .references(() => organizations.id, { onDelete: "restrict" }),
    createdBy: varchar("created_by", { length: 36 }).notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    title: varchar("title", { length: 160 }).notNull(),
    summary: text("summary").notNull(),
    impact: text("impact").notNull(),
    actionRequired: text("action_required").notNull(),
    actionUrl: varchar("action_url", { length: 300 }),
    severity: varchar("severity", { length: 16 }).notNull().default("info"),
    status: varchar("status", { length: 16 }).notNull().default("draft"),
    publishAt: timestamp("publish_at").notNull(),
    effectiveAt: timestamp("effective_at").notNull(),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    audienceIdx: index("platform_change_notice_audience_idx").on(t.organizationId, t.status, t.publishAt),
    effectiveIdx: index("platform_change_notice_effective_idx").on(t.effectiveAt),
  }),
);

export const platformChangeNoticeReceipts = pgTable(
  "platform_change_notice_receipts",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    noticeId: varchar("notice_id", { length: 36 }).notNull()
      .references(() => platformChangeNotices.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 36 }).notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: varchar("organization_id", { length: 36 }).notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    acknowledgedAt: timestamp("acknowledged_at").notNull().defaultNow(),
  },
  (t) => ({
    uniqueReceipt: uniqueIndex("platform_change_notice_user_uidx").on(t.noticeId, t.userId),
    userIdx: index("platform_change_notice_receipt_user_idx").on(t.organizationId, t.userId),
  }),
);

// ============ IMPORT JOBS ============
export const importJobs = pgTable(
  "import_jobs",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
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
    organizationIdx: index("import_organization_idx").on(t.organizationId),
    organizationCreatedIdx: index("import_organization_created_idx").on(t.organizationId, t.createdAt.desc()),
    statusIdx: index("import_status_idx").on(t.status),
    createdIdx: index("import_created_idx").on(t.createdAt),
  })
);

// ============ API KEYS ============
export const apiKeys = pgTable(
  "api_keys",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
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
    organizationIdx: index("api_key_organization_idx").on(t.organizationId),
    userHashIdx: index("api_key_user_idx").on(t.userId),
  })
);

// ============ SIGNATURES ============
export const signatures = pgTable(
  "signatures",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
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
    organizationIdx: index("signature_organization_idx").on(t.organizationId),
    inspIdx: index("sig_inspection_idx").on(t.inspectionId),
  })
);

// ============ SECURITY ============
export const rateLimitBuckets = pgTable(
  "rate_limit_buckets",
  {
    bucketKey: varchar("bucket_key", { length: 512 }).primaryKey(),
    count: integer("count").notNull().default(0),
    resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    resetIdx: index("rate_limit_reset_idx").on(t.resetAt),
  }),
);

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
    activeIdx: index("session_active_idx").on(t.isActive),
    userActiveExpiryIdx: index("session_user_active_expiry_idx").on(t.userId, t.isActive, t.expiresAt),
    userActiveActivityIdx: index("session_user_active_activity_idx")
      .on(t.userId, t.lastActivityAt.desc())
      .where(sql`${t.isActive} = true`),
  })
);

// Super Admin support sessions remain distinct from the target user's login.
export const supportSessions = pgTable("support_sessions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  actorUserId: varchar("actor_user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "restrict" }),
  actorSessionId: varchar("actor_session_id", { length: 36 }).notNull().references(() => sessions.id, { onDelete: "cascade" }),
  targetUserId: varchar("target_user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "restrict" }),
  organizationId: varchar("organization_id", { length: 36 }).notNull().references(() => organizations.id, { onDelete: "restrict" }),
  reason: varchar("reason", { length: 500 }).notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  endedAt: timestamp("ended_at"),
}, (t) => ({
  tokenIdx: uniqueIndex("support_session_token_idx").on(t.tokenHash),
  actorIdx: index("support_session_actor_idx").on(t.actorUserId, t.createdAt.desc()),
  targetIdx: index("support_session_target_idx").on(t.organizationId, t.targetUserId, t.createdAt.desc()),
  expiryIdx: index("support_session_expiry_idx").on(t.expiresAt),
}));

export const securityEvents = pgTable(
  "security_events",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
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
    organizationIdx: index("security_event_organization_idx").on(t.organizationId),
    organizationCreatedIdx: index("security_event_organization_created_idx").on(t.organizationId, t.createdAt.desc()),
    userEventIdx: index("security_event_user_idx").on(t.userId),
    eventTypeIdx: index("security_event_type_idx").on(t.eventType),
    severityIdx: index("security_event_severity_idx").on(t.severity),
    createdIdx: index("security_event_created_idx").on(t.createdAt),
    severityCreatedIdx: index("security_event_severity_created_idx").on(t.severity, t.createdAt.desc()),
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
    emailCreatedIdx: index("login_attempt_email_created_idx").on(t.email, t.createdAt.desc()),
    ipCreatedIdx: index("login_attempt_ip_created_idx").on(t.ipAddress, t.createdAt.desc()),
    emailFailedCreatedIdx: index("login_attempt_email_failed_created_idx")
      .on(t.email, t.createdAt.desc())
      .where(sql`${t.success} = false`),
    ipFailedCreatedIdx: index("login_attempt_ip_failed_created_idx")
      .on(t.ipAddress, t.createdAt.desc())
      .where(sql`${t.success} = false`),
  })
);

// ============ RELATIONS ============
export const locationRelations = relations(locations, ({ many }) => ({
  users: many(users),
  inspections: many(inspections),
}));

export const userRelations = relations(users, ({ one }) => ({
  location: one(locations, { fields: [users.locationId], references: [locations.id] }),
  transporter: one(transporters, { fields: [users.transporterId], references: [transporters.id] }),
}));

export const transporterRelations = relations(transporters, ({ many }) => ({
  vehicles: many(vehicles),
  users: many(users),
}));

export const vehicleRelations = relations(vehicles, ({ one, many }) => ({
  transporter: one(transporters, {
    fields: [vehicles.transporterId],
    references: [transporters.id],
  }),
  inspections: many(inspections),
}));

export const inspectionAppointmentRelations = relations(inspectionAppointments, ({ one }) => ({
  vehicle: one(vehicles, { fields: [inspectionAppointments.vehicleId], references: [vehicles.id] }),
  location: one(locations, { fields: [inspectionAppointments.locationId], references: [locations.id] }),
  assignedInspector: one(users, { fields: [inspectionAppointments.assignedInspectorId], references: [users.id] }),
  linkedInspection: one(inspections, { fields: [inspectionAppointments.linkedInspectionId], references: [inspections.id] }),
  bookedByUser: one(users, { fields: [inspectionAppointments.bookedBy], references: [users.id] }),
}));

export const inspectionRelations = relations(inspections, ({ one }) => ({
  vehicle: one(vehicles, { fields: [inspections.vehicleId], references: [vehicles.id] }),
  inspector: one(users, { fields: [inspections.inspectorId], references: [users.id] }),
  supervisor: one(users, { fields: [inspections.supervisorId], references: [users.id] }),
  location: one(locations, { fields: [inspections.locationId], references: [locations.id] }),
}));
