import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { newId } from "./utils";
import { normalizeClientIp } from "./request-context";
import { sanitizeAuditPayload, sanitizeAuditText } from "./audit-sanitizer";
import { hashAuditPayload } from "./audit-chain";

export type AuditInput = {
  organizationId?: string | null;
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
  /** Refuse the operation if the privileged intent cannot be persisted. */
  required?: boolean;
};

export async function logAudit(input: AuditInput) {
  try {
    const id = newId();

    await db.transaction(async (tx) => {
      let organizationId = sanitizeAuditText(input.organizationId, 36);
      const sanitizedUserId = sanitizeAuditText(input.userId, 36);

      if (!organizationId && sanitizedUserId) {
        const [owner] = await tx
          .select({ organizationId: users.organizationId })
          .from(users)
          .where(eq(users.id, sanitizedUserId))
          .limit(1);
        organizationId = owner?.organizationId || null;
      }

      if (!organizationId) {
        throw new Error("Organization context is required for tenant audit records");
      }

      // Chain audit events inside each organization independently. This avoids
      // coupling one subscriber's audit throughput or hash history to another.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${organizationId}))`);
      const [previous] = await tx
        .select({ eventHash: auditLogs.eventHash, createdAt: auditLogs.createdAt })
        .from(auditLogs)
        .where(and(eq(auditLogs.organizationId, organizationId), isNotNull(auditLogs.eventHash)))
        .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
        .limit(1);

      const previousHash = previous?.eventHash || null;
      const previousTime = previous?.createdAt ? new Date(previous.createdAt).getTime() : 0;
      const createdAt = new Date(Math.max(Date.now(), previousTime + 1));
      const sanitized = {
        id,
        organizationId,
        userId: sanitizedUserId,
        userName: sanitizeAuditText(input.userName, 200),
        action: input.action,
        entityType: sanitizeAuditText(input.entityType, 100) || "unknown",
        entityId: sanitizeAuditText(input.entityId, 100),
        entityLabel: sanitizeAuditText(input.entityLabel, 300),
        summary: sanitizeAuditText(input.summary, 2_000),
        before: sanitizeAuditPayload(input.before),
        after: sanitizeAuditPayload(input.after),
        ipAddress: input.ipAddress ? normalizeClientIp(input.ipAddress) : null,
        createdAt,
      };

      const eventHash = hashAuditPayload({
        ...sanitized,
        createdAt: createdAt.toISOString(),
        previousHash,
      });

      await tx.insert(auditLogs).values({
        ...sanitized,
        previousHash,
        eventHash,
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.warn(`[audit] persistence failed: ${message}`);
    if (input.required) throw new Error("Privileged operation blocked because the audit trail is unavailable");
  }
}
