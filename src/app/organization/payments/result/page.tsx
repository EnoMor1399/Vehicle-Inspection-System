import Link from "next/link";
import { requireAuth } from "@/lib/require-auth";
import { db } from "@/db";
import { subscriptionPayments } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { verifyAndRecordPayment } from "@/lib/paystack-payments";

export const dynamic = "force-dynamic";

export default async function PaystackResultPage({
  searchParams,
}: { searchParams: Promise<{ reference?: string; trxref?: string }> }) {
  const user = await requireAuth();
  if (user.role !== "organization_owner") {
    return <main className="p-8 text-rose-800">Only the Organization Owner may review this payment.</main>;
  }
  const { reference, trxref } = await searchParams;
  const selected = reference || trxref;
  let status: "success" | "processing" | "failed" | "pending" = "pending";
  let message = "Your payment is waiting for provider confirmation.";
  if (selected && /^vims_[a-f0-9]{32}$/.test(selected)) {
    const [record] = await db.select().from(subscriptionPayments)
      .where(and(eq(subscriptionPayments.organizationId, user.organizationId),
        eq(subscriptionPayments.reference, selected))).limit(1);
    if (record) {
      status = record.status as typeof status;
      if (status !== "success") {
        try { status = await verifyAndRecordPayment(record.reference); }
        catch { message = "We could not reach the payment provider yet. Please check your payment history shortly."; }
      }
      if (status === "success") message = "Payment verified and recorded successfully.";
      else if (status === "failed") message = "This payment did not complete. No successful payment was recorded.";
      else message = "Payment processing. If using Mobile Money, approve the request on your phone and check back.";
    } else {
      message = "The payment reference was not found for this organization.";
    }
  } else {
    message = "No valid payment reference was returned. Review your payment history.";
  }

  return (
    <main className="mx-auto max-w-xl p-6 sm:p-12">
      <section className="rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm">
        <p className={`text-xs font-bold uppercase tracking-widest ${status === "success" ? "text-emerald-700" : status === "failed" ? "text-red-700" : "text-amber-700"}`}>
          {status === "success" ? "Payment confirmed" : status === "failed" ? "Payment unsuccessful" : "Payment pending"}
        </p>
        <h1 className="mt-3 text-2xl font-bold text-slate-950">Subscription payment status</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
        <p className="mt-2 text-xs text-slate-500">Payment confirmation does not automatically grant administrator access or activate an unverified workspace.</p>
        <Link href="/organization/payments" className="mt-6 inline-flex rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white">Back to payments</Link>
      </section>
    </main>
  );
}
