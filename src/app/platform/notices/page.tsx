import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { organizations, platformChangeNotices } from "@/db/schema";
import { requirePlatformSuperAdmin } from "@/lib/require-auth";
import { formatDateTime } from "@/lib/utils";
import { NoticeComposer } from "./NoticeComposer";
import { changeNoticeStatus } from "./actions";

export const dynamic = "force-dynamic";

export default async function PlatformNoticesPage() {
  await requirePlatformSuperAdmin();
  const [orgs, notices] = await Promise.all([
    db.select({ id: organizations.id, name: organizations.name }).from(organizations).orderBy(organizations.name),
    db.select().from(platformChangeNotices).orderBy(desc(platformChangeNotices.createdAt)).limit(100),
  ]);
  const orgNames = new Map(orgs.map((org) => [org.id, org.name]));
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-10">
      <div>
        <Link href="/platform/content" className="text-sm text-slate-600 hover:underline">← Content Management Centre</Link>
        <h1 className="mt-2 text-2xl font-bold">Update & Change Notifications</h1>
        <p className="mt-1 text-sm text-slate-600">Send precise, targeted alerts for upcoming releases, maintenance, security changes and action deadlines. Only published notices reach users.</p>
      </div>
      <NoticeComposer organizations={orgs} />
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Notice history and scheduled delivery</h2>
        {notices.length === 0 && <p className="text-sm text-slate-500">No change notices created yet.</p>}
        {notices.map((n) => (
          <article key={n.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold">{n.title}</h3>
              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs uppercase">{n.severity} · {n.status}</span>
            </div>
            <p className="mt-1 text-sm text-slate-600">{n.summary}</p>
            <p className="mt-2 text-xs text-slate-500">
              Audience: {n.organizationId ? orgNames.get(n.organizationId) || "Unavailable subscriber" : "All subscribers"}
              {" · "}Deliver: {formatDateTime(n.publishAt)} UTC
              {" · "}Effective: {formatDateTime(n.effectiveAt)} UTC
            </p>
            {n.status !== "withdrawn" && (
              <form action={changeNoticeStatus} className="mt-3">
                <input type="hidden" name="id" value={n.id} />
                {n.status === "draft" ? (
                  <button name="status" value="published" className="rounded-lg border px-3 py-1.5 text-xs font-semibold">Publish draft</button>
                ) : (
                  <button name="status" value="withdrawn" className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700">Withdraw notice</button>
                )}
              </form>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
