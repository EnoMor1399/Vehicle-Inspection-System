import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { validateSession } from "@/lib/security";

// Protect server-rendered pages with the same revocable session used by login.
export async function requireAuth() {
  const jar = await cookies();
  const sessionToken = jar.get("rsl_session_token")?.value;
  if (!sessionToken) redirect("/login");

  const session = await validateSession(sessionToken);
  if (!session.valid || !session.userId) redirect("/login");

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId));

  if (!user || !user.isActive) redirect("/login");
  return user;
}
