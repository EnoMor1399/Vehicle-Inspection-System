"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function markRead(formData: FormData) {
  const user = await getCurrentUser();
  const id = String(formData.get("id") || "").trim();
  if (!id || id.length > 64) return;

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)));

  revalidatePath("/notifications");
}

export async function markAllRead() {
  const user = await getCurrentUser();
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(eq(notifications.userId, user.id));

  revalidatePath("/notifications");
}
