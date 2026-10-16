/**
 * Real PostgreSQL race-condition test for subscriber onboarding.
 * Only runs against the ephemeral localhost database built by E2E CI.
 * Never point this script at a production or preview database.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, count, eq, isNull, gt } from "drizzle-orm";
import { db, pool } from "../src/db";
import { organizationInvitations, organizationOnboardingRequests, organizations, users } from "../src/db/schema";
import {
  acceptOrganizationInvitation,
  convertOnboardingRequest,
  createOnboardingRequest,
  createOrganizationAdministratorInvitation,
} from "../src/lib/organization-control-plane";

const databaseUrl = process.env.DATABASE_URL;
const hostname = databaseUrl ? new URL(databaseUrl).hostname : "";
if (!process.env.E2E_BASE_URL || !["127.0.0.1", "localhost"].includes(hostname)) {
  throw new Error("Subscriber concurrency tests can run only on the isolated localhost E2E database");
}

try {
  const suffix = randomUUID().slice(0, 8);
  const companyName = `Concurrency Fixture ${suffix}`;
  const ownerEmail = `onboarding.owner.${suffix}@vims.local`;
  const requestId = await createOnboardingRequest({
    companyName,
    contactName: "Subscriber Owner",
    contactEmail: ownerEmail,
    country: "Ghana",
    desiredPlanCode: "starter",
    estimatedUsers: 10,
  });
  const actorUserId = "e2e0000-0000-4000-8000-000000000001";

  // Two simultaneous approval requests must create only one company.
  const approvals = await Promise.allSettled([
    convertOnboardingRequest({ requestId, actorUserId, planCode: "starter" }),
    convertOnboardingRequest({ requestId, actorUserId, planCode: "starter" }),
  ]);
  const approved = approvals.filter((x): x is PromiseFulfilledResult<Awaited<ReturnType<typeof convertOnboardingRequest>>> => x.status === "fulfilled");
  assert.equal(approved.length, 1, "Exactly one concurrent company approval must succeed");
  assert.equal(approvals.filter((x) => x.status === "rejected").length, 1, "Duplicate approval must be rejected");

  assert.ok(approved[0]);
  const organizationId = approved[0].value.organizationId;
  const invitationToken = approved[0].value.invitationToken;
  const [record] = await db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  assert.ok(record);
  assert.equal(record.operationalAccessEnabled, false, "New subscriber remains fail-closed");

  const [request] = await db.select({status:organizationOnboardingRequests.status}).from(organizationOnboardingRequests)
    .where(eq(organizationOnboardingRequests.id, requestId)).limit(1);
  assert.ok(request);
  assert.equal(request.status, "converted", "Onboarding request is converted once");

  const password = "E2eOnly!Passw0rd2026";
  const acceptInput = {
    token: invitationToken,
    name: "Subscriber Owner",
    password,
    confirmPassword: password,
  };
  const acceptances = await Promise.allSettled([
    acceptOrganizationInvitation(acceptInput),
    acceptOrganizationInvitation(acceptInput),
  ]);
  const accepted = acceptances.filter((x): x is PromiseFulfilledResult<Awaited<ReturnType<typeof acceptOrganizationInvitation>>> => x.status === "fulfilled");
  assert.equal(accepted.length, 1, "One-time invitation may only be accepted once");
  assert.ok(accepted[0]);
  assert.equal(acceptances.filter((x) => x.status === "rejected").length, 1, "Replayed invitation must fail");

  const [ownerCount] = await db.select({n:count()}).from(users)
    .where(and(eq(users.organizationId,organizationId),eq(users.email,ownerEmail)));
  assert.ok(ownerCount);
  assert.equal(Number(ownerCount.n), 1, "Exactly one Organization Owner account must exist");

  // Starter allows 10 active users; with one owner, only 9 new invitations
  // can reserve capacity even when submissions arrive concurrently.
  const inviteRequests = Array.from({length: 12}, (_, index) => createOrganizationAdministratorInvitation({
    organizationId,
    actorUserId: accepted[0].value.userId,
    email: `onboarding.admin.${index}.${suffix}@vims.local`,
    role: "vehicle_inspection_admin" as const,
  }));
  const inviteResults = await Promise.allSettled(inviteRequests);
  assert.equal(inviteResults.filter((x) => x.status === "fulfilled").length, 9, "Only nine remaining seats can be reserved");
  assert.equal(inviteResults.filter((x) => x.status === "rejected").length, 3, "Excess concurrent invites must be rejected");

  const [pending] = await db.select({n:count()}).from(organizationInvitations).where(and(
    eq(organizationInvitations.organizationId,organizationId),
    isNull(organizationInvitations.acceptedAt),
    isNull(organizationInvitations.revokedAt),
    gt(organizationInvitations.expiresAt,new Date()),
  ));
  assert.ok(pending);
  assert.equal(Number(pending.n), 9, "The database must hold exactly nine live pending invitations");

  console.log("Subscriber onboarding concurrency: PASS (approval, token reuse, nine-seat reservation, tenant lock)");
} finally {
  await pool.end();
}
