import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { SUPPORT_COOKIE_NAME } from "@/lib/support-session";
import { ChangePasswordForm } from "./ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function RequiredPasswordChangePage() {
  if ((await cookies()).has(SUPPORT_COOKIE_NAME)) redirect("/");
  const user = await getCurrentUser({ allowPendingPasswordChange: true, allowPendingPrivileged2FA: true });
  if (!user.mustChangePassword) redirect("/");

  return (
    <main className="mx-auto max-w-lg px-5 py-12">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-950">Update your temporary password</h1>
        <p className="mt-2 mb-6 text-sm text-slate-600">
          An administrator has reset your account password. Choose a new private password to restore workspace access.
        </p>
        <ChangePasswordForm />
        <form method="POST" action="/api/auth/logout" className="mt-4">
          <button type="submit" className="text-sm font-medium text-slate-600 underline">Sign out instead</button>
        </form>
      </section>
    </main>
  );
}
