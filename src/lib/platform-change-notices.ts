import "server-only";

import { and, desc, eq, gt, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { platformChangeNotices, platformChangeNoticeReceipts } from "@/db/schema";

export type NoticeViewer = { id: string; organizationId: string };

// Only published, in-window notices may be seen by members of the target
// organization. The target org is never accepted from a query string.
export async function listVisibleChangeNotices(viewer: NoticeViewer) {
  const now = new Date();
  if (!viewer.id || !viewer.organizationId) return [];
  return db.select({
    notice: platformChangeNotices,
    acknowledgedAt: platformChangeNoticeReceipts.acknowledgedAt,
  }).from(platformChangeNotices)
    .leftJoin(platformChangeNoticeReceipts, and(
      eq(platformChangeNoticeReceipts.noticeId, platformChangeNotices.id),
      eq(platformChangeNoticeReceipts.userId, viewer.id),
      eq(platformChangeNoticeReceipts.organizationId, viewer.organizationId),
    ))
    .where(and(
      eq(platformChangeNotices.status, "published"),
      lte(platformChangeNotices.publishAt, now),
      or(isNull(platformChangeNotices.expiresAt), gt(platformChangeNotices.expiresAt, now)),
      or(isNull(platformChangeNotices.organizationId), eq(platformChangeNotices.organizationId, viewer.organizationId)),
    ))
    .orderBy(desc(platformChangeNotices.publishAt))
    .limit(50);
}
