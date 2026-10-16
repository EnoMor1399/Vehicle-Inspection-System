import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { requireOrganizationAccountManager } from "@/lib/require-auth";
import { getOrganizationAccountSnapshot } from "@/lib/organization-control-plane";
import {
  getBillingInvoice,
  listOrganizationBilling,
} from "@/lib/subscription-billing";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OrganizationInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireOrganizationAccountManager();
  const { id } = await params;
  const [invoice, snapshot, billing] = await Promise.all([
    getBillingInvoice(user.organizationId, id),
    getOrganizationAccountSnapshot(user.organizationId),
    listOrganizationBilling(user.organizationId),
  ]);
  if (!invoice || !snapshot.organization) notFound();

  const payments = billing.payments.filter((payment) => payment.invoiceId === invoice.id);

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-10">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/organization/billing" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950">
          <ArrowLeft className="h-4 w-4" /> Billing
        </Link>
        <button
          type="button"
          onClick={undefined}
          className="hidden"
          aria-hidden="true"
        />
        <span className="inline-flex items-center gap-2 text-xs text-slate-500">
          <Printer className="h-4 w-4" /> Use your browser Print command for a printable copy
        </span>
      </div>

      <Card className="overflow-hidden p-0 print:border-0 print:shadow-none">
        <div className="border-b border-slate-200 bg-slate-950 p-6 text-white sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">VIMS Subscription Invoice</p>
              <h1 className="mt-2 text-2xl font-semibold">{invoice.invoiceNumber}</h1>
            </div>
            <Badge tone={invoice.status === "paid" ? "emerald" : invoice.status === "overdue" ? "red" : "amber"}>
              {invoice.status}
            </Badge>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Bill to</p>
              <p className="mt-2 font-semibold text-slate-950">{snapshot.organization.name}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {[snapshot.organization.address, snapshot.organization.city, snapshot.organization.region, snapshot.organization.country]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              {snapshot.organization.email && <p className="mt-1 text-sm text-slate-600">{snapshot.organization.email}</p>}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:justify-self-end">
              <Detail label="Issued" value={formatDateTime(invoice.issuedAt)} />
              <Detail label="Due" value={invoice.dueAt ? formatDateTime(invoice.dueAt) : "—"} />
              <Detail label="Period start" value={formatDateTime(invoice.periodStart)} />
              <Detail label="Period end" value={invoice.periodEnd ? formatDateTime(invoice.periodEnd) : "Custom"} />
            </div>
          </div>

          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr><th className="py-2 pr-4">Description</th><th className="py-2 pr-4 text-right">Qty</th><th className="py-2 pr-4 text-right">Unit</th><th className="py-2 text-right">Amount</th></tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((item, index) => (
                  <tr key={`${item.description}-${index}`} className="border-b border-slate-100">
                    <td className="py-4 pr-4 font-medium text-slate-800">{item.description}</td>
                    <td className="py-4 pr-4 text-right">{item.quantity}</td>
                    <td className="py-4 pr-4 text-right">{invoice.currency} {Number(item.unitAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="py-4 text-right">{invoice.currency} {Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 ml-auto max-w-sm space-y-2 text-sm">
            <AmountRow label="Subtotal" value={invoice.subtotal} currency={invoice.currency} />
            <AmountRow label="Discount" value={invoice.discount} currency={invoice.currency} />
            <AmountRow label="Tax" value={invoice.tax} currency={invoice.currency} />
            <div className="flex items-center justify-between border-t border-slate-300 pt-3 text-base font-semibold text-slate-950">
              <span>Total</span><span>{invoice.currency} {Number(invoice.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {invoice.notes && (
            <div className="mt-7 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              <p className="font-semibold text-slate-800">Notes</p>
              <p className="mt-1">{invoice.notes}</p>
            </div>
          )}

          {payments.length > 0 && (
            <div className="mt-8">
              <h2 className="font-semibold text-slate-950">Payments</h2>
              <div className="mt-3 space-y-2">
                {payments.map((payment) => (
                  <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm">
                    <div>
                      <p className="font-mono text-xs text-slate-700">{payment.reference}</p>
                      <p className="mt-1 text-xs text-slate-500">{payment.provider} · {formatDateTime(payment.paidAt || payment.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{payment.currency} {Number(payment.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      <p className="text-xs capitalize text-slate-500">{payment.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <><span className="text-slate-400">{label}</span><span className="text-right font-medium text-white sm:text-slate-800 print:text-slate-800">{value}</span></>;
}

function AmountRow({ label, value, currency }: { label: string; value: string; currency: string }) {
  return <div className="flex items-center justify-between text-slate-600"><span>{label}</span><span>{currency} {Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>;
}
