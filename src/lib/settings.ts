import { db } from "@/db";
import { systemSettings } from "@/db/schema";
import { newId } from "./utils";
import { eq } from "drizzle-orm";

export type SystemSettings = typeof systemSettings.$inferSelect;

const SETTINGS_ID = "singleton";

export async function getSettings(): Promise<SystemSettings> {
  const [settings] = await db.select().from(systemSettings);
  if (settings) return settings;

  // Initialize with defaults
  const id = newId();
  const [created] = await db
    .insert(systemSettings)
    .values({ id })
    .returning();
  return created;
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

