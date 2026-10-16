"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformSuperAdmin } from "@/lib/require-auth";
import {
  activateOrganizationWorkspace,
  convertOnboardingRequest,
  setOrganizationStatus,
  updateOrganizationSubscriptionLifecycle,
} from "@/lib/organization-control-plane";
import { logAudit } from "@/lib/audit";
import {
  createSubscriptionInvoice,
  recordManualInvoicePayment,
} from "@/lib/subscription-billing";

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
    revalidatePath("/platform/organizations");
    return {
      ok: true,
      message: "Subscriber workspace created in provisioning mode. Send the one-time owner invitation link below.",
      invitationPath: `/invite/${converted.invitationToken}`,
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


export async function activateSubscriberWorkspace(formData: FormData) {
  const actor = await requirePlatformSuperAdmin();
  const parsed = z.object({
    organizationId: z.string().uuid(),
  }).safeParse({
    organizationId: formData.get("organizationId"),
  });
  if (!parsed.success) throw new Error("Invalid organization activation request");

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


export type SubscriberBillingActionState = {
  ok: boolean;
  message: string;
  invoiceId?: string;
};

export async function issueSubscriberInvoice(
  _previous: SubscriberBillingActionState,
  formData: FormData,
): Promise<SubscriberBillingActionState> {
  const actor = await requirePlatformSuperAdmin();
  const parsed = z.object({
    organizationId: z.string().uuid(),
    tax: z.string().trim().max(30).optional(),
    discount: z.string().trim().max(30).optional(),
    notes: z.string().trim().max(4000).optional(),
  }).safeParse({
    organizationId: formData.get("organizationId"),
    tax: typeof formData.get("tax") === "string" ? formData.get("tax") : undefined,
    discount: typeof formData.get("discount") === "string" ? formData.get("discount") : undefined,
    notes: typeof formData.get("notes") === "string" ? formData.get("notes") : undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message || "Invalid invoice request." };
  }

  try {
    const dueAt = optionalDate(formData.get("dueAt"));
    const invoice = await createSubscriptionInvoice({
      organizationId: parsed.data.organizationId,
      actorUserId: actor.id,
      dueAt,
      tax: parsed.data.tax || null,
      discount: parsed.data.discount || null,
      notes: parsed.data.notes || null,
    });

    await logAudit({
      organizationId: actor.organizationId,
      userId: actor.id,
      userName: actor.name,
      action: "create",
      entityType: "subscription_invoice",
      entityId: invoice.id,
      entityLabel: invoice.invoiceNumber,
      summary: `Issued subscription invoice ${invoice.invoiceNumber}`,
      after: {
        subscriberOrganizationId: invoice.organizationId,
        total: invoice.total,
        currency: invoice.currency,
        dueAt: invoice.dueAt,
      },
    });

    revalidatePath(`/platform/organizations/${parsed.data.organizationId}`);
    revalidatePath("/organization/billing");
    return { ok: true, message: `Invoice ${invoice.invoiceNumber} is ready.`, invoiceId: invoice.id };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Unable to issue invoice." };
  }
}

export async function recordSubscriberManualPayment(
  _previous: SubscriberBillingActionState,
  formData: FormData,
): Promise<SubscriberBillingActionState> {
  const actor = await requirePlatformSuperAdmin();
  const parsed = z.object({
    organizationId: z.string().uuid(),
    invoiceId: z.string().uuid(),
    reference: z.string().trim().min(3).max(160),
    channel: z.string().trim().max(80).optional(),
    notes: z.string().trim().max(1000).optional(),
  }).safeParse({
    organizationId: formData.get("organizationId"),
    invoiceId: formData.get("invoiceId"),
    reference: formData.get("reference"),
    channel: typeof formData.get("channel") === "string" ? formData.get("channel") : undefined,
    notes: typeof formData.get("notes") === "string" ? formData.get("notes") : undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message || "Invalid payment record." };
  }

  try {
    await recordManualInvoicePayment({
      organizationId: parsed.data.organizationId,
      invoiceId: parsed.data.invoiceId,
      actorUserId: actor.id,
      reference: parsed.data.reference,
      channel: parsed.data.channel || "bank_transfer",
      notes: parsed.data.notes || null,
    });

    await logAudit({
      organizationId: actor.organizationId,
      userId: actor.id,
      userName: actor.name,
      action: "update",
      entityType: "subscription_invoice",
      entityId: parsed.data.invoiceId,
      summary: `Recorded verified manual subscription payment ${parsed.data.reference}`,
      after: {
        subscriberOrganizationId: parsed.data.organizationId,
        paymentReference: parsed.data.reference,
        channel: parsed.data.channel || "bank_transfer",
      },
    });

    revalidatePath(`/platform/organizations/${parsed.data.organizationId}`);
    revalidatePath("/organization/billing");
    return { ok: true, message: "Payment recorded and invoice settled.", invoiceId: parsed.data.invoiceId };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Unable to record payment." };
  }
}
