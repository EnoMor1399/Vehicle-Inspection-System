"use server";

import { acceptOrganizationInvitation } from "@/lib/organization-control-plane";
import { extractSubscriptionCapacityError } from "@/lib/subscription-capacity";

export type InvitationAcceptState = {
  ok: boolean;
  message: string;
};

export async function acceptInvitationAction(
  _previous: InvitationAcceptState,
  formData: FormData,
): Promise<InvitationAcceptState> {
  const token = String(formData.get("token") || "");
  const name = String(formData.get("name") || "");
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  try {
    await acceptOrganizationInvitation({ token, name, password, confirmPassword });
    return {
      ok: true,
      message: "Your account has been created. Sign in to continue and complete any required two-factor setup.",
    };
  } catch (error) {
    const capacityMessage = extractSubscriptionCapacityError(error);
    return {
      ok: false,
      message: capacityMessage || (error instanceof Error ? error.message : "Unable to accept the invitation."),
    };
  }
}
