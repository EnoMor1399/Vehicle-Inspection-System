import { db } from "@/db";
import { users, organizations } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AccountRecoveryControls } from "./AccountRecoveryControls";

export const dynamic = "force-dynamic";

export default async function AccountSupportPage() {
  const actor = await getCurrentUser();
  if (actor.role !== "super_admin" || !actor.isActive || !actor.twoFactorEnabled) {
    redirect("/");
  }
  const accounts = await db.select({
    id: users.id, name: users.name, email: users.email,
    role: users.role, isActive: users.isActive,
    organizationName: organizations.name,
  }).from(users)
    .innerJoin(organizations, eq(organizations.id, users.organizationId))
    .orderBy(asc(organizations.name), asc(users.name));

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold">Platform Account Support</h1>
      <p className="my-3 text-sm text-slate-600">Super Administrator only. Password resets revoke all active sessions. Never transmit temporary passwords over public channels.</p>
      <AccountRecoveryControls accounts={accounts.filter((item) => item.id !== actor.id && item.role !== "super_admin")} />
    </main>
  );
}
