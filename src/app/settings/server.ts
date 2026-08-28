"use server";

import { revalidatePath } from "next/cache";
import { getSettings, updateSettings, type SystemSettings } from "@/lib/settings";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

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

  try {
    const before = await getSettings();
    await updateSettings(data, user.id);
    await logAudit({
      userId: user.id,
      userName: user.name,
      action: "update",
      entityType: "system_settings",
      entityId: "singleton",
      entityLabel: "System Settings",
      summary: "Updated system settings",
      before,
      after: data,
    });
    revalidatePath("/", "layout");
    revalidatePath("/settings");
    revalidatePath("/login");
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to update settings" };
  }
}
