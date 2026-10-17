import Link from "next/link";
import { ArrowLeft, CreditCard } from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations, subscriptionPayments, users } from "@/db/schema";
import { requirePlatformSuperAdmin } from "@/lib/require-auth";

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
  return (
    <main className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6 lg:p-10">
      <Link href="/platform/organizations" className="inline-flex items-center gap-2 text-sm text-slate-600">
        <ArrowLeft className="h-4 w-4" /> Subscriber Companies
      </Link>
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-blue-50 p-3 text-blue-700"><CreditCard className="h-6 w-6" /></span>
        <div><p className="text-xs font-bold uppercase tracking-widest text-blue-700">Super Admin billing oversight</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-950">Subscription payments</h1>
          <p className="mt-2 text-sm text-slate-600">Read-only, tenant-attributed Paystack transactions. A settled receipt does not override subscription or tenant security controls.</p></div>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b text-xs uppercase tracking-wider text-slate-500"><tr>
            <th className="p-3">Organization</th><th className="p-3">Payer</th><th className="p-3">Reference</th>
            <th className="p-3">Method</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3">Created</th>
          </tr></thead>
          <tbody>{rows.map(({payment, organizationName, payerName}) => (
            <tr key={payment.id} className="border-b border-slate-100">
              <td className="p-3 font-semibold text-slate-900">{organizationName}</td>
              <td className="p-3">{payerName}</td>
              <td className="p-3 font-mono text-xs">{payment.reference}</td>
              <td className="p-3">{payment.channel === "mobile_money" ? "Mobile Money" : "Card"}</td>
              <td className="p-3">{payment.currency} {(payment.amountSubunits / 100).toFixed(2)}</td>
              <td className="p-3 font-semibold">{payment.status}</td>
              <td className="p-3">{payment.createdAt.toLocaleString("en-GH")}</td>
            </tr>
          ))}</tbody>
        </table>
        {!rows.length && <p className="p-5 text-sm text-slate-500">There are no recorded payment attempts yet.</p>}
      </div>
    </main>
  );
}
