import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { newId } from "./utils";

export type AuditInput = {
  userId?: string | null;
  userName?: string | null;
  action: "create" | "update" | "delete" | "restore" | "archive" | "inspect" | "approve" | "reject" | "import" | "export" | "login" | "logout" | "login_failed";
  entityType: string;
  entityId?: string | null;
  entityLabel?: string | null;
  summary?: string | null;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
};

export async function logAudit(input: AuditInput) {
  try {
    await db.insert(auditLogs).values({
      id: newId(),
      userId: input.userId || null,
      userName: input.userName || null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId || null,
      entityLabel: input.entityLabel || null,
      summary: input.summary || null,
      before: input.before ?? null,
      after: input.after ?? null,
      ipAddress: input.ipAddress || null,
    });
  } catch (err) {
    console.error("audit log failed", err);
  }
}
