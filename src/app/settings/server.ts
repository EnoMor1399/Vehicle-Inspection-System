"use server";

import { revalidatePath } from "next/cache";
import { getSettings, updateSettings, type SystemSettings } from "@/lib/settings";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { settingsValidationMessage, systemSettingsUpdateSchema } from "@/lib/settings-policy";

export async function getSettingsAction(): Promise<SystemSettings> {
  return getSettings();
}

export async function updateSettingsAction(
  data: Partial<Omit<SystemSettings, "id" | "updatedAt" | "updatedBy">>
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!hasPermission(user, "settings")) {
    return { ok: false, error: "You do not have permission to update system settings" };
  }

  const parsed = systemSettingsUpdateSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: settingsValidationMessage(parsed.error) };
  }
  if (Object.keys(parsed.data).length === 0) {
    return { ok: false, error: "No system setting changes were provided" };
  }

  try {
    const before = await getSettings();
    const updated = await updateSettings(parsed.data, user.id);
    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "update",
      entityType: "system_settings",
      entityId: "singleton",
      entityLabel: "System Settings",
      summary: "Updated system settings",
      before,
      after: updated,
    });
    revalidatePath("/", "layout");
    revalidatePath("/settings");
    revalidatePath("/login");
    return { ok: true };
  } catch (error) {
    console.error("System settings update failed:", error instanceof Error ? error.message : "unknown error");
    return { ok: false, error: "Failed to update system settings" };
  }
}
