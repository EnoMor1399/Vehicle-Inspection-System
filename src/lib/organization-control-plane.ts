import { createHash, randomBytes } from "crypto";
import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  organizationInvitations,
  organizationOnboardingRequests,
  organizations,
  organizationSubscriptions,
  subscriptionPlans,
  systemSettings,
  users,
} from "@/db/schema";
import { newId } from "@/lib/utils";
import { hashPassword, validateEmail, validatePasswordStrength } from "@/lib/password";

export const SUBSCRIBER_ADMIN_ROLES = [
  "vehicle_inspection_admin",
  "driver_training_admin",
] as const;

export type SubscriberAdminRole = (typeof SUBSCRIBER_ADMIN_ROLES)[number];

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
    db.select({ n: count() }).from(users).where(eq(users.organizationId, organizationId)),
    db
      .select({ id: organizationInvitations.id })
      .from(organizationInvitations)
      .where(
        and(
          eq(organizationInvitations.organizationId, organizationId),
          isNull(organizationInvitations.acceptedAt),
          isNull(organizationInvitations.revokedAt),
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
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${request.contactEmail}))`);

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

  const snapshot = await getOrganizationAccountSnapshot(input.organizationId);
  if (!snapshot.organization || !snapshot.subscription) throw new Error("Organization subscription is unavailable");

  if (input.role === "driver_training_admin" && !snapshot.subscription.plan.modules.includes("driver_training")) {
    throw new Error("The current subscription plan does not include Driver Training & Assessment");
  }

  if (snapshot.userCount + snapshot.pendingInvitationCount >= snapshot.subscription.plan.maxUsers) {
    throw new Error("The subscription user limit has been reached");
  }

  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);
  if (existingUser) throw new Error("An account with this email already exists");

  const token = randomBytes(32).toString("base64url");
  await db.insert(organizationInvitations).values({
    id: newId(),
    organizationId: input.organizationId,
    email: normalizedEmail,
    name: input.name?.trim().slice(0, 200) || null,
    role: input.role,
    tokenHash: invitationHash(token),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdBy: input.actorUserId,
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
  const { invitation, organization } = row;
  if (invitation.acceptedAt) throw new Error("Invitation has already been accepted");
  if (invitation.revokedAt) throw new Error("Invitation has been revoked");
  if (row.expired) throw new Error("Invitation has expired");
  if (organization.status === "cancelled") throw new Error("Organization account is no longer available");

  const name = input.name.trim().slice(0, 200);
  if (name.length < 2) throw new Error("Enter your full name");
  if (input.password !== input.confirmPassword) throw new Error("Passwords do not match");
  const passwordStrength = validatePasswordStrength(input.password);
  if (!passwordStrength.valid) throw new Error(passwordStrength.errors[0]);

  const passwordHash = await hashPassword(input.password);
  const userId = newId();
  const permissions =
    invitation.role === "organization_owner"
      ? { vehicle_inspection: false, training: false }
      : invitation.role === "driver_training_admin"
        ? { vehicle_inspection: false, training: true }
        : { vehicle_inspection: true, training: false };

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, invitation.email))
      .limit(1);
    if (existing) throw new Error("An account with this email already exists");

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

    await tx
      .update(organizationInvitations)
      .set({ acceptedAt: new Date() })
      .where(eq(organizationInvitations.id, invitation.id));

    await tx
      .update(organizations)
      .set({
        onboardingStage: invitation.role === "organization_owner" ? "owner_active" : organization.onboardingStage,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, organization.id));
  });

  return { userId, organizationId: invitation.organizationId, role: invitation.role };
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
