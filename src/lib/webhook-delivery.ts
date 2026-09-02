import { createHmac, randomUUID } from "node:crypto";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { webhooks } from "@/db/schema";
import { decryptField } from "@/lib/field-encryption";
import { validateResolvedWebhookDestination, validateWebhookDestination } from "@/lib/integration-security";

export type WebhookEvent =
  | "vehicle.created"
  | "vehicle.updated"
  | "inspection.completed"
  | "inspection.failed";

const WEBHOOK_TIMEOUT_MS = 5_000;
const MAX_WEBHOOK_PAYLOAD_BYTES = 64 * 1024;

type DeliveryTarget = {
  id: string;
  url: string;
  secret: string | null;
};

type WebhookEnvelope = {
  id: string;
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
};

function pinnedPost(url: URL, address: string, body: string, headers: Record<string, string>): Promise<number> {
  return new Promise((resolve, reject) => {
    const family = isIP(address);
    if (family !== 4 && family !== 6) {
      reject(new Error("Webhook destination address is invalid"));
      return;
    }

    const requestImpl = url.protocol === "https:" ? httpsRequest : httpRequest;
    const request = requestImpl({
      protocol: url.protocol,
      hostname: address,
      port: url.port || undefined,
      method: "POST",
      path: `${url.pathname}${url.search}`,
      servername: url.hostname,
      headers: {
        ...headers,
        Host: url.host,
        "Content-Length": String(Buffer.byteLength(body)),
      },
      timeout: WEBHOOK_TIMEOUT_MS,
    }, (response) => {
      const status = response.statusCode || 0;
      response.resume();
      response.on("end", () => resolve(status));
    });

    request.on("timeout", () => request.destroy(new Error("Webhook delivery timed out")));
    request.on("error", reject);
    request.end(body);
  });
}

async function recordDelivery(targetId: string, success: boolean): Promise<void> {
  try {
    await db.update(webhooks).set({
      lastTriggeredAt: new Date(),
      failureCount: success ? 0 : sql`${webhooks.failureCount} + 1`,
    }).where(eq(webhooks.id, targetId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.warn(`[webhook] delivery bookkeeping failed: ${message}`);
  }
}

async function deliverTarget(target: DeliveryTarget, envelope: WebhookEnvelope, body: string): Promise<void> {
  let success = false;
  try {
    if (!target.secret) throw new Error("Webhook signing secret is missing");

    const destination = validateWebhookDestination(target.url);
    if (!destination.ok) throw new Error(destination.reason);

    // Resolve immediately before delivery and connect to the already-validated
    // public address. This closes the normal DNS-rebinding gap between a safety
    // lookup and the socket connection used for the outbound request.
    const resolved = await validateResolvedWebhookDestination(destination.url);
    if (!resolved.ok) throw new Error(resolved.reason);
    const address = resolved.addresses[0];
    if (!address) throw new Error("Webhook hostname did not resolve to an address");

    const secret = decryptField(target.secret);
    const signingInput = `${envelope.timestamp}.${body}`;
    const signature = createHmac("sha256", secret).update(signingInput).digest("hex");

    const status = await pinnedPost(destination.url, address, body, {
      "Content-Type": "application/json",
      "User-Agent": "RSL-VIMS-Webhook/2.4",
      "X-Webhook-ID": envelope.id,
      "X-Webhook-Event": envelope.event,
      "X-Webhook-Timestamp": envelope.timestamp,
      "X-Webhook-Signature": `sha256=${signature}`,
    });

    success = status >= 200 && status < 300;
    if (!success) throw new Error(`Webhook endpoint returned HTTP ${status}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.warn(`[webhook] delivery failed for ${target.id}: ${message}`);
  } finally {
    await recordDelivery(target.id, success);
  }
}

/**
 * Deliver a documented integration event to all active matching webhook
 * subscriptions. Delivery is intentionally best-effort: operational database
 * writes must not be rolled back because a third-party webhook is unavailable.
 */
export async function emitWebhookEvent(event: WebhookEvent, data: Record<string, unknown>): Promise<void> {
  try {
    const targets = await db.select({
      id: webhooks.id,
      url: webhooks.url,
      secret: webhooks.secret,
    }).from(webhooks).where(and(
      eq(webhooks.isActive, true),
      sql`${webhooks.events} @> ${JSON.stringify([event])}::jsonb`
    ));

    if (!targets.length) return;

    const envelope: WebhookEnvelope = {
      id: randomUUID(),
      event,
      timestamp: new Date().toISOString(),
      data,
    };
    const body = JSON.stringify(envelope);
    if (Buffer.byteLength(body) > MAX_WEBHOOK_PAYLOAD_BYTES) {
      console.warn(`[webhook] dropped oversized ${event} payload`);
      return;
    }

    await Promise.allSettled(targets.map((target) => deliverTarget(target, envelope, body)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.warn(`[webhook] event dispatch failed for ${event}: ${message}`);
  }
}
