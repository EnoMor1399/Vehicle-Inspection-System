"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function markRead(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) return;
  await db.update(notifications).set({ readAt: new Date() }).where(eq(notifications.id, id));
  revalidatePath("/notifications");
}

export async function markAllRead() {
  await db.update(notifications).set({ readAt: new Date() });
  revalidatePath("/notifications");
}
