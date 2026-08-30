import { sql } from "drizzle-orm";
import { db } from "@/db";

export type ThemeMode = "light" | "dark" | "system";

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

let lookupWarningShown = false;
let saveWarningShown = false;

export async function getUserThemePreference(userId: string): Promise<ThemeMode | null> {
  try {
    const result = await db.execute<{ theme_mode: string }>(sql`
      select theme_mode
      from user_theme_preferences
      where user_id = ${userId}
      limit 1
    `);
    const value = result.rows[0]?.theme_mode;
    return isThemeMode(value) ? value : null;
  } catch (error) {
    if (!lookupWarningShown) {
      lookupWarningShown = true;
      console.warn(
        "Theme preference lookup unavailable; using device preference. Apply the user_theme_preferences migration to enable account sync.",
        error instanceof Error ? error.message : error
      );
    }
    return null;
  }
}

export async function setUserThemePreference(userId: string, mode: ThemeMode): Promise<boolean> {
  if (!isThemeMode(mode)) return false;

  try {
    await db.execute(sql`
      insert into user_theme_preferences (user_id, theme_mode, updated_at)
      values (${userId}, ${mode}, now())
      on conflict (user_id)
      do update set theme_mode = excluded.theme_mode, updated_at = now()
    `);
    return true;
  } catch (error) {
    if (!saveWarningShown) {
      saveWarningShown = true;
      console.warn(
        "Theme preference could not be synced; local preference remains active. Apply the user_theme_preferences migration to enable account sync.",
        error instanceof Error ? error.message : error
      );
    }
    return false;
  }
}
