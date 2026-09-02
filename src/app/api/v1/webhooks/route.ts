import { randomBytes } from "node:crypto";
import { authenticateApiRequest, json, apiError } from "@/lib/api-auth";
import { db } from "@/db";
import { webhooks } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { newId } from "@/lib/utils";
import { webhookCreateSchema, zodDetails } from "@/lib/api-schemas";
import { validateResolvedWebhookDestination, validateWebhookDestination } from "@/lib/integration-security";
import { encryptField } from "@/lib/field-encryption";

const MAX_WEBHOOKS_PER_USER = 20;

export async function GET() {
  const auth = await authenticateApiRequest({ scopes: ["admin"], permission: "users" });
  if (!auth.ok) return apiError(auth.status, auth.message);

  const rows = await db.select({
    id: webhooks.id,
    url: webhooks.url,
    events: webhooks.events,
    description: webhooks.description,
    isActive: webhooks.isActive,
    lastTriggeredAt: webhooks.lastTriggeredAt,
    failureCount: webhooks.failureCount,
    createdAt: webhooks.createdAt,
  }).from(webhooks).where(eq(webhooks.userId, auth.user.id));
  return json({ data: rows });
}

export async function POST(request: Request) {
  const auth = await authenticateApiRequest({ scopes: ["admin"], permission: "users" });
  if (!auth.ok) return apiError(auth.status, auth.message);

  try {
    const parsed = webhookCreateSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(400, "Invalid webhook payload", zodDetails(parsed.error));
    const body = parsed.data;
    const destination = validateWebhookDestination(body.url);
    if (!destination.ok) return apiError(400, destination.reason);

    const resolvedDestination = await validateResolvedWebhookDestination(destination.url);
    if (!resolvedDestination.ok) return apiError(400, resolvedDestination.reason);

    const id = newId();
    const events = [...new Set(body.events)];
    const generatedSecret = !body.secret;
    const signingSecret = body.secret || randomBytes(32).toString("base64url");

    const creation = await db.transaction(async (tx) => {
      // Serialize webhook creation per user so concurrent requests cannot bypass
      // the registration cap.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('vims:webhooks'), hashtext(${auth.user.id}))`);
      const [countRow] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(webhooks)
        .where(eq(webhooks.userId, auth.user.id));

      if (Number(countRow?.n || 0) >= MAX_WEBHOOKS_PER_USER) {
        return { ok: false as const };
      }

      await tx.insert(webhooks).values({
        id,
        userId: auth.user.id,
        url: destination.url.toString(),
        events,
        secret: encryptField(signingSecret),
        description: body.description || null,
        isActive: true,
      });
      return { ok: true as const };
    });

    if (!creation.ok) {
      return apiError(409, `Webhook registration limit reached (${MAX_WEBHOOKS_PER_USER} per user)`);
    }

    return json({
      data: {
        id,
        url: destination.url.toString(),
        events,
        ...(generatedSecret ? { signing_secret: signingSecret } : {}),
      },
    }, 201, {
      "Cache-Control": "no-store",
    });
  } catch {
    return apiError(500, "Failed to create webhook");
  }
}
