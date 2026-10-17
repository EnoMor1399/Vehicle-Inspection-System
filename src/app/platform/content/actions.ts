"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { organizationSubscriptions, platformContent, subscriptionPlans } from "@/db/schema";
import { requirePlatformSuperAdmin } from "@/lib/require-auth";
import { logAudit } from "@/lib/audit";
import { PLATFORM_CONTENT_BY_KEY, type PlatformContentKey } from "@/lib/platform-content";
import { newId } from "@/lib/utils";

export type CentreActionState = { ok: boolean; message: string };

const contentSchema = z.object({
  key: z.string().min(1).max(100),
  revision: z.coerce.number().int().min(0),
  text: z.string().trim().min(1).max(2000),
  operation: z.enum(["draft", "publish", "restore"]),
});

export async function updatePlatformCopy(
  _previous: CentreActionState,
  formData: FormData,
): Promise<CentreActionState> {
  const actor = await requirePlatformSuperAdmin();
  const parsed = contentSchema.safeParse({
    key: formData.get("key"),
    revision: formData.get("revision"),
    text: formData.get("text"),
    operation: formData.get("operation"),
  });
  if (!parsed.success) return { ok: false, message: "Review the content text and revision number." };
  const input = parsed.data;
  const field = PLATFORM_CONTENT_BY_KEY[input.key as PlatformContentKey];
  if (!field || input.text.length > field.maxLength) {
    return { ok: false, message: "Invalid content field or text exceeds its permitted length." };
  }

  try {
    const updated = await db.transaction(async tx => {
      // Create the globally keyed draft once; subsequent edits use compare-and-set revisions.
      await tx.insert(platformContent).values({
        key: field.key, draftText: field.defaultText, revision: 0, updatedBy: actor.id,
      }).onConflictDoNothing();
      const [previous] = await tx.select().from(platformContent)
        .where(eq(platformContent.key, field.key)).limit(1);
      if (!previous || previous.revision !== input.revision) {
        throw new Error("This content changed in another session. Refresh and review the latest version.");
      }
      const publishedText = input.operation === "restore" ? null
        : input.operation === "publish" ? input.text : previous.publishedText;
      const draftText = input.operation === "restore" ? field.defaultText : input.text;
      const [next] = await tx.update(platformContent)
        .set({
          draftText,
          publishedText,
          revision: input.revision + 1,
          updatedAt: new Date(),
          updatedBy: actor.id,
          publishedAt: input.operation === "publish" ? new Date()
            : input.operation === "restore" ? null : previous.publishedAt,
        })
        .where(and(eq(platformContent.key, field.key), eq(platformContent.revision, input.revision)))
        .returning();
      if (!next) throw new Error("Concurrent update detected. Refresh before saving again.");
      return { previous: previous.publishedText, next: next.publishedText, revision: next.revision };
    });
    await logAudit({
      organizationId: actor.organizationId,
      userId: actor.id,
      userName: actor.name,
      action: "update",
      entityType: "platform_content",
      entityLabel: field.label,
      summary: `Platform copy ${input.operation}: ${field.key} (revision ${updated.revision})`,
      before: { published: updated.previous },
      after: { published: updated.next, revision: updated.revision },
    });
    revalidatePath("/platform/content");
    revalidatePath("/subscribe");
    revalidatePath("/login");
    revalidatePath("/workspace-setup");
    revalidatePath("/subscription-access");
    return { ok: true, message: input.operation === "draft" ? "Draft saved. It is not yet public."
      : input.operation === "restore" ? "Published override removed. Default text restored."
        : "Content published. Refresh the public page to see the update." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not save content." };
  }
}

const KNOWN_MODULES = ["vehicle_inspection", "driver_training", "reports", "api"] as const;
const moduleSchema = z.enum(KNOWN_MODULES);
const packageSchema = z.object({
  id: z.string().uuid().or(z.literal("new")),
  code: z.string().trim().regex(/^[a-z][a-z0-9_]{1,49}$/, "Use lowercase letters, numbers and underscores."),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000),
  billingCycle: z.enum(["monthly", "annual", "custom"]),
  price: z.coerce.number().finite().min(0).max(9999999999),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  trialDays: z.coerce.number().int().min(0).max(365),
  maxUsers: z.coerce.number().int().min(1).max(1000000),
  maxStations: z.coerce.number().int().min(1).max(100000),
  maxVehicles: z.coerce.number().int().min(1).max(100000000),
  maxInspectionsPerMonth: z.coerce.number().int().min(1).max(100000000),
  sortOrder: z.coerce.number().int().min(0).max(100000),
  modules: z.array(moduleSchema).min(1),
  features: z.record(z.string().regex(/^[a-z][a-z0-9_]{1,59}$/), z.boolean()),
  isActive: z.boolean(),
});

function boolFeatures(value: FormDataEntryValue | null) {
  if (!value || typeof value !== "string" || value.length > 5000) throw new Error("Feature flags JSON is invalid.");
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error("Feature flags must be a JSON object."); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)
      || Object.keys(parsed).length > 50) throw new Error("Use a JSON object with up to 50 feature flags.");
  return parsed;
}

export async function saveSubscriptionPackage(
  _previous: CentreActionState,
  formData: FormData,
): Promise<CentreActionState> {
  const actor = await requirePlatformSuperAdmin();
  let features: unknown;
  try { features = boolFeatures(formData.get("features")); }
  catch (error) { return { ok: false, message: error instanceof Error ? error.message : "Invalid feature flags." }; }
  const parsed = packageSchema.safeParse({
    id: formData.get("id"),
    code: formData.get("code"),
    name: formData.get("name"),
    description: formData.get("description") || "",
    billingCycle: formData.get("billingCycle"),
    price: formData.get("price"),
    currency: formData.get("currency"),
    trialDays: formData.get("trialDays"),
    maxUsers: formData.get("maxUsers"),
    maxStations: formData.get("maxStations"),
    maxVehicles: formData.get("maxVehicles"),
    maxInspectionsPerMonth: formData.get("maxInspectionsPerMonth"),
    sortOrder: formData.get("sortOrder"),
    modules: formData.getAll("modules"),
    features,
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map(x => x.message).slice(0, 3).join(" ") };
  }
  const input = parsed.data;
  const modules = [...new Set(input.modules)];
  try {
    const result = await db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"platform:subscription_plans"}))`);
      const [before] = input.id === "new" ? [] : await tx.select().from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, input.id)).limit(1);
      if (input.id !== "new" && !before) throw new Error("Subscription package not found.");
      if (before && before.code !== input.code) throw new Error("Package codes cannot be changed after creation.");
      const [codeTaken] = await tx.select({ id: subscriptionPlans.id }).from(subscriptionPlans)
        .where(eq(subscriptionPlans.code, input.code)).limit(1);
      if (codeTaken && codeTaken.id !== before?.id) throw new Error("Another package already uses this code.");

      const [linked] = before ? await tx.select({ n: count() })
        .from(organizationSubscriptions).where(eq(organizationSubscriptions.planId, before.id))
        : [{ n: 0 }];
      const assigned = Number(linked?.n || 0);
      if (before && assigned > 0) {
        const reduction = input.maxUsers < before.maxUsers
          || input.maxStations < before.maxStations
          || input.maxVehicles < before.maxVehicles
          || input.maxInspectionsPerMonth < before.maxInspectionsPerMonth;
        const removedModule = before.modules.some(module => !modules.includes(module as typeof modules[number]));
        const disabledFeature = Object.entries(before.features || {})
          .some(([key, wasOn]) => wasOn && !input.features[key]);
        if (reduction || removedModule || disabledFeature || !input.isActive) {
          throw new Error(`Package assigned to ${assigned} subscriber record(s). Do not reduce limits, remove modules/features or deactivate it. Create a replacement package and migrate subscribers using the existing lifecycle controls.`);
        }
        if (input.billingCycle !== before.billingCycle || input.currency !== before.currency) {
          throw new Error("Assigned packages cannot change billing cycle or currency. Create a replacement package.");
        }
      }

      const values = {
        name: input.name,
        description: input.description || null,
        price: input.price.toFixed(2),
        currency: input.currency,
        billingCycle: input.billingCycle,
        trialDays: input.trialDays,
        maxUsers: input.maxUsers,
        maxStations: input.maxStations,
        maxVehicles: input.maxVehicles,
        maxInspectionsPerMonth: input.maxInspectionsPerMonth,
        modules,
        features: input.features,
        isActive: input.isActive,
        sortOrder: input.sortOrder,
        updatedAt: new Date(),
      };
      const [saved] = before
        ? await tx.update(subscriptionPlans).set(values).where(eq(subscriptionPlans.id, before.id)).returning()
        : await tx.insert(subscriptionPlans).values({ ...values, id: newId(), code: input.code }).returning();
      if (!saved) throw new Error("Package update did not complete.");
      return { before, saved, assigned };
    });
    await logAudit({
      organizationId: actor.organizationId,
      userId: actor.id, userName: actor.name,
      action: result.before ? "update" : "create",
      entityType: "subscription_package",
      entityId: result.saved.id,
      entityLabel: result.saved.name,
      summary: `${result.before ? "Updated" : "Created"} subscription package ${result.saved.code}`,
      before: result.before || null,
      after: { package: result.saved, historicSubscriberAssignments: result.assigned },
    });
    revalidatePath("/platform/content");
    revalidatePath("/subscribe");
    revalidatePath("/platform/organizations");
    return { ok: true, message: result.before
      ? "Package updated. Existing subscriber invoice amounts were not changed."
      : "New package created. It is available to subscribers when marked active." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Package update failed." };
  }
}
