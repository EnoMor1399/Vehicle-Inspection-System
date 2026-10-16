import Link from "next/link";
import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { requireOrganizationAccountManager } from "@/lib/require-auth";
import { verifyPaystackPayment } from "@/lib/subscription-billing";

export const dynamic = "force-dynamic";

export default async function BillingVerificationPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string }>;
}) {
  const user = await requireOrganizationAccountManager();
  const query = await searchParams;
  const reference = (query.reference || "").trim();

  let result: { state: "success" | "pending" | "error"; message: string; invoiceId?: string } = {
    state: "error",
    message: "Payment reference is missing.",
  };

  if (reference) {
    try {
      const verified = await verifyPaystackPayment(reference, user.organizationId);
      if (verified.status === "success") {
        result = {
          state: "success",
          message: "Payment verified and the invoice has been settled.",
          invoiceId: verified.invoice.id,
        };
      } else {
        result = {
          state: "pending",
          message: `Payment status is ${verified.status}. No invoice value was released as paid.`,
          invoiceId: verified.invoice.id,
        };
      }
    } catch (error) {
      result = {
        state: "error",
        message: error instanceof Error ? error.message : "Unable to verify the payment.",
      };
    }
  }

  const Icon = result.state === "success" ? CheckCircle2 : result.state === "pending" ? Clock3 : XCircle;
  const classes = result.state === "success"
    ? "border-emerald-200 bg-emerald-50 text-emerald-950"
    : result.state === "pending"
      ? "border-amber-200 bg-amber-50 text-amber-950"
      : "border-red-200 bg-red-50 text-red-950";

  return (
    <main className="mx-auto max-w-xl p-4 sm:p-6 lg:py-14">
      <div className={`rounded-3xl border p-6 shadow-sm sm:p-8 ${classes}`}>
        <Icon className="h-11 w-11" />
        <h1 className="mt-4 text-2xl font-semibold">Payment verification</h1>
        <p className="mt-2 text-sm leading-6">{result.message}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          {result.invoiceId && (
            <Link href={`/organization/billing/invoices/${result.invoiceId}`} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">
              View invoice
            </Link>
          )}
          <Link href="/organization/billing" className="rounded-xl border border-current/20 bg-white/70 px-4 py-2.5 text-sm font-semibold">
            Back to billing
          </Link>
        </div>
      </div>
    </main>
  );
}
