import { sql } from "drizzle-orm";
import { db } from "@/db";

export type ThemeMode = "light" | "dark" | "system";

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

let tableReady: Promise<void> | null = null;

async function ensureThemePreferenceTable() {
  if (!tableReady) {
    tableReady = (async () => {
      await db.execute(sql`
        create table if not exists user_theme_preferences (
          user_id varchar(36) primary key references users(id) on delete cascade,
          theme_mode varchar(10) not null default 'system'
            check (theme_mode in ('light', 'dark', 'system')),
          updated_at timestamp not null default now()
        )
      `);
    })().catch((error) => {
      tableReady = null;
      throw error;
    });
  }
  await tableReady;
}

export async function getUserThemePreference(userId: string): Promise<ThemeMode | null> {
  try {
    await ensureThemePreferenceTable();
    const result = await db.execute<{ theme_mode: string }>(sql`
      select theme_mode
      from user_theme_preferences
      where user_id = ${userId}
      limit 1
    `);
    const value = result.rows[0]?.theme_mode;
    return isThemeMode(value) ? value : null;
  } catch (error) {
    console.warn("Theme preference lookup unavailable; using device preference.", error instanceof Error ? error.message : error);
    return null;
  }
}

export async function setUserThemePreference(userId: string, mode: ThemeMode): Promise<boolean> {
  if (!isThemeMode(mode)) return false;

  try {
    await ensureThemePreferenceTable();
    await db.execute(sql`
      insert into user_theme_preferences (user_id, theme_mode, updated_at)
      values (${userId}, ${mode}, now())
      on conflict (user_id)
      do update set theme_mode = excluded.theme_mode, updated_at = now()
    `);
    return true;
  } catch (error) {
    console.warn("Theme preference could not be synced; local preference remains active.", error instanceof Error ? error.message : error);
    return false;
  }
}
