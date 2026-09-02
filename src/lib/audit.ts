import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { newId } from "./utils";
import { normalizeClientIp } from "./request-context";
import { sanitizeAuditPayload, sanitizeAuditText } from "./audit-sanitizer";

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
      userId: sanitizeAuditText(input.userId, 36),
      userName: sanitizeAuditText(input.userName, 200),
      action: input.action,
      entityType: sanitizeAuditText(input.entityType, 100) || "unknown",
      entityId: sanitizeAuditText(input.entityId, 100),
      entityLabel: sanitizeAuditText(input.entityLabel, 300),
      summary: sanitizeAuditText(input.summary, 2_000),
      before: sanitizeAuditPayload(input.before),
      after: sanitizeAuditPayload(input.after),
      ipAddress: input.ipAddress ? normalizeClientIp(input.ipAddress) : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.warn(`[audit] persistence failed: ${message}`);
  }
}
