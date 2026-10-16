"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformSuperAdmin } from "@/lib/require-auth";
import {
  convertOnboardingRequest,
  setOrganizationStatus,
} from "@/lib/organization-control-plane";

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
