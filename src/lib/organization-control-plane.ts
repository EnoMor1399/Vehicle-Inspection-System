import { createHash, randomBytes } from "crypto";
import { and, count, desc, eq, gt, gte, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import {
  organizationInvitations,
  organizationOnboardingRequests,
  organizations,
  organizationSubscriptions,
  subscriptionPlans,
  systemSettings,
  inspections,
  locations,
  sessions,
  users,
  vehicles,
} from "@/db/schema";
import { newId } from "@/lib/utils";
import { hashPassword, validateEmail, validatePasswordStrength } from "@/lib/password";
import { periodAllowsAccess } from "@/lib/organization-access";

export const SUBSCRIBER_ADMIN_ROLES = [
  "vehicle_inspection_admin",
  "driver_training_admin",
] as const;

export type SubscriberAdminRole = (typeof SUBSCRIBER_ADMIN_ROLES)[number];

const TENANT_DATA_PLANE_TABLES = [
  "daily_inspections",
  "webhooks",
  "locations",
  "transporters",
  "vehicles",
  "rfid_tags",
  "inspections",
  "inspection_appointments",
  "documents",
  "audit_logs",
  "notifications",
  "import_jobs",
  "api_keys",
  "signatures",
  "security_events",
  "training_sessions",
  "training_participants",
  "training_assessments",
  "training_certificates",
  "training_compliance_cases",
  "training_compliance_events",
  "training_requests",
  "training_request_events",
  "training_quotations",
  "training_quotation_items",
  "training_communication_preferences",
  "training_outbound_messages",
  "training_communication_events",
  "training_curricula",
  "training_curriculum_versions",
  "training_session_curricula",
  "training_matrix_requirements",
  "training_development_plans",
  "training_development_actions",
  "training_attendance_signoffs",
  "training_evidence_records",
  "training_resources",
  "training_resource_allocations",
  "training_session_feedback",
  "training_quality_findings",
  "training_quality_events",
  "training_instructor_profiles",
  "training_session_readiness",
  "training_risk_assessments",
  "training_safety_hazards",
  "training_safety_incidents",
  "training_regulatory_requirements",
  "training_accreditation_records",
  "training_session_compliance_reviews",
] as const;

const REQUIRED_TENANT_GUARDS = [
  "users_tenant_reference_guard",
  "vehicle_tenant_reference_guard",
  "rfid_tenant_reference_guard",
  "inspection_tenant_reference_guard",
  "appointment_tenant_reference_guard",
  "daily_inspection_tenant_reference_guard",
  "document_tenant_reference_guard",
  "training_sessions_tenant_reference_guard",
  "training_participants_tenant_reference_guard",
  "training_assessments_tenant_reference_guard",
  "training_certificates_tenant_reference_guard",
  "training_requests_tenant_reference_guard",
  "training_quotations_tenant_reference_guard",
  "training_curricula_tenant_reference_guard",
  "training_instructor_profiles_tenant_reference_guard",
  "training_risk_assessments_tenant_reference_guard",
  "training_safety_incidents_tenant_reference_guard",
] as const;


function invitationHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "organization";
}

async function uniqueOrganizationSlug(name: string) {
  const base = normalizeSlug(name);
  const [existing] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, base))
    .limit(1);
  if (!existing) return base;
  return `${base}-${randomBytes(3).toString("hex")}`;
}

export async function listSubscriptionPlans() {
  return db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.isActive, true))
    .orderBy(subscriptionPlans.sortOrder, subscriptionPlans.name);
}

export async function listPlatformOrganizations() {
  return db
    .select()
    .from(organizations)
    .orderBy(desc(organizations.createdAt));
}

export async function listOnboardingRequests(limit = 100) {
  const safeLimit = Math.max(1, Math.min(200, Math.floor(limit)));
  return db
    .select()
    .from(organizationOnboardingRequests)
    .orderBy(desc(organizationOnboardingRequests.createdAt))
    .limit(safeLimit);
}

export async function getLatestOrganizationSubscription(organizationId: string) {
  const [row] = await db
    .select({
      subscription: organizationSubscriptions,
      plan: subscriptionPlans,
    })
    .from(organizationSubscriptions)
    .innerJoin(subscriptionPlans, eq(subscriptionPlans.id, organizationSubscriptions.planId))
    .where(eq(organizationSubscriptions.organizationId, organizationId))
    .orderBy(desc(organizationSubscriptions.createdAt))
    .limit(1);
  return row || null;
}

export async function getOrganizationAccountSnapshot(organizationId: string) {
  const [[organization], subscription, [userCountRow], pendingInvitations] = await Promise.all([
    db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1),
    getLatestOrganizationSubscription(organizationId),
    db
      .select({ n: count() })
      .from(users)
      .where(and(eq(users.organizationId, organizationId), eq(users.isActive, true))),
    db
      .select({ id: organizationInvitations.id })
      .from(organizationInvitations)
      .where(
        and(
          eq(organizationInvitations.organizationId, organizationId),
          isNull(organizationInvitations.acceptedAt),
          isNull(organizationInvitations.revokedAt),
          gt(organizationInvitations.expiresAt, new Date()),
        ),
      ),
  ]);

  return {
    organization: organization || null,
    subscription,
    userCount: Number(userCountRow?.n || 0),
    pendingInvitationCount: pendingInvitations.length,
  };
}

export async function createOnboardingRequest(input: {
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  country?: string;
  industry?: string;
  estimatedUsers?: number | null;
  estimatedVehicles?: number | null;
  desiredPlanCode?: string;
  requestedModules?: string[];
  notes?: string;
  sourceIpHash?: string | null;
}) {
  const companyName = input.companyName.trim().slice(0, 255);
  const contactName = input.contactName.trim().slice(0, 200);
  const contactEmail = input.contactEmail.trim().toLowerCase().slice(0, 200);
  if (companyName.length < 2) throw new Error("Enter a valid company name");
  if (contactName.length < 2) throw new Error("Enter a valid contact name");
  if (!validateEmail(contactEmail)) throw new Error("Enter a valid contact email");

  const id = newId();
  await db.insert(organizationOnboardingRequests).values({
    id,
    companyName,
    contactName,
    contactEmail,
    contactPhone: input.contactPhone?.trim().slice(0, 50) || null,
    country: input.country?.trim().slice(0, 100) || "Ghana",
    industry: input.industry?.trim().slice(0, 120) || null,
    estimatedUsers: input.estimatedUsers || null,
    estimatedVehicles: input.estimatedVehicles || null,
    desiredPlanCode: input.desiredPlanCode?.trim().slice(0, 50) || null,
    requestedModules: input.requestedModules?.length ? input.requestedModules.slice(0, 10) : ["vehicle_inspection"],
    notes: input.notes?.trim().slice(0, 4000) || null,
    sourceIpHash: input.sourceIpHash || null,
    status: "pending",
  });
  return id;
}

export async function convertOnboardingRequest(input: {
  requestId: string;
  actorUserId: string;
  planCode?: string;
}) {
  const [request] = await db
    .select()
    .from(organizationOnboardingRequests)
    .where(eq(organizationOnboardingRequests.id, input.requestId))
    .limit(1);
  if (!request) throw new Error("Onboarding request not found");
  if (request.status === "converted") throw new Error("This request has already been converted");

  const planCode = (input.planCode || request.desiredPlanCode || "starter").trim();
  const [plan] = await db
    .select()
    .from(subscriptionPlans)
    .where(and(eq(subscriptionPlans.code, planCode), eq(subscriptionPlans.isActive, true)))
    .limit(1);
  if (!plan) throw new Error("Selected subscription plan is unavailable");

  const isolation = await verifyTenantDataPlaneReadiness();
  if (!isolation.ready) {
    throw new Error(
      `Subscriber onboarding is paused until tenant isolation is verified ` +
      `(${isolation.tenantColumns}/${isolation.expectedTenantColumns} tables, ` +
      `${isolation.requiredGuards}/${isolation.expectedRequiredGuards} database guards). ` +
      "A platform administrator must complete the database tenant cutover.",
    );
  }

  const organizationId = newId();
  const subscriptionId = newId();
  const invitationId = newId();
  const invitationToken = randomBytes(32).toString("base64url");
  const slug = await uniqueOrganizationSlug(request.companyName);
  const now = new Date();
  const trialEndsAt = plan.trialDays > 0
    ? new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000)
    : null;

  await db.transaction(async (tx) => {
    // Serialize concurrent approvals of this request. Reading status before the
    // lock is insufficient: two platform administrators may approve at once.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.requestId}))`);
    const [currentRequest] = await tx
      .select({ status: organizationOnboardingRequests.status })
      .from(organizationOnboardingRequests)
      .where(eq(organizationOnboardingRequests.id, input.requestId))
      .limit(1);
    if (!currentRequest || !["pending", "reviewing", "approved"].includes(currentRequest.status)) {
      throw new Error("This onboarding request has already been processed or rejected");
    }

    await tx.insert(organizations).values({
      id: organizationId,
      name: request.companyName,
      slug,
      legalName: request.companyName,
      country: request.country,
      industry: request.industry,
      email: request.contactEmail,
      phone: request.contactPhone,
      enabledModules: plan.modules,
      status: "provisioning",
      onboardingStage: "administrator_invited",
      operationalAccessEnabled: false,
      createdBy: input.actorUserId,
    });

    await tx.insert(systemSettings).values({
      id: organizationId,
      organizationId,
      companyName: request.companyName,
      companyShortName: request.companyName.slice(0, 50),
      tagline: "Vehicle Inspection Management System",
      country: request.country,
      phone: request.contactPhone,
      email: request.contactEmail,
      footerText: `© ${now.getFullYear()} ${request.companyName}. All rights reserved.`,
      updatedBy: input.actorUserId,
    });

    await tx.insert(organizationSubscriptions).values({
      id: subscriptionId,
      organizationId,
      planId: plan.id,
      status: trialEndsAt ? "trialing" : "active",
      provider: "manual",
      amount: plan.price,
      currency: plan.currency,
      currentPeriodStart: now,
      trialEndsAt,
      seats: Math.max(1, Math.min(plan.maxUsers, request.estimatedUsers || 1)),
      createdBy: input.actorUserId,
      notes: "Created from subscriber onboarding request",
    });

    await tx.insert(organizationInvitations).values({
      id: invitationId,
      organizationId,
      email: request.contactEmail,
      name: request.contactName,
      role: "organization_owner",
      tokenHash: invitationHash(invitationToken),
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      createdBy: input.actorUserId,
    });

    await tx
      .update(organizationOnboardingRequests)
      .set({
        status: "converted",
        reviewedBy: input.actorUserId,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(eq(organizationOnboardingRequests.id, request.id));
  });

  return {
    organizationId,
    organizationSlug: slug,
    organizationName: request.companyName,
    invitationEmail: request.contactEmail,
    invitationName: request.contactName,
    invitationToken,
    invitationId,
  };
}

export async function createOrganizationAdministratorInvitation(input: {
  organizationId: string;
  actorUserId: string;
  email: string;
  name?: string;
  role: SubscriberAdminRole;
}) {
  const normalizedEmail = input.email.trim().toLowerCase();
  if (!validateEmail(normalizedEmail)) throw new Error("Enter a valid email address");
  if (!SUBSCRIBER_ADMIN_ROLES.includes(input.role)) throw new Error("Invalid administrator role");

  const token = randomBytes(32).toString("base64url");

  await db.transaction(async (tx) => {
    // Reserve invitation capacity atomically, rather than checking seats and
    // inserting invitations in separate requests. All invitations for a given
    // organization use this lock; acceptance uses the same lock.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.organizationId}))`);
    const [organization] = await tx
      .select({ status: organizations.status })
      .from(organizations)
      .where(eq(organizations.id, input.organizationId))
      .limit(1);
    if (!organization || organization.status === "suspended" || organization.status === "cancelled") {
      throw new Error("Organization is not accepting administrator invitations");
    }

    const [entitlement] = await tx
      .select({ subscription: organizationSubscriptions, plan: subscriptionPlans })
      .from(organizationSubscriptions)
      .innerJoin(subscriptionPlans, eq(subscriptionPlans.id, organizationSubscriptions.planId))
      .where(eq(organizationSubscriptions.organizationId, input.organizationId))
      .orderBy(desc(organizationSubscriptions.createdAt))
      .limit(1);
    if (!entitlement || !["trialing", "active", "grace"].includes(entitlement.subscription.status) || !periodAllowsAccess(entitlement.subscription)) {
      throw new Error("An eligible organization subscription is required");
    }

    const requiredModule = input.role === "driver_training_admin" ? "driver_training" : "vehicle_inspection";
    if (!entitlement.plan.modules.includes(requiredModule)) {
      throw new Error("The current subscription plan does not include this administration domain");
    }

    const [[existingUsers], [outstanding], [existingUser], [sameEmailInvitation]] = await Promise.all([
      tx.select({ n: count() }).from(users).where(and(
        eq(users.organizationId, input.organizationId),
        eq(users.isActive, true),
      )),
      tx.select({ n: count() }).from(organizationInvitations).where(and(
        eq(organizationInvitations.organizationId, input.organizationId),
        isNull(organizationInvitations.acceptedAt),
        isNull(organizationInvitations.revokedAt),
        gt(organizationInvitations.expiresAt, new Date()),
      )),
      tx.select({ id: users.id }).from(users).where(eq(users.email, normalizedEmail)).limit(1),
      tx.select({ id: organizationInvitations.id }).from(organizationInvitations).where(and(
        eq(organizationInvitations.organizationId, input.organizationId),
        eq(organizationInvitations.email, normalizedEmail),
        isNull(organizationInvitations.acceptedAt),
        isNull(organizationInvitations.revokedAt),
        gt(organizationInvitations.expiresAt, new Date()),
      )).limit(1),
    ]);

    if (existingUser) throw new Error("An account with this email already exists");
    if (sameEmailInvitation) throw new Error("An active invitation already exists for this email");
    if (Number(existingUsers?.n || 0) + Number(outstanding?.n || 0) >= entitlement.plan.maxUsers) {
      throw new Error("The subscription user limit has been reached");
    }

    await tx.insert(organizationInvitations).values({
      id: newId(),
      organizationId: input.organizationId,
      email: normalizedEmail,
      name: input.name?.trim().slice(0, 200) || null,
      role: input.role,
      tokenHash: invitationHash(token),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdBy: input.actorUserId,
    });
  });

  return token;
}

export async function getInvitationByToken(token: string) {
  const hash = invitationHash(token);
  const [row] = await db
    .select({
      invitation: organizationInvitations,
      organization: organizations,
      expired: sql<boolean>`${organizationInvitations.expiresAt} < now()`,
    })
    .from(organizationInvitations)
    .innerJoin(organizations, eq(organizations.id, organizationInvitations.organizationId))
    .where(eq(organizationInvitations.tokenHash, hash))
    .limit(1);
  return row || null;
}

export async function acceptOrganizationInvitation(input: {
  token: string;
  name: string;
  password: string;
  confirmPassword: string;
}) {
  const row = await getInvitationByToken(input.token);
  if (!row) throw new Error("Invitation is invalid");

  const name = input.name.trim().slice(0, 200);
  if (name.length < 2) throw new Error("Enter your full name");
  if (input.password !== input.confirmPassword) throw new Error("Passwords do not match");
  const passwordStrength = validatePasswordStrength(input.password);
  if (!passwordStrength.valid) throw new Error(passwordStrength.errors[0]);

  const passwordHash = await hashPassword(input.password);
  const userId = newId();

  return db.transaction(async (tx) => {
    // Re-check the invitation *inside* the transaction after serializing
    // competing claims for the organization. The initial page read alone
    // cannot prevent double acceptance or post-invitation plan changes.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${row.invitation.organizationId}))`);
    const [fresh] = await tx
      .select({
        invitation: organizationInvitations,
        organization: organizations,
        expired: sql<boolean>`${organizationInvitations.expiresAt} <= now()`,
      })
      .from(organizationInvitations)
      .innerJoin(organizations, eq(organizations.id, organizationInvitations.organizationId))
      .where(eq(organizationInvitations.tokenHash, invitationHash(input.token)))
      .limit(1);

    if (!fresh) throw new Error("Invitation is invalid");
    const { invitation, organization } = fresh;
    if (invitation.acceptedAt) throw new Error("Invitation has already been accepted");
    if (invitation.revokedAt) throw new Error("Invitation has been revoked");
    if (fresh.expired) throw new Error("Invitation has expired");
    if (organization.status === "cancelled" || organization.status === "suspended") {
      throw new Error("This organization cannot accept invitations at the moment");
    }

    if (!["organization_owner", ...SUBSCRIBER_ADMIN_ROLES].includes(invitation.role)) {
      throw new Error("This invitation does not contain an eligible subscriber role");
    }

    const [entitlement] = await tx
      .select({ subscription: organizationSubscriptions, plan: subscriptionPlans })
      .from(organizationSubscriptions)
      .innerJoin(subscriptionPlans, eq(subscriptionPlans.id, organizationSubscriptions.planId))
      .where(eq(organizationSubscriptions.organizationId, organization.id))
      .orderBy(desc(organizationSubscriptions.createdAt))
      .limit(1);

    if (!entitlement || !["trialing", "active", "grace"].includes(entitlement.subscription.status) || !periodAllowsAccess(entitlement.subscription)) {
      throw new Error("This organization does not have an eligible subscription");
    }
    if (invitation.role === "driver_training_admin" && !entitlement.plan.modules.includes("driver_training")) {
      throw new Error("Driver Training is no longer included in this subscription");
    }
    if (invitation.role === "vehicle_inspection_admin" && !entitlement.plan.modules.includes("vehicle_inspection")) {
      throw new Error("Vehicle Inspection is no longer included in this subscription");
    }

    const [existing] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, invitation.email))
      .limit(1);
    if (existing) throw new Error("An account with this email already exists");

    // Claim the invitation conditionally before creating an account. A losing
    // concurrent request fails and any failed account insert rolls back the claim.
    const [claimed] = await tx
      .update(organizationInvitations)
      .set({ acceptedAt: new Date() })
      .where(and(
        eq(organizationInvitations.id, invitation.id),
        isNull(organizationInvitations.acceptedAt),
        isNull(organizationInvitations.revokedAt),
        gt(organizationInvitations.expiresAt, new Date()),
      ))
      .returning({ id: organizationInvitations.id });
    if (!claimed) throw new Error("Invitation is no longer available");

    const permissions =
      invitation.role === "organization_owner"
        ? { vehicle_inspection: false, training: false }
        : invitation.role === "driver_training_admin"
          ? { vehicle_inspection: false, training: true }
          : { vehicle_inspection: true, training: false };

    await tx.insert(users).values({
      id: userId,
      organizationId: invitation.organizationId,
      name,
      email: invitation.email,
      role: invitation.role,
      passwordHash,
      permissions,
      isActive: true,
    });

    if (invitation.role === "organization_owner") {
      await tx.update(organizations).set({
        onboardingStage: "owner_active",
        updatedAt: new Date(),
      }).where(eq(organizations.id, organization.id));
    }

    return { userId, organizationId: invitation.organizationId, role: invitation.role };
  });
}

export async function listOrganizationInvitations(organizationId: string) {
  return db
    .select({
      invitation: organizationInvitations,
      expired: sql<boolean>`${organizationInvitations.expiresAt} < now()`,
    })
    .from(organizationInvitations)
    .where(eq(organizationInvitations.organizationId, organizationId))
    .orderBy(desc(organizationInvitations.createdAt));
}

export async function updateOrganizationProfile(input: {
  organizationId: string;
  name: string;
  legalName?: string;
  registrationNumber?: string;
  taxId?: string;
  industry?: string;
  country?: string;
  region?: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  themeColor?: string;
  accentColor?: string;
}) {
  const name = input.name.trim().slice(0, 255);
  if (name.length < 2) throw new Error("Enter a valid organization name");

  const [updated] = await db
    .update(organizations)
    .set({
      name,
      legalName: input.legalName?.trim().slice(0, 255) || null,
      registrationNumber: input.registrationNumber?.trim().slice(0, 100) || null,
      taxId: input.taxId?.trim().slice(0, 100) || null,
      industry: input.industry?.trim().slice(0, 120) || null,
      country: input.country?.trim().slice(0, 100) || "Ghana",
      region: input.region?.trim().slice(0, 100) || null,
      city: input.city?.trim().slice(0, 100) || null,
      address: input.address?.trim().slice(0, 1000) || null,
      phone: input.phone?.trim().slice(0, 50) || null,
      email: input.email?.trim().toLowerCase().slice(0, 200) || null,
      website: input.website?.trim().slice(0, 200) || null,
      themeColor: input.themeColor?.trim().slice(0, 20) || "#039703",
      accentColor: input.accentColor?.trim().slice(0, 20) || "#026b02",
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, input.organizationId))
    .returning();
  if (!updated) throw new Error("Organization not found");
  return updated;
}

export async function verifyTenantDataPlaneReadiness() {
  const result = await pool.query<{
    tenant_columns: number;
    required_guards: number;
  }>(
    `SELECT
       (
         SELECT count(*)::int
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND column_name = 'organization_id'
            AND is_nullable = 'NO'
            AND column_default IS NULL
            AND table_name = ANY($1::text[])
       ) AS tenant_columns,
       (
         SELECT count(DISTINCT tgname)::int
           FROM pg_trigger
          WHERE NOT tgisinternal
            AND tgenabled IN ('O', 'A')
            AND tgname = ANY($2::text[])
       ) AS required_guards`,
    [[...TENANT_DATA_PLANE_TABLES], [...REQUIRED_TENANT_GUARDS]],
  );

  const row = result.rows[0] || { tenant_columns: 0, required_guards: 0 };
  return {
    ready:
      Number(row.tenant_columns) === TENANT_DATA_PLANE_TABLES.length
      && Number(row.required_guards) === REQUIRED_TENANT_GUARDS.length,
    tenantColumns: Number(row.tenant_columns),
    expectedTenantColumns: TENANT_DATA_PLANE_TABLES.length,
    requiredGuards: Number(row.required_guards),
    expectedRequiredGuards: REQUIRED_TENANT_GUARDS.length,
  };
}

/**
 * Explain workspace blockers before a Super Administrator attempts activation.
 * A subscription being "active" is not itself a ready subscriber workspace.
 * Never return invitation token hashes in page props.
 */
export async function getOrganizationActivationReadiness(organizationId: string) {
  const [[organization], subscription, accountRows, [ownerInvite], isolation] = await Promise.all([
    db.select({
      id: organizations.id,
      status: organizations.status,
      operationalAccessEnabled: organizations.operationalAccessEnabled,
    }).from(organizations).where(eq(organizations.id, organizationId)).limit(1),
    getLatestOrganizationSubscription(organizationId),
    db.select({ role: users.role, active: users.isActive, n: count() })
      .from(users).where(and(
        eq(users.organizationId, organizationId),
        inArray(users.role, ["organization_owner", "vehicle_inspection_admin", "driver_training_admin"]),
      )).groupBy(users.role, users.isActive),
    db.select({
      email: organizationInvitations.email,
      acceptedAt: organizationInvitations.acceptedAt,
      revokedAt: organizationInvitations.revokedAt,
      expiresAt: organizationInvitations.expiresAt,
    }).from(organizationInvitations).where(and(
      eq(organizationInvitations.organizationId, organizationId),
      eq(organizationInvitations.role, "organization_owner"),
    )).orderBy(desc(organizationInvitations.createdAt)).limit(1),
    verifyTenantDataPlaneReadiness(),
  ]);

  const activeCount = (role: typeof users.$inferSelect.role) =>
    accountRows.filter((row) => row.role === role && row.active)
      .reduce((n, row) => n + Number(row.n || 0), 0);
  const ownerReady = activeCount("organization_owner") > 0;
  const inspectionRequired = Boolean(subscription?.plan.modules.includes("vehicle_inspection"));
  const trainingRequired = Boolean(subscription?.plan.modules.includes("driver_training"));
  const inspectionReady = !inspectionRequired || activeCount("vehicle_inspection_admin") > 0;
  const trainingReady = !trainingRequired || activeCount("driver_training_admin") > 0;
  const subscriptionReady = Boolean(subscription
    && ["active", "trialing", "grace"].includes(subscription.subscription.status)
    && periodAllowsAccess(subscription.subscription));
  const organizationReady = Boolean(organization
    && !["suspended", "cancelled"].includes(organization.status));

  const [existingInvitationAccount] = ownerInvite
    ? await db.select({ id: users.id }).from(users).where(eq(users.email, ownerInvite.email)).limit(1)
    : [];
  const ownerInvitationEmailInUse = Boolean(existingInvitationAccount);

  const invitationStatus = !ownerInvite ? "missing"
    : ownerInvite.acceptedAt ? "accepted"
    : ownerInvite.revokedAt ? "revoked"
    : ownerInvite.expiresAt <= new Date() ? "expired"
    : "pending";

  return {
    ownerReady,
    inspectionRequired,
    inspectionReady,
    trainingRequired,
    trainingReady,
    subscriptionReady,
    organizationReady,
    canAttemptActivation: Boolean(
      ownerReady && inspectionReady && trainingReady && subscriptionReady && organizationReady
      && isolation.ready
    ),
    isolation,
    ownerInvitationStatus: invitationStatus,
    ownerInvitationEmailInUse,
    ownerInvitationEmail: ownerInvite?.email ?? null,
  };
}

/**
 * Replace a lost or expired one-time Organization Owner invitation.
 * This only reissues to the address already approved on the onboarding request.
 * It never activates a user, changes roles, or bypasses workspace verification.
 */
export async function reissueOrganizationOwnerInvitation(input: {
  organizationId: string;
  actorUserId: string;
  email?: string;
  name?: string;
}) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = invitationHash(token);
  const selectedRecipient = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.organizationId}))`);
    const [organization] = await tx.select({ status: organizations.status, name: organizations.name })
      .from(organizations).where(eq(organizations.id, input.organizationId)).limit(1);
    if (!organization || ["suspended", "cancelled"].includes(organization.status)) {
      throw new Error("This organization cannot accept an owner invitation");
    }
    const [activeOwner] = await tx.select({ id: users.id })
      .from(users).where(and(
        eq(users.organizationId, input.organizationId),
        eq(users.role, "organization_owner"),
        eq(users.isActive, true),
      )).limit(1);
    if (activeOwner) throw new Error("An active Organization Owner already exists");

    const [priorInvite] = await tx.select({
      email: organizationInvitations.email,
      name: organizationInvitations.name,
    }).from(organizationInvitations).where(and(
      eq(organizationInvitations.organizationId, input.organizationId),
      eq(organizationInvitations.role, "organization_owner"),
    )).orderBy(desc(organizationInvitations.createdAt)).limit(1);
    if (!priorInvite) throw new Error("No original owner invitation is recorded. Review subscriber onboarding before creating ownership.");
    const email = input.email?.trim().toLowerCase() || priorInvite.email;
    if (!validateEmail(email) || email.length > 200) throw new Error("Enter a valid Organization Owner email address");
    const name = input.name?.trim().slice(0, 200) || priorInvite.name;
    const [existingUser] = await tx.select({ id: users.id })
      .from(users).where(eq(users.email, email)).limit(1);
    if (existingUser) {
      throw new Error("This email is already registered in VIMS. Enter a different email for the Organization Owner.");
    }

    const [subscription] = await tx.select({
      row: organizationSubscriptions,
      plan: subscriptionPlans,
    }).from(organizationSubscriptions)
      .innerJoin(subscriptionPlans, eq(subscriptionPlans.id, organizationSubscriptions.planId))
      .where(eq(organizationSubscriptions.organizationId, input.organizationId))
      .orderBy(desc(organizationSubscriptions.createdAt)).limit(1);
    if (!subscription || !["trialing", "active", "grace"].includes(subscription.row.status)
      || !periodAllowsAccess(subscription.row)) {
      throw new Error("An eligible subscription is required before reissuing an owner invitation");
    }

    const [activeUsers] = await tx.select({ n: count() }).from(users)
      .where(and(eq(users.organizationId, input.organizationId), eq(users.isActive, true)));
    const [pendingNonOwner] = await tx.select({ n: count() }).from(organizationInvitations)
      .where(and(
        eq(organizationInvitations.organizationId, input.organizationId),
        ne(organizationInvitations.role, "organization_owner"),
        isNull(organizationInvitations.acceptedAt),
        isNull(organizationInvitations.revokedAt),
        gt(organizationInvitations.expiresAt, new Date()),
      ));
    const capacity = Math.min(subscription.plan.maxUsers, subscription.row.seats);
    if (Number(activeUsers?.n || 0) + Number(pendingNonOwner?.n || 0) + 1 > capacity) {
      throw new Error("No subscriber seat is available for the Organization Owner");
    }

    await tx.update(organizationInvitations).set({ revokedAt: new Date() })
      .where(and(
        eq(organizationInvitations.organizationId, input.organizationId),
        eq(organizationInvitations.role, "organization_owner"),
        isNull(organizationInvitations.acceptedAt),
        isNull(organizationInvitations.revokedAt),
      ));
    await tx.insert(organizationInvitations).values({
      id: newId(),
      organizationId: input.organizationId,
      email,
      name,
      role: "organization_owner",
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdBy: input.actorUserId,
    });
    return { recipientEmail: email, recipientName: name, organizationName: organization.name };
  });
  return { invitationPath: `/invite/${token}`, ...selectedRecipient };
}

export async function activateOrganizationWorkspace(input: {
  organizationId: string;
  actorUserId: string;
}) {
  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, input.organizationId))
    .limit(1);
  if (!organization) throw new Error("Organization not found");
  if (organization.status === "cancelled" || organization.status === "suspended") {
    throw new Error("Suspended or cancelled organizations cannot be activated");
  }

  const subscription = await getLatestOrganizationSubscription(input.organizationId);
  if (!subscription) throw new Error("Assign a subscription before activating the workspace");
  if (!["trialing", "active", "grace"].includes(subscription.subscription.status)) {
    throw new Error("The organization subscription is not usable");
  }

  const now = new Date();
  if (
    subscription.subscription.status === "trialing"
    && subscription.subscription.trialEndsAt
    && new Date(subscription.subscription.trialEndsAt).getTime() < now.getTime()
  ) {
    throw new Error("The organization trial has expired");
  }
  if (
    subscription.subscription.status === "grace"
    && subscription.subscription.graceEndsAt
    && new Date(subscription.subscription.graceEndsAt).getTime() < now.getTime()
  ) {
    throw new Error("The organization grace period has expired");
  }
  if (
    subscription.subscription.status === "active"
    && subscription.subscription.currentPeriodEnd
    && new Date(subscription.subscription.currentPeriodEnd).getTime() < now.getTime()
  ) {
    throw new Error("The organization subscription period has ended");
  }

  const accountRows = await db
    .select({ role: users.role, n: count() })
    .from(users)
    .where(and(
      eq(users.organizationId, input.organizationId),
      eq(users.isActive, true),
      inArray(users.role, ["organization_owner", "vehicle_inspection_admin", "driver_training_admin"]),
    ))
    .groupBy(users.role);
  const accountCounts = new Map(accountRows.map((row) => [row.role, Number(row.n || 0)]));

  if ((accountCounts.get("organization_owner") || 0) < 1) {
    throw new Error("Activate an Organization Owner account before enabling operations");
  }
  if (
    subscription.plan.modules.includes("vehicle_inspection")
    && (accountCounts.get("vehicle_inspection_admin") || 0) < 1
  ) {
    throw new Error("Create a Vehicle Inspection Administrator before enabling Vehicle Inspection");
  }
  if (
    subscription.plan.modules.includes("driver_training")
    && (accountCounts.get("driver_training_admin") || 0) < 1
  ) {
    throw new Error("Create a Driver Training Administrator before enabling Driver Training & Assessment");
  }

  const isolation = await verifyTenantDataPlaneReadiness();
  if (!isolation.ready) {
    throw new Error(
      `Tenant isolation verification failed (${isolation.tenantColumns}/${isolation.expectedTenantColumns} tables, `
      + `${isolation.requiredGuards}/${isolation.expectedRequiredGuards} database guards)`,
    );
  }

  const [updated] = await db
    .update(organizations)
    .set({
      status: "active",
      operationalAccessEnabled: true,
      dataIsolationVerifiedAt: now,
      onboardingStage: "complete",
      updatedAt: now,
    })
    .where(eq(organizations.id, input.organizationId))
    .returning();

  if (!updated) throw new Error("Organization activation did not complete");
  return { organization: updated, isolation };
}


function currentMonthWindow(at = new Date()) {
  const start = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
  const end = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1));
  return { start, end };
}

export async function getOrganizationPlanUsage(organizationId: string, at = new Date()) {
  const { start, end } = currentMonthWindow(at);
  const [[userCount], [stationCount], [vehicleCount], [inspectionCount]] = await Promise.all([
    db.select({ n: count() }).from(users).where(and(
      eq(users.organizationId, organizationId),
      eq(users.isActive, true),
    )),
    db.select({ n: count() }).from(locations).where(and(
      eq(locations.organizationId, organizationId),
      ne(locations.status, "inactive"),
    )),
    db.select({ n: count() }).from(vehicles).where(and(
      eq(vehicles.organizationId, organizationId),
      ne(vehicles.status, "decommissioned"),
    )),
    db.select({ n: count() }).from(inspections).where(and(
      eq(inspections.organizationId, organizationId),
      gte(inspections.inspectionDate, start),
      lt(inspections.inspectionDate, end),
    )),
  ]);

  return {
    users: Number(userCount?.n || 0),
    stations: Number(stationCount?.n || 0),
    vehicles: Number(vehicleCount?.n || 0),
    monthlyInspections: Number(inspectionCount?.n || 0),
    period: { start, end },
  };
}

export async function getPlatformOrganizationSubscriptionDetail(organizationId: string) {
  const [[organization], subscription, usage] = await Promise.all([
    db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1),
    getLatestOrganizationSubscription(organizationId),
    getOrganizationPlanUsage(organizationId),
  ]);

  return {
    organization: organization || null,
    subscription,
    usage,
  };
}

export type ManagedSubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "grace"
  | "suspended"
  | "cancelled"
  | "expired";

export async function updateOrganizationSubscriptionLifecycle(input: {
  organizationId: string;
  actorUserId: string;
  planCode: string;
  status: ManagedSubscriptionStatus;
  amount?: string | number | null;
  currency?: string | null;
  currentPeriodEnd?: Date | null;
  trialEndsAt?: Date | null;
  graceEndsAt?: Date | null;
  cancelAtPeriodEnd?: boolean;
  notes?: string | null;
}) {
  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, input.organizationId))
    .limit(1);
  if (!organization) throw new Error("Organization not found");

  const current = await getLatestOrganizationSubscription(input.organizationId);
  if (!current) throw new Error("Organization subscription not found");

  const [targetPlan] = await db
    .select()
    .from(subscriptionPlans)
    .where(and(
      eq(subscriptionPlans.code, input.planCode.trim()),
      eq(subscriptionPlans.isActive, true),
    ))
    .limit(1);
  if (!targetPlan) throw new Error("Selected subscription plan is unavailable");

  const usage = await getOrganizationPlanUsage(input.organizationId);
  const violations: string[] = [];
  if (usage.users > targetPlan.maxUsers) {
    violations.push(`${usage.users} active users exceed the ${targetPlan.maxUsers} user limit`);
  }
  if (usage.stations > targetPlan.maxStations) {
    violations.push(`${usage.stations} active stations exceed the ${targetPlan.maxStations} station limit`);
  }
  if (usage.vehicles > targetPlan.maxVehicles) {
    violations.push(`${usage.vehicles} managed vehicles exceed the ${targetPlan.maxVehicles} vehicle limit`);
  }
  if (usage.monthlyInspections > targetPlan.maxInspectionsPerMonth) {
    violations.push(
      `${usage.monthlyInspections} inspections this month exceed the ${targetPlan.maxInspectionsPerMonth} monthly limit`,
    );
  }
  if (violations.length) {
    throw new Error(`Plan change blocked: ${violations.join("; ")}. Reduce usage or choose a larger plan.`);
  }

  if (input.status === "trialing" && !input.trialEndsAt) {
    throw new Error("A trial end date is required for a trialing subscription");
  }
  if (input.status === "grace" && !input.graceEndsAt) {
    throw new Error("A grace end date is required for a grace-period subscription");
  }

  const amountValue = input.amount === null || input.amount === undefined || input.amount === ""
    ? String(targetPlan.price)
    : String(input.amount);
  const amountNumber = Number(amountValue);
  if (!Number.isFinite(amountNumber) || amountNumber < 0 || amountNumber > 9999999999) {
    throw new Error("Subscription amount is invalid");
  }

  const currency = (input.currency || targetPlan.currency || "GHS").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Currency must be a 3-letter ISO code");

  const notes = input.notes?.trim() || null;
  if (notes && notes.length > 4000) throw new Error("Subscription notes must not exceed 4000 characters");

  const now = new Date();
  const planChanged = current.plan.id !== targetPlan.id;
  const statusChanged = current.subscription.status !== input.status;

  const [updated] = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`subscription-lifecycle:${input.organizationId}`}))`);

    const [subscription] = await tx
      .update(organizationSubscriptions)
      .set({
        planId: targetPlan.id,
        status: input.status,
        amount: amountValue,
        currency,
        currentPeriodEnd: input.currentPeriodEnd || null,
        trialEndsAt: input.trialEndsAt || null,
        graceEndsAt: input.graceEndsAt || null,
        cancelAtPeriodEnd: Boolean(input.cancelAtPeriodEnd),
        notes,
        updatedAt: now,
      })
      .where(eq(organizationSubscriptions.id, current.subscription.id))
      .returning();

    await tx
      .update(organizations)
      .set({
        enabledModules: targetPlan.modules,
        updatedAt: now,
      })
      .where(eq(organizations.id, input.organizationId));

    if (planChanged || statusChanged) {
      const orgUsers = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.organizationId, input.organizationId));
      if (orgUsers.length) {
        await tx
          .update(sessions)
          .set({ isActive: false })
          .where(inArray(sessions.userId, orgUsers.map((user) => user.id)));
      }
    }

    return [subscription] as const;
  });

  if (!updated) throw new Error("Subscription update did not complete");

  return {
    organization,
    before: current,
    subscription: updated,
    plan: targetPlan,
    usage,
    planChanged,
    statusChanged,
  };
}

export async function setOrganizationStatus(input: {
  organizationId: string;
  status: "pending" | "provisioning" | "active" | "suspended" | "cancelled";
  actorUserId: string;
}) {
  const [updated] = await db
    .update(organizations)
    .set({ status: input.status, updatedAt: new Date() })
    .where(eq(organizations.id, input.organizationId))
    .returning();
  if (!updated) throw new Error("Organization not found");

  if (input.status === "suspended" || input.status === "cancelled") {
    const orgUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.organizationId, input.organizationId));
    if (orgUsers.length) {
      const { sessions } = await import("@/db/schema");
      await db
        .update(sessions)
        .set({ isActive: false })
        .where(inArray(sessions.userId, orgUsers.map((user) => user.id)));
    }
  }

  return updated;
}
