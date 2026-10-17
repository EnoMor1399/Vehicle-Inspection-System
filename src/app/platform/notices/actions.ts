"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { organizations, platformChangeNotices } from "@/db/schema";
import { requirePlatformSuperAdmin } from "@/lib/require-auth";
import { logAudit } from "@/lib/audit";
import { newId } from "@/lib/utils";

export type NoticeActionState = { ok: boolean; message: string };

function safeNoticePath(value: string) {
  // Never permit open redirects, external or protocol-relative destinations,
  // backslashes or percent-encoded path manipulation.
  return /^\/[A-Za-z0-9/_-]*(?:\?[A-Za-z0-9=&_-]+)?$/.test(value) && !value.startsWith("//");
}

function utcDate(value: string) {
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value)) return null;
  const d = new Date(value + "Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 16) === value ? d : null;
}

const formSchema = z.object({
  title: z.string().trim().min(8).max(160),
  summary: z.string().trim().min(20).max(1200),
  impact: z.string().trim().min(12).max(1200),
  actionRequired: z.string().trim().min(8).max(1200),
  actionUrl: z.string().trim().max(300),
  organizationId: z.string().trim().max(36),
  severity: z.enum(["info", "important", "critical"]),
  status: z.enum(["draft", "published"]),
  publishAt: z.string(),
  effectiveAt: z.string(),
  expiresAt: z.string(),
});

export async function createChangeNotice(
  _previous: NoticeActionState,
  formData: FormData,
): Promise<NoticeActionState> {
  const actor = await requirePlatformSuperAdmin();
  const parsed = formSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Complete all required notice details within the character limits." };
  const input = parsed.data;
  if (input.actionUrl && !safeNoticePath(input.actionUrl)) {
    return { ok: false, message: "Action link must be a safe internal VIMS path such as /guide." };
  }
  const now = new Date();
  const publishAt = input.publishAt ? utcDate(input.publishAt) : now;
  const effectiveAt = utcDate(input.effectiveAt);
  const expiresAt = input.expiresAt ? utcDate(input.expiresAt) : null;
  if (!publishAt || !effectiveAt || effectiveAt < publishAt || (expiresAt && expiresAt <= publishAt)) {
    return { ok: false, message: "Use valid UTC dates. Effective time must be at/after delivery; expiry must follow delivery." };
  }
  const organizationId = input.organizationId || null;
  if (organizationId) {
    const [organization] = await db.select({ id: organizations.id })
      .from(organizations).where(eq(organizations.id, organizationId)).limit(1);
    if (!organization) return { ok: false, message: "The selected subscriber does not exist." };
  }

  const id = newId();
  try {
    await db.insert(platformChangeNotices).values({
      id,
      organizationId,
      createdBy: actor.id,
      title: input.title,
      summary: input.summary,
      impact: input.impact,
      actionRequired: input.actionRequired,
      actionUrl: input.actionUrl || null,
      severity: input.severity,
      status: input.status,
      publishAt,
      effectiveAt,
      expiresAt,
    });
    await logAudit({
      organizationId: actor.organizationId, userId: actor.id, userName: actor.name,
      action: "create", entityType: "platform_change_notice", entityId: id,
      entityLabel: input.title,
      summary: `Created ${input.severity} notice (${input.status}) for ${organizationId || "all subscribers"}`,
      after: { noticeId: id, audience: organizationId || "all", status: input.status, publishAt: publishAt.toISOString() },
    });
    revalidatePath("/platform/notices");
    revalidatePath("/notifications");
    return { ok: true, message: input.status === "published"
      ? publishAt > now ? "Notice scheduled. It will appear automatically at its UTC delivery time." : "Notice published to the selected audience."
      : "Draft saved. It is not visible to subscribers." };
  } catch {
    return { ok: false, message: "The notice could not be saved. Verify the database migration and try again." };
  }
}

export async function changeNoticeStatus(formData: FormData) {
  const actor = await requirePlatformSuperAdmin();
  const id = String(formData.get("id") || "").trim();
  const nextStatus = String(formData.get("status") || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id) || !["published", "withdrawn"].includes(nextStatus)) return;
  const [notice] = await db.select().from(platformChangeNotices).where(eq(platformChangeNotices.id, id)).limit(1);
  if (!notice || notice.status === nextStatus) return;
  // Withdrawn notices cannot be silently republished. Create an explicit new
  // revision/notice instead so historical user acknowledgements remain valid.
  if (notice.status === "withdrawn") return;
  await db.update(platformChangeNotices)
    .set({ status: nextStatus, updatedAt: new Date() })
    .where(and(eq(platformChangeNotices.id, id), eq(platformChangeNotices.status, notice.status)));
  await logAudit({
    organizationId: actor.organizationId, userId: actor.id, userName: actor.name,
    action: "update", entityType: "platform_change_notice", entityId: id,
    entityLabel: notice.title, summary: `Notice status changed from ${notice.status} to ${nextStatus}`,
    before: { status: notice.status }, after: { status: nextStatus },
  });
  revalidatePath("/platform/notices");
  revalidatePath("/notifications");
}
