"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrganizationAccountManager } from "@/lib/require-auth";
import {
  createOrganizationAdministratorInvitation,
  getOrganizationAccountSnapshot,
  updateOrganizationProfile,
  type SubscriberAdminRole,
} from "@/lib/organization-control-plane";
import { updateSettings } from "@/lib/settings";
import { sendWorkspaceInvitationEmail } from "@/lib/invitation-mail";

export type OrganizationAccountState = {
  ok: boolean;
  message: string;
  invitationPath?: string;
};

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export async function updateOrganizationAccount(
  _previous: OrganizationAccountState,
  formData: FormData,
): Promise<OrganizationAccountState> {
  const actor = await requireOrganizationAccountManager();
  const parsed = z.object({
    name: z.string().trim().min(2).max(255),
    legalName: z.string().trim().max(255).optional(),
    registrationNumber: z.string().trim().max(100).optional(),
    taxId: z.string().trim().max(100).optional(),
    industry: z.string().trim().max(120).optional(),
    country: z.string().trim().min(2).max(100),
    region: z.string().trim().max(100).optional(),
    city: z.string().trim().max(100).optional(),
    address: z.string().trim().max(1000).optional(),
    phone: z.string().trim().max(50).optional(),
    email: z.string().trim().email().max(200).optional().or(z.literal("")),
    website: z.string().trim().max(200).optional(),
    themeColor: color,
    accentColor: color,
  }).safeParse({
    name: formData.get("name"),
    legalName: formData.get("legalName") || undefined,
    registrationNumber: formData.get("registrationNumber") || undefined,
    taxId: formData.get("taxId") || undefined,
    industry: formData.get("industry") || undefined,
    country: formData.get("country"),
    region: formData.get("region") || undefined,
    city: formData.get("city") || undefined,
    address: formData.get("address") || undefined,
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || "",
    website: formData.get("website") || undefined,
    themeColor: formData.get("themeColor"),
    accentColor: formData.get("accentColor"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message || "Review the organization profile." };
  }

  try {
    const organization = await updateOrganizationProfile({
      organizationId: actor.organizationId,
      ...parsed.data,
      email: parsed.data.email || undefined,
    });

    await updateSettings({
      companyName: organization.name,
      companyShortName: organization.name.slice(0, 50),
      address: organization.address,
      city: organization.city,
      region: organization.region,
      country: organization.country,
      phone: organization.phone,
      email: organization.email,
      website: organization.website,
      taxId: organization.taxId,
      registrationNumber: organization.registrationNumber,
      themeColor: organization.themeColor,
      accentColor: organization.accentColor,
      footerText: `© ${new Date().getFullYear()} ${organization.name}. All rights reserved.`,
    }, actor.id, actor.organizationId);

    revalidatePath("/", "layout");
    revalidatePath("/organization/account");
    return { ok: true, message: "Organization profile updated." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Unable to update organization." };
  }
}

export async function inviteOrganizationAdministrator(
  _previous: OrganizationAccountState,
  formData: FormData,
): Promise<OrganizationAccountState> {
  const actor = await requireOrganizationAccountManager();
  const parsed = z.object({
    name: z.string().trim().max(200).optional(),
    email: z.string().trim().email().max(200),
    role: z.enum(["vehicle_inspection_admin", "driver_training_admin"]),
  }).safeParse({
    name: formData.get("name") || undefined,
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { ok: false, message: "Enter a valid administrator invitation." };

  try {
    const token = await createOrganizationAdministratorInvitation({
      organizationId: actor.organizationId,
      actorUserId: actor.id,
      email: parsed.data.email,
      name: parsed.data.name,
      role: parsed.data.role as SubscriberAdminRole,
    });
    const { organization } = await getOrganizationAccountSnapshot(actor.organizationId);
    const invitationPath = `/invite/${token}`;
    const delivery = await sendWorkspaceInvitationEmail({
      recipient: parsed.data.email.trim().toLowerCase(),
      invitedName: parsed.data.name || null,
      organizationName: organization?.name || "Your organization",
      role: parsed.data.role,
      invitationPath,
    });
    revalidatePath("/organization/account");
    return {
      ok: true,
      message: delivery.accepted
        ? "Administrator invitation created. " + delivery.message
        : "Administrator invitation created, but the email could not be sent. " + delivery.message,
      invitationPath,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Unable to create invitation." };
  }
}
