"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformSuperAdmin } from "@/lib/require-auth";
import {
  activateOrganizationWorkspace,
  reissueOrganizationOwnerInvitation,
  convertOnboardingRequest,
  setOrganizationStatus,
  updateOrganizationSubscriptionLifecycle,
} from "@/lib/organization-control-plane";
import { logAudit } from "@/lib/audit";
import { sendWorkspaceInvitationEmail } from "@/lib/invitation-mail";

export type PlatformOrganizationActionState = {
  ok: boolean;
  message: string;
  invitationPath?: string;
};

const approveSchema = z.object({
  requestId: z.string().uuid(),
  planCode: z.string().trim().min(1).max(50),
});

export async function approveSubscriberRequest(
  _previous: PlatformOrganizationActionState,
  formData: FormData,
): Promise<PlatformOrganizationActionState> {
  const actor = await requirePlatformSuperAdmin();
  const parsed = approveSchema.safeParse({
    requestId: formData.get("requestId"),
    planCode: formData.get("planCode"),
  });
  if (!parsed.success) return { ok: false, message: "Invalid onboarding request." };

  try {
    const converted = await convertOnboardingRequest({
      requestId: parsed.data.requestId,
      actorUserId: actor.id,
      planCode: parsed.data.planCode,
    });
    const invitationPath = `/invite/${converted.invitationToken}`;
    const delivery = await sendWorkspaceInvitationEmail({
      recipient: converted.invitationEmail,
      invitedName: converted.invitationName,
      organizationName: converted.organizationName,
      role: "organization_owner",
      invitationPath,
    });
    revalidatePath("/platform/organizations");
    return {
      ok: true,
      message: delivery.accepted
        ? "Subscriber created in provisioning mode. " + delivery.message
        : "Subscriber created, but invitation was not emailed. " + delivery.message,
      invitationPath,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Unable to approve subscriber." };
  }
}

export async function changeOrganizationStatus(formData: FormData) {
  const actor = await requirePlatformSuperAdmin();
  const parsed = z.object({
    organizationId: z.string().uuid(),
    status: z.enum(["pending", "provisioning", "active", "suspended", "cancelled"]),
  }).safeParse({
    organizationId: formData.get("organizationId"),
    status: formData.get("status"),
  });
  if (!parsed.success) throw new Error("Invalid organization status change");

  await setOrganizationStatus({
    organizationId: parsed.data.organizationId,
    status: parsed.data.status,
    actorUserId: actor.id,
  });
  revalidatePath("/platform/organizations");
}


export async function activateSubscriberWorkspace(
  _previous: PlatformOrganizationActionState,
  formData: FormData,
): Promise<PlatformOrganizationActionState> {
  const actor = await requirePlatformSuperAdmin();
  const parsed = z.object({
    organizationId: z.string().uuid(),
  }).safeParse({
    organizationId: formData.get("organizationId"),
  });
  if (!parsed.success) return { ok: false, message: "Invalid organization activation request." };

  try {
    // Preserve all required role, subscription and tenant-isolation checks.
    const result = await activateOrganizationWorkspace({
      organizationId: parsed.data.organizationId,
      actorUserId: actor.id,
    });

    await logAudit({
      organizationId: actor.organizationId,
      userId: actor.id,
      userName: actor.name,
      action: "approve",
      entityType: "organization_workspace",
      entityId: result.organization.id,
      entityLabel: result.organization.name,
      summary: `Verified tenant isolation and enabled operational access for ${result.organization.name}`,
      after: {
        status: result.organization.status,
        operationalAccessEnabled: result.organization.operationalAccessEnabled,
        dataIsolationVerifiedAt: result.organization.dataIsolationVerifiedAt,
        tenantColumns: result.isolation.tenantColumns,
        tenantGuards: result.isolation.requiredGuards,
      },
    });

    revalidatePath("/platform/organizations");
    revalidatePath(`/platform/organizations/${parsed.data.organizationId}`);
    return { ok: true, message: "Workspace activated. Tenant isolation, subscription and required administrators verified." };
  } catch (error) {
    // Expected unmet prerequisites must not trigger the entire Next.js error boundary.
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to activate the subscriber workspace.",
    };
  }
}

export async function reissueSubscriberOwnerInvitation(
  _previous: PlatformOrganizationActionState,
  formData: FormData,
): Promise<PlatformOrganizationActionState> {
  const actor = await requirePlatformSuperAdmin();
  const parsed = z.object({
    organizationId: z.string().uuid(),
    email: z.string().trim().email().max(200),
    name: z.string().trim().max(200).optional(),
  }).safeParse({
    organizationId: formData.get("organizationId"),
    email: formData.get("email"),
    name: formData.get("name"),
  });
  if (!parsed.success) return { ok: false, message: "Invalid owner invitation request." };

  try {
    const result = await reissueOrganizationOwnerInvitation({
      organizationId: parsed.data.organizationId,
      actorUserId: actor.id,
      email: parsed.data.email,
      name: parsed.data.name,
    });
    const delivery = await sendWorkspaceInvitationEmail({
      recipient: result.recipientEmail,
      invitedName: result.recipientName,
      organizationName: result.organizationName,
      role: "organization_owner",
      invitationPath: result.invitationPath,
    });
    await logAudit({
      organizationId: actor.organizationId,
      userId: actor.id,
      userName: actor.name,
      action: "update",
      entityType: "organization_owner_invitation",
      entityId: parsed.data.organizationId,
      summary: "Reissued subscriber Organization Owner invitation and revoked previous outstanding owner links",
      after: {
        organizationId: parsed.data.organizationId,
        recipient: result.recipientEmail,
        previousOwnerLinksRevoked: true,
        smtpAccepted: delivery.accepted,
      },
    });
    revalidatePath(`/platform/organizations/${parsed.data.organizationId}`);
    return {
      ok: true,
      message: delivery.accepted
        ? "Owner invitation reissued. " + delivery.message + " Earlier pending links are revoked."
        : "Owner invitation reissued but not delivered by email. " + delivery.message,
      invitationPath: result.invitationPath,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to reissue the owner invitation.",
    };
  }
}

export type SubscriptionLifecycleActionState = {
  ok: boolean;
  message: string;
};

function optionalDate(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("One of the subscription dates is invalid");
  return parsed;
}

export async function updateSubscriberSubscription(
  _previous: SubscriptionLifecycleActionState,
  formData: FormData,
): Promise<SubscriptionLifecycleActionState> {
  const actor = await requirePlatformSuperAdmin();
  const parsed = z.object({
    organizationId: z.string().uuid(),
    planCode: z.string().trim().min(1).max(50),
    status: z.enum(["trialing", "active", "past_due", "grace", "suspended", "cancelled", "expired"]),
    amount: z.string().trim().max(30).optional(),
    currency: z.string().trim().regex(/^[A-Za-z]{3}$/),
    notes: z.string().trim().max(4000).optional(),
  }).safeParse({
    organizationId: formData.get("organizationId"),
    planCode: formData.get("planCode"),
    status: formData.get("status"),
    amount: typeof formData.get("amount") === "string" ? formData.get("amount") : undefined,
    currency: formData.get("currency"),
    notes: typeof formData.get("notes") === "string" ? formData.get("notes") : undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message || "Invalid subscription update." };
  }

  try {
    const result = await updateOrganizationSubscriptionLifecycle({
      organizationId: parsed.data.organizationId,
      actorUserId: actor.id,
      planCode: parsed.data.planCode,
      status: parsed.data.status,
      amount: parsed.data.amount || null,
      currency: parsed.data.currency,
      currentPeriodEnd: optionalDate(formData.get("currentPeriodEnd")),
      trialEndsAt: optionalDate(formData.get("trialEndsAt")),
      graceEndsAt: optionalDate(formData.get("graceEndsAt")),
      cancelAtPeriodEnd: formData.get("cancelAtPeriodEnd") === "on",
      notes: parsed.data.notes || null,
    });

    await logAudit({
      organizationId: actor.organizationId,
      userId: actor.id,
      userName: actor.name,
      action: "update",
      entityType: "organization_subscription",
      entityId: result.subscription.id,
      entityLabel: result.organization.name,
      summary: `Updated ${result.organization.name} subscription to ${result.plan.name} / ${result.subscription.status}`,
      before: {
        plan: result.before.plan.code,
        status: result.before.subscription.status,
        amount: result.before.subscription.amount,
        currency: result.before.subscription.currency,
      },
      after: {
        plan: result.plan.code,
        status: result.subscription.status,
        amount: result.subscription.amount,
        currency: result.subscription.currency,
        modules: result.plan.modules,
        cancelAtPeriodEnd: result.subscription.cancelAtPeriodEnd,
      },
    });

    revalidatePath("/platform/organizations");
    revalidatePath(`/platform/organizations/${parsed.data.organizationId}`);
    revalidatePath("/organization/account");

    const sessionNote = result.planChanged || result.statusChanged
      ? " Active organization sessions were revoked so the new entitlement state applies immediately."
      : "";
    return { ok: true, message: `Subscription updated successfully.${sessionNote}` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to update the subscription.",
    };
  }
}
