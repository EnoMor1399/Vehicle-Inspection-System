import { db } from "@/db";
import { systemSettings } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { RSL_ORGANIZATION_ID } from "@/lib/organization-access";

export type SystemSettings = typeof systemSettings.$inferSelect;
export type EditableSystemSettings = Omit<
  SystemSettings,
  "id" | "organizationId" | "defaultStationId" | "updatedAt" | "updatedBy"
>;

async function getLatestSettings(organizationId: string): Promise<SystemSettings | undefined> {
  const [settings] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.organizationId, organizationId))
    .orderBy(desc(systemSettings.updatedAt))
    .limit(1);
  return settings;
}

export async function getSettings(
  organizationId: string = RSL_ORGANIZATION_ID,
): Promise<SystemSettings> {
  const existing = await getLatestSettings(organizationId);
  if (existing) return existing;

  // The organization ID is also a deterministic settings primary key for new
  // tenants. This avoids duplicate settings rows during concurrent onboarding.
  const [created] = await db
    .insert(systemSettings)
    .values({ id: organizationId, organizationId })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  const concurrent = await getLatestSettings(organizationId);
  if (concurrent) return concurrent;

  throw new Error("Organization settings could not be initialized");
}

export async function updateSettings(
  updates: Partial<EditableSystemSettings>,
  updatedBy: string,
  organizationId: string = RSL_ORGANIZATION_ID,
): Promise<SystemSettings> {
  const existing = await getSettings(organizationId);
  const [updated] = await db
    .update(systemSettings)
    .set({ ...updates, updatedAt: new Date(), updatedBy })
    .where(eq(systemSettings.id, existing.id))
    .returning();
  return updated;
}
