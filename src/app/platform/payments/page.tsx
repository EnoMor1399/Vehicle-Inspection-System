import Link from "next/link";
import { ArrowLeft, CreditCard } from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations, subscriptionPayments, subscriptionPlans, users } from "@/db/schema";
import { requirePlatformSuperAdmin } from "@/lib/require-auth";
import { VerifyPaymentForm } from "./VerifyPaymentForm";
import { PlanPricingForm } from "./PlanPricingForm";

export const dynamic = "force-dynamic";

export default async function PlatformPaymentMonitorPage() {
  await requirePlatformSuperAdmin();
  const rows = await db.select({
    payment: subscriptionPayments,
    organizationName: organizations.name,
    payerName: users.name,
  }).from(subscriptionPayments)
    .innerJoin(organizations, eq(organizations.id, subscriptionPayments.organizationId))
    .innerJoin(users, eq(users.id, subscriptionPayments.initiatedBy))
    .orderBy(desc(subscriptionPayments.createdAt))
    .limit(200);
  const plans = await db.select().from(subscriptionPlans)
    .orderBy(subscriptionPlans.sortOrder, subscriptionPlans.name);
  const successful = rows.filter(({ payment }) => payment.status === "success");
  const unresolved = rows.filter(({ payment }) => payment.status === "pending" || payment.status === "processing");
  const receivedPesewas = successful.reduce((sum, { payment }) => sum + (payment.currency === "GHS" ? payment.amountSubunits : 0), 0);

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6 lg:p-10">
      <Link href="/platform/organizations" className="inline-flex items-center gap-2 text-sm text-slate-600">
        <ArrowLeft className="h-4 w-4" /> Subscriber Companies
      </Link>
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-blue-50 p-3 text-blue-700"><CreditCard className="h-6 w-6" /></span>
        <div><p className="text-xs font-bold uppercase tracking-widest text-blue-700">Super Admin billing oversight</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-950">Subscription payments</h1>
          <p className="mt-2 text-sm text-slate-600">Platform subscription billing only. The Super Admin approves each organization&apos;s checkout, manages subscription terms and can reverify pending Paystack payments. No one can manually mark a transaction as paid.</p></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Verified GHS collections (recent 200)</p>
          <p className="mt-1 text-2xl font-bold text-slate-950">GH₵ {(receivedPesewas / 100).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Successful payments (recent 200)</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{successful.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Awaiting verification (recent 200)</p>
          <p className="mt-1 text-2xl font-bold text-amber-700">{unresolved.length}</p>
        </div>
      </div>
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
        To approve or pause subscription collection and manage pricing, select <strong>Manage subscription</strong> for the organization. Pausing new checkout never cancels or erases pending payment verification.
      </div>
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Subscription plan catalog</h2>
          <p className="mt-1 text-sm text-slate-600">
            Set prices, billing cycles and plan availability for future subscriber assignments.
            Existing organization subscriptions keep their approved invoice amounts until the Super Admin updates them individually.
          </p>
        </div>
        {plans.map(plan => (
          <PlanPricingForm key={plan.id} plan={{
            id: plan.id,
            name: plan.name,
            currency: plan.currency,
            price: plan.price,
            billingCycle: plan.billingCycle,
            isActive: plan.isActive,
          }} />
        ))}
        {!plans.length && <p className="text-sm text-slate-500">No subscription plans have been configured.</p>}
      </section>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead className="border-b text-xs uppercase tracking-wider text-slate-500"><tr>
            <th className="p-3">Organization</th><th className="p-3">Payer</th><th className="p-3">Reference</th>
            <th className="p-3">Method</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3">Created</th><th className="p-3">Control</th>
          </tr></thead>
          <tbody>{rows.map(({payment, organizationName, payerName}) => (
            <tr key={payment.id} className="border-b border-slate-100">
              <td className="p-3 font-semibold text-slate-900">
                <p>{organizationName}</p>
                <Link className="mt-1 inline-block text-xs text-blue-700 underline" href={`/platform/organizations/${payment.organizationId}`}>Manage subscription</Link>
              </td>
              <td className="p-3">{payerName}</td>
              <td className="p-3 font-mono text-xs">{payment.reference}</td>
              <td className="p-3">{payment.channel === "mobile_money" ? "Mobile Money" : "Card"}</td>
              <td className="p-3">{payment.currency} {(payment.amountSubunits / 100).toFixed(2)}</td>
              <td className="p-3 font-semibold">{payment.status}</td>
              <td className="p-3">{payment.createdAt.toLocaleString("en-GH")}</td>
              <td className="p-3">
                {(payment.status === "pending" || payment.status === "processing")
                  ? <VerifyPaymentForm paymentId={payment.id} />
                  : <span className="text-xs text-slate-500">—</span>}
              </td>
            </tr>
          ))}</tbody>
        </table>
        {!rows.length && <p className="p-5 text-sm text-slate-500">There are no recorded payment attempts yet.</p>}
      </div>
    </main>
  );
}
