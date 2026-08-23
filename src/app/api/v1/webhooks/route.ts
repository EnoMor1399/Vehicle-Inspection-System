import { authenticateApiRequest, json, apiError } from "@/lib/api-auth";
import { db } from "@/db";
import { webhooks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { newId } from "@/lib/utils";
import { webhookCreateSchema, zodDetails } from "@/lib/api-schemas";
import { validateWebhookDestination } from "@/lib/integration-security";

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

    const id = newId();
    await db.insert(webhooks).values({
      id,
      userId: auth.user.id,
      url: destination.url.toString(),
      events: [...new Set(body.events)],
      secret: body.secret || null,
      description: body.description || null,
      isActive: true,
    });

    return json({ data: { id, url: destination.url.toString(), events: body.events } }, 201);
  } catch {
    return apiError(500, "Failed to create webhook");
  }
}
