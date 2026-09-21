import { createHash } from "crypto";
import { desc, sql } from "drizzle-orm";
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

function canonicalAuditPayload(value: Record<string, unknown>) {
  const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
  return JSON.stringify(Object.fromEntries(entries));
}

export async function logAudit(input: AuditInput) {
  try {
    const id = newId();
    const createdAt = new Date();
    const sanitized = {
      id,
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
      createdAt,
    };

    await db.transaction(async (tx) => {
      // Serialize audit-chain writers so two simultaneous events cannot claim
      // the same predecessor.
      await tx.execute(sql`select pg_advisory_xact_lock(78654229)`);
      const [previous] = await tx
        .select({ eventHash: auditLogs.eventHash })
        .from(auditLogs)
        .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
        .limit(1);

      const previousHash = previous?.eventHash || null;
      const eventHash = createHash("sha256")
        .update(canonicalAuditPayload({
          ...sanitized,
          createdAt: createdAt.toISOString(),
          previousHash,
        }))
        .digest("hex");

      await tx.insert(auditLogs).values({
        ...sanitized,
        previousHash,
        eventHash,
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.warn(`[audit] persistence failed: ${message}`);
  }
}
