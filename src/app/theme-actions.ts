"use server";

import { getCurrentUser } from "@/lib/auth";
import { isThemeMode, setUserThemePreference, type ThemeMode } from "@/lib/theme-preferences";

export async function saveThemePreferenceAction(mode: ThemeMode): Promise<{ ok: boolean }> {
  if (!isThemeMode(mode)) return { ok: false };

  try {
    const user = await getCurrentUser();
    return { ok: await setUserThemePreference(user.id, mode) };
  } catch {
    return { ok: false };
  }
}
