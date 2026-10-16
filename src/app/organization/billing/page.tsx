import Link from "next/link";
import type { ReactNode } from "react";
import { Banknote, CreditCard, FileText, ReceiptText } from "lucide-react";
import { Badge, Card, PageHeader } from "@/components/ui";
import { requireOrganizationAccountManager } from "@/lib/require-auth";
import { getOrganizationAccountSnapshot } from "@/lib/organization-control-plane";
import {
  isPaystackConfigured,
  listOrganizationBilling,
} from "@/lib/subscription-billing";
import { formatDateTime } from "@/lib/utils";
import { PayInvoiceButton } from "./PayInvoiceButton";

export const dynamic = "force-dynamic";

function invoiceTone(status: string) {
  if (status === "paid") return "emerald" as const;
  if (status === "overdue") return "red" as const;
  if (status === "void") return "slate" as const;
  return "amber" as const;
}

function paymentTone(status: string) {
  if (status === "success") return "emerald" as const;
  if (status === "failed" || status === "reversed" || status === "refunded") return "red" as const;
  return "amber" as const;
}

export default async function OrganizationBillingPage() {
  const user = await requireOrganizationAccountManager();
  const [snapshot, billing] = await Promise.all([
    getOrganizationAccountSnapshot(user.organizationId),
    listOrganizationBilling(user.organizationId),
  ]);
  if (!snapshot.organization || !snapshot.subscription) {
    return <div className="p-8 text-sm text-red-700">Organization billing data is unavailable.</div>;
  }

  const organization = snapshot.organization;
  const subscription = snapshot.subscription;
  const onlinePayments = isPaystackConfigured();
  const outstanding = billing.invoices
    .filter((invoice) => invoice.status === "open" || invoice.status === "overdue")
    .reduce((sum, invoice) => sum + Number(invoice.total), 0);
  const paidInvoices = billing.invoices.filter((invoice) => invoice.status === "paid").length;

  return (
    <div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8 xl:p-10">
      <PageHeader
        eyebrow="Organization Billing"
        title={organization.name}
        description="Review subscription invoices, payment history and renewal status for your organization."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<CreditCard className="h-5 w-5" />} label="Plan" value={subscription.plan.name} hint={subscription.subscription.status} />
        <Metric icon={<Banknote className="h-5 w-5" />} label="Subscription amount" value={`${subscription.subscription.currency} ${Number(subscription.subscription.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`} hint={subscription.plan.billingCycle} />
        <Metric icon={<ReceiptText className="h-5 w-5" />} label="Outstanding" value={`${subscription.subscription.currency} ${outstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} hint="Open and overdue invoices" />
        <Metric icon={<FileText className="h-5 w-5" />} label="Paid invoices" value={String(paidInvoices)} hint={onlinePayments ? "Online payment available" : "Manual billing mode"} />
      </div>

      <Card className="mb-6 p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Invoices</h2>
            <p className="mt-1 text-sm text-slate-500">
              Payments are matched to the exact invoice, organization, amount and currency before settlement.
            </p>
          </div>
          <Link href="/organization/account" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
            Organization Account
          </Link>
        </div>

        {billing.invoices.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">No subscription invoices have been issued yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Invoice</th>
                  <th className="py-2 pr-4">Issued</th>
                  <th className="py-2 pr-4">Due</th>
                  <th className="py-2 pr-4">Total</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {billing.invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-slate-100">
                    <td className="py-3 pr-4">
                      <Link href={`/organization/billing/invoices/${invoice.id}`} className="font-semibold text-slate-950 hover:underline">
                        {invoice.invoiceNumber}
                      </Link>
                      <p className="mt-1 text-xs text-slate-500">{invoice.periodStart.toLocaleDateString()} {invoice.periodEnd ? `→ ${invoice.periodEnd.toLocaleDateString()}` : ""}</p>
                    </td>
                    <td className="py-3 pr-4 text-slate-600">{formatDateTime(invoice.issuedAt)}</td>
                    <td className="py-3 pr-4 text-slate-600">{invoice.dueAt ? formatDateTime(invoice.dueAt) : "—"}</td>
                    <td className="py-3 pr-4 font-medium">{invoice.currency} {Number(invoice.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="py-3 pr-4"><Badge tone={invoiceTone(invoice.status)}>{invoice.status}</Badge></td>
                    <td className="py-3">
                      {onlinePayments && (invoice.status === "open" || invoice.status === "overdue") ? (
                        <PayInvoiceButton invoiceId={invoice.id} />
                      ) : (
                        <Link href={`/organization/billing/invoices/${invoice.id}`} className="text-xs font-semibold text-slate-700 hover:underline">
                          View invoice
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-950">Payment history</h2>
        <p className="mt-1 mb-4 text-sm text-slate-500">VIMS stores payment references and settlement status, not payment-card details.</p>
        {billing.payments.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">No payments have been recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr><th className="py-2 pr-4">Reference</th><th className="py-2 pr-4">Provider</th><th className="py-2 pr-4">Amount</th><th className="py-2 pr-4">Date</th><th className="py-2">Status</th></tr>
              </thead>
              <tbody>
                {billing.payments.map((payment) => (
                  <tr key={payment.id} className="border-b border-slate-100">
                    <td className="py-3 pr-4 font-mono text-xs text-slate-700">{payment.reference}</td>
                    <td className="py-3 pr-4 capitalize">{payment.provider.replaceAll("_", " ")}</td>
                    <td className="py-3 pr-4">{payment.currency} {Number(payment.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="py-3 pr-4 text-slate-500">{formatDateTime(payment.paidAt || payment.createdAt)}</td>
                    <td className="py-3"><Badge tone={paymentTone(payment.status)}>{payment.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Metric({ icon, label, value, hint }: { icon: ReactNode; label: string; value: string; hint: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
          <p className="mt-1 text-xl font-semibold text-slate-950">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{hint}</p>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700">{icon}</span>
      </div>
    </Card>
  );
}
