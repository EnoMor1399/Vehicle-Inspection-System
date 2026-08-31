import { db } from "@/db";
import { systemSettings } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export type SystemSettings = typeof systemSettings.$inferSelect;

const SETTINGS_ID = "singleton";

async function getLatestSettings(): Promise<SystemSettings | undefined> {
  const [settings] = await db
    .select()
    .from(systemSettings)
    .orderBy(desc(systemSettings.updatedAt))
    .limit(1);
  return settings;
}

export async function getSettings(): Promise<SystemSettings> {
  const existing = await getLatestSettings();
  if (existing) return existing;

  // Use a deterministic primary key so simultaneous first requests cannot
  // create multiple competing settings rows.
  const [created] = await db
    .insert(systemSettings)
    .values({ id: SETTINGS_ID })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  // Another request may have won the initialization race.
  const [concurrent] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.id, SETTINGS_ID))
    .limit(1);
  if (concurrent) return concurrent;

  const fallback = await getLatestSettings();
  if (!fallback) throw new Error("System settings could not be initialized");
  return fallback;
}

export async function updateSettings(
  updates: Partial<Omit<SystemSettings, "id" | "updatedAt" | "updatedBy">>,
  updatedBy: string
): Promise<SystemSettings> {
  const existing = await getSettings();
  const [updated] = await db
    .update(systemSettings)
    .set({ ...updates, updatedAt: new Date(), updatedBy })
    .where(eq(systemSettings.id, existing.id))
    .returning();
  return updated;
}
