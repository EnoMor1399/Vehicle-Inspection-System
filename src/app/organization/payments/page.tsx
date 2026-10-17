import Link from "next/link";
import { CreditCard, ArrowLeft } from "lucide-react";
import { requireAuth } from "@/lib/require-auth";
import { getLatestOrganizationSubscription } from "@/lib/organization-control-plane";
import { getSubscriptionPaymentHistory, paymentsAvailable } from "@/lib/paystack-payments";
import { PaystackCheckoutForm } from "./PaystackCheckoutForm";

export const dynamic = "force-dynamic";

export default async function OrganizationPaymentsPage() {
  const user = await requireAuth();
  if (user.role !== "organization_owner") {
    return <main className="p-8 text-rose-800">Only the Organization Owner may manage subscription payments.</main>;
  }
  const [subscription, payments] = await Promise.all([
    getLatestOrganizationSubscription(user.organizationId),
    getSubscriptionPaymentHistory(user.organizationId),
  ]);
  const payAmount = subscription ? Number(subscription.subscription.amount) : 0;
  const alreadyPaid = Boolean(subscription && payments.some(row =>
    row.status === "success" &&
    row.subscriptionId === subscription.subscription.id &&
    row.billingPeriodStart.getTime() === subscription.subscription.currentPeriodStart.getTime(),
  ));
  const permitted = Boolean(subscription && subscription.subscription.currency === "GHS" &&
    Number.isFinite(payAmount) && payAmount > 0 && !alreadyPaid && paymentsAvailable());

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-10">
      <Link href="/organization/account" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"><ArrowLeft className="h-4 w-4" /> Organization Account</Link>
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-emerald-50 p-3 text-emerald-700"><CreditCard className="h-6 w-6" /></span>
        <div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Secure subscription billing</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-950">Pay subscription</h1>
          <p className="mt-2 text-sm text-slate-600">Card and mobile money payments are processed by Paystack. VIMS verifies payments before recording a receipt.</p>
        </div>
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-xl font-bold text-slate-950">{subscription?.plan.name || "Subscription unavailable"}</h2>
        <p className="mt-2 text-2xl font-bold text-emerald-800">
          {subscription ? `${subscription.subscription.currency} ${Number(subscription.subscription.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "No invoice"}
        </p>
        <p className="mb-6 mt-1 text-sm text-slate-600">Current subscription billing amount. Payments are one-time; renewals require a new checkout. No recurring MoMo deductions.</p>
        {alreadyPaid
          ? <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">This subscription billing period is already paid. Another charge is blocked.</p>
          : subscription && payAmount === 0
            ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">No online payment is due for this subscription amount. Contact the platform administrator if billing is expected.</p>
            : <PaystackCheckoutForm enabled={permitted} />}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
        <h2 className="text-lg font-bold text-slate-950">Payment history</h2>
        <p className="mt-1 text-xs text-slate-500">Payment confirmations are server-verified. A receipt alone does not bypass tenant security or workspace activation.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-sm">
            <thead><tr className="border-b text-xs uppercase tracking-wider text-slate-500">
              <th className="py-3 pr-3">Date</th><th className="py-3 pr-3">Reference</th><th className="py-3 pr-3">Method</th><th className="py-3 pr-3">Amount</th><th className="py-3">Status</th>
            </tr></thead>
            <tbody>{payments.map(item => (
              <tr key={item.id} className="border-b border-slate-100">
                <td className="py-3 pr-3">{item.createdAt.toLocaleDateString("en-GH")}</td>
                <td className="py-3 pr-3 font-mono text-xs">{item.reference}</td>
                <td className="py-3 pr-3">{item.channel === "mobile_money" ? "Mobile Money" : "Card"}</td>
                <td className="py-3 pr-3">{item.currency} {(item.amountSubunits / 100).toFixed(2)}</td>
                <td className="py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-bold ${item.status === "success" ? "bg-emerald-50 text-emerald-800" : item.status === "failed" ? "bg-rose-50 text-rose-800" : "bg-amber-50 text-amber-800"}`}>{item.status}</span>
                  {item.status === "pending" || item.status === "processing"
                    ? <Link className="ml-2 text-xs font-semibold text-blue-700 underline" href={`/organization/payments/result?reference=${encodeURIComponent(item.reference)}`}>Check status</Link>
                    : null}
                </td>
              </tr>
            ))}</tbody>
          </table>
          {!payments.length && <p className="py-5 text-sm text-slate-500">No payment attempts recorded yet.</p>}
        </div>
      </section>
    </main>
  );
}
