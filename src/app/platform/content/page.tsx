import Link from "next/link";
import { count, eq } from "drizzle-orm";
import { BookOpenText, ChevronLeft, CreditCard, Layers3, ShieldCheck } from "lucide-react";
import { db } from "@/db";
import { organizationSubscriptions, subscriptionPlans } from "@/db/schema";
import { requirePlatformSuperAdmin } from "@/lib/require-auth";
import { listPlatformContentDrafts } from "@/lib/platform-content";
import { PlatformContentEditor, SubscriptionPackageEditor } from "./ContentCentreForms";

export const dynamic = "force-dynamic";

export default async function PlatformContentCentrePage() {
  await requirePlatformSuperAdmin();
  const [content, plans] = await Promise.all([
    listPlatformContentDrafts(),
    db.select().from(subscriptionPlans).orderBy(subscriptionPlans.sortOrder, subscriptionPlans.name),
  ]);
  const assignments = await Promise.all(plans.map(async plan => {
    const [row] = await db.select({ n: count() }).from(organizationSubscriptions)
      .where(eq(organizationSubscriptions.planId, plan.id));
    return { ...plan, subscriberAssignments: Number(row?.n || 0) };
  }));
  const groups = Array.from(new Set(content.map(item => item.area)));

  return (
    <main className="mx-auto max-w-[1550px] space-y-7 p-4 sm:p-6 lg:p-10">
      <div>
        <Link href="/platform/organizations" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
          <ChevronLeft className="h-4 w-4" /> Platform Administration
        </Link>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Super Admin only</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Content Management Centre</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Manage shared VIMS interface copy and subscription packages without changing subscriber operational records.
              Drafts are private until published, and existing subscriber entitlements are protected.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <ShieldCheck className="mr-2 inline h-4 w-4" /> Super Administrator access enforced
          </div>
        </div>
      </div>

      <nav aria-label="Content centre sections" className="flex flex-wrap gap-3">
        <a href="#content" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:border-emerald-400"><BookOpenText className="h-4 w-4" /> Platform content</a>
        <a href="#packages" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:border-emerald-400"><CreditCard className="h-4 w-4" /> Subscription packages</a>
      </nav>

      <section id="content" className="scroll-mt-10 space-y-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><BookOpenText className="h-5 w-5" /></span>
          <div>
            <h2 className="text-xl font-bold text-slate-950">Website & interface content</h2>
            <p className="text-sm text-slate-600">Edit text in supported public and subscription-related screens. Plain text only; scripts and HTML are not rendered.</p>
          </div>
        </div>
        {groups.map(group => (
          <div key={group} className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600">{group}</h3>
            <div className="grid gap-4 lg:grid-cols-2">
              {content.filter(item => item.area === group).map(item => <PlatformContentEditor key={item.key} item={item} />)}
            </div>
          </div>
        ))}
      </section>

      <section id="packages" className="scroll-mt-10 space-y-5 border-t border-slate-200 pt-8">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><Layers3 className="h-5 w-5" /></span>
          <div>
            <h2 className="text-xl font-bold text-slate-950">Subscription packages</h2>
            <p className="text-sm text-slate-600">Create and update tiers, prices, billing cycles, capacity, modules and feature flags. Existing subscriber charges are not rewritten.</p>
          </div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          A package already linked to a subscriber cannot be archived, lose modules or features, reduce capacity, or change currency/billing cycle.
          Use Subscriber Companies to move an organization to a replacement package after reviewing usage and commercial terms.
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {assignments.map(plan => <SubscriptionPackageEditor key={plan.id} plan={plan} />)}
        </div>
        <details className="rounded-2xl border border-emerald-200 bg-white p-5">
          <summary className="cursor-pointer text-base font-bold text-emerald-800">+ Create a subscription package</summary>
          <div className="mt-5"><SubscriptionPackageEditor plan={null} /></div>
        </details>
      </section>
    </main>
  );
}
