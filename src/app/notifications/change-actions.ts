"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gt, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { platformChangeNotices, platformChangeNoticeReceipts } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";
import { getActiveSupportContext } from "@/lib/support-session";
import { newId } from "@/lib/utils";

export async function acknowledgeChangeNotice(formData: FormData) {
  const user = await requireAuth();
  // Read-only Super Admin impersonation cannot write a receipt for the target.
  if (await getActiveSupportContext()) return;
  const noticeId = String(formData.get("noticeId") || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(noticeId)) return;
  const now = new Date();
  const [notice] = await db.select({ id: platformChangeNotices.id })
    .from(platformChangeNotices)
    .where(and(
      eq(platformChangeNotices.id, noticeId),
      eq(platformChangeNotices.status, "published"),
      lte(platformChangeNotices.publishAt, now),
      or(isNull(platformChangeNotices.expiresAt), gt(platformChangeNotices.expiresAt, now)),
      or(isNull(platformChangeNotices.organizationId), eq(platformChangeNotices.organizationId, user.organizationId)),
    )).limit(1);
  if (!notice) return;

  await db.insert(platformChangeNoticeReceipts).values({
    id: newId(), noticeId, userId: user.id, organizationId: user.organizationId,
    acknowledgedAt: now,
  }).onConflictDoNothing({ target: [platformChangeNoticeReceipts.noticeId, platformChangeNoticeReceipts.userId] });
  revalidatePath("/notifications");
  revalidatePath("/");
}
