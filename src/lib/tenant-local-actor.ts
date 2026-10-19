import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

// Platform Super Administrators have a REAL actor identity which may belong
// to another organization. Never persist that user ID into a tenant-local
// staff/signer/driver assignment. Audit trails record the platform actor ID
// separately, under the target organization.
export async function tenantLocalActorUserId(user: { id: string; organizationId: string }): Promise<string | null> {
  const [member] = await db.select({ id: users.id }).from(users)
    .where(and(eq(users.id, user.id), eq(users.organizationId, user.organizationId)))
    .limit(1);
  return member?.id || null;
}
