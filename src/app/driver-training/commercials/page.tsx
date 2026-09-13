import type { ReactNode } from "react";
import { asc, desc } from "drizzle-orm";
import { BadgeDollarSign, CheckCircle2, Clock3, FileText, Send, XCircle } from "lucide-react";
import { db } from "@/db";
import { trainingQuotationItems, trainingQuotations } from "@/db/training-commercial-schema";
import { trainingRequests } from "@/db/training-request-schema";
import { Badge, Button, Card, EmptyState, PageHeader, StatCard, TextArea, TextInput as Input } from "@/components/ui";
import { requireInternalUser } from "@/lib/require-auth";
import { canManageTrainingCommercials, canViewTraining } from "@/lib/training-access";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  addTrainingQuotationItem,
  createTrainingQuotation,
  removeTrainingQuotationItem,
  transitionTrainingQuotation,
  updateTrainingQuotationPricing,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function TrainingCommercialsPage() {
  const user = await requireInternalUser();
  if (!canViewTraining(user)) {
    return <div className="p-8 text-sm text-slate-600">You do not have access to Driver Training & Assessment Services.</div>;
  }
  const canManage = canManageTrainingCommercials(user);

  const [requests, quotations, items] = await Promise.all([
    db.select().from(trainingRequests).orderBy(desc(trainingRequests.createdAt)).limit(500),
    db.select().from(trainingQuotations).orderBy(desc(trainingQuotations.createdAt)).limit(500),
    db.select().from(trainingQuotationItems).orderBy(asc(trainingQuotationItems.createdAt)).limit(3000),
  ]);

  const requestById = new Map(requests.map((request) => [request.id, request]));
  const itemsByQuotation = new Map<string, typeof items>();
  for (const item of items) {
    const list = itemsByQuotation.get(item.quotationId) || [];
    list.push(item);
    itemsByQuotation.set(item.quotationId, list);
  }

  const activeRequestIds = new Set(
    quotations
      .filter((quotation) => ["draft", "pending_approval", "approved", "sent", "accepted"].includes(quotation.status))
      .map((quotation) => quotation.requestId),
  );
  const eligibleRequests = requests.filter(
    (request) => request.requestType === "client"
      && request.status === "approved"
      && !request.scheduledSessionId
      && !activeRequestIds.has(request.id),
  );
  const awaitingApproval = quotations.filter((quotation) => quotation.status === "pending_approval").length;
  const awaitingClient = quotations.filter((quotation) => quotation.status === "sent").length;
  const accepted = quotations.filter((quotation) => quotation.status === "accepted").length;
  const expiring = quotations.filter((quotation) => {
    const days = daysUntil(quotation.validUntil);
    return ["approved", "sent"].includes(quotation.status) && days >= 0 && days <= 7;
  }).length;

  return (
    <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Training Commercials & Quotations"
        description="Control quotation versions, pricing, internal approval, client acceptance, validity, and delivery authorization for external Driver Training requests. Internal requests remain outside the commercial workflow."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Eligible requests" value={eligibleRequests.length} hint="Approved client requests needing quotation" tone="blue" icon={<FileText className="h-5 w-5" />} />
        <StatCard label="Awaiting approval" value={awaitingApproval} hint="Prepared quotes pending internal approval" tone={awaitingApproval ? "amber" : "slate"} icon={<Clock3 className="h-5 w-5" />} />
        <StatCard label="Awaiting client" value={awaitingClient} hint="Approved quotes sent for decision" tone={awaitingClient ? "violet" : "slate"} icon={<Send className="h-5 w-5" />} />
        <StatCard label="Accepted" value={accepted} hint="Commercially authorized for delivery" tone="emerald" icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard label="Expiring ≤7 days" value={expiring} hint="Approved or sent quotation validity" tone={expiring ? "red" : "slate"} icon={<BadgeDollarSign className="h-5 w-5" />} />
      </div>

      {canManage && (
        <Card className="mt-6 p-5 sm:p-6">
          <h2 className="font-semibold text-[var(--vims-ink)]">Create quotation version</h2>
          <p className="mt-1 text-sm text-[var(--vims-ink-muted)]">Create a safe zero-value draft first, then add priced lines and adjust discount/tax before submitting for approval.</p>
          {eligibleRequests.length === 0 ? (
            <div className="mt-4"><EmptyState title="No client request is ready for a new quotation" /></div>
          ) : (
            <form action={createTrainingQuotation} className="mt-5 grid gap-4 md:grid-cols-4">
              <Field label="Approved request" className="md:col-span-2">
                <select name="requestId" required className={selectClass}>
                  <option value="">Select request</option>
                  {eligibleRequests.map((request) => (
                    <option key={request.id} value={request.id}>{request.requestNumber} · {request.clientName} · {request.title}</option>
                  ))}
                </select>
              </Field>
              <Field label="Currency"><Input name="currency" defaultValue="GHS" maxLength={3} required /></Field>
              <Field label="Valid until"><Input name="validUntil" type="date" required /></Field>
              <Field label="Commercial terms" className="md:col-span-2"><TextArea name="terms" maxLength={8000} className="min-h-[90px]" placeholder="Payment terms, inclusions, exclusions, cancellation terms..." /></Field>
              <Field label="Internal notes" className="md:col-span-2"><TextArea name="notes" maxLength={4000} className="min-h-[90px]" /></Field>
              <div className="md:col-span-4 flex justify-end"><Button type="submit"><FileText className="h-4 w-4" /> Create draft quotation</Button></div>
            </form>
          )}
        </Card>
      )}

      <section className="mt-6 space-y-5">
        {quotations.length === 0 ? (
          <Card className="p-5"><EmptyState title="No training quotations" description="Create a quotation from an approved client request." /></Card>
        ) : quotations.map((quotation) => {
          const request = requestById.get(quotation.requestId);
          const quotationItems = itemsByQuotation.get(quotation.id) || [];
          const expired = daysUntil(quotation.validUntil) < 0;
          return (
            <Card key={quotation.id} className="overflow-hidden">
              <div className="border-b border-[var(--vims-line)] px-5 py-4 sm:px-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-[var(--vims-ink)]">{quotation.quotationNumber}</h2>
                      <Badge tone={statusTone(quotation.status)}>{quotation.status.replaceAll("_", " ")}</Badge>
                      {expired && quotation.status !== "accepted" && <Badge tone="red">validity expired</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-[var(--vims-ink-soft)]">{request?.requestNumber || quotation.requestId} · {request?.clientName || "Client"} · version {quotation.versionNumber}</p>
                    <p className="mt-1 text-xs text-[var(--vims-ink-muted)]">Valid until {formatDate(quotation.validUntil)} · Created {formatDateTime(quotation.createdAt)}</p>
                  </div>
                  <div className="text-left lg:text-right">
                    <p className="text-2xl font-bold text-[var(--vims-ink)]">{money(quotation.currency, Number(quotation.totalAmount))}</p>
                    <p className="text-xs text-[var(--vims-ink-muted)]">Subtotal {money(quotation.currency, Number(quotation.subtotal))} · Discount {money(quotation.currency, Number(quotation.discountAmount))} · Tax {money(quotation.currency, Number(quotation.taxAmount))}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[1.4fr_.6fr]">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--vims-ink)]">Quotation lines</h3>
                  <div className="mt-3 space-y-2">
                    {quotationItems.length === 0 ? <EmptyState title="No priced lines yet" /> : quotationItems.map((item) => (
                      <div key={item.id} className="flex flex-col gap-2 rounded-xl border border-[var(--vims-line)] bg-[var(--vims-panel-soft)] p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-[var(--vims-ink)]">{item.description}</p>
                          <p className="text-xs text-[var(--vims-ink-muted)]">{item.itemType.replaceAll("_", " ")} · {Number(item.quantity)} × {money(quotation.currency, Number(item.unitPrice))}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <strong className="text-sm text-[var(--vims-ink)]">{money(quotation.currency, Number(item.lineTotal))}</strong>
                          {canManage && quotation.status === "draft" && (
                            <form action={removeTrainingQuotationItem}><input type="hidden" name="itemId" value={item.id} /><Button type="submit" size="sm" variant="secondary">Remove</Button></form>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {canManage && quotation.status === "draft" && (
                    <form action={addTrainingQuotationItem} className="mt-4 grid gap-3 md:grid-cols-5">
                      <input type="hidden" name="quotationId" value={quotation.id} />
                      <Field label="Type"><select name="itemType" required className={selectClass}><option value="training_fee">Training fee</option><option value="assessment">Assessment</option><option value="certificate">Certificate</option><option value="logistics">Logistics</option><option value="materials">Materials</option><option value="travel">Travel</option><option value="accommodation">Accommodation</option><option value="equipment">Equipment</option><option value="other">Other</option></select></Field>
                      <Field label="Description" className="md:col-span-2"><Input name="description" required maxLength={500} /></Field>
                      <Field label="Quantity"><Input name="quantity" type="number" min="0.01" step="0.01" defaultValue="1" required /></Field>
                      <Field label="Unit price"><Input name="unitPrice" type="number" min="0" step="0.01" required /></Field>
                      <div className="md:col-span-5 flex justify-end"><Button type="submit" size="sm">Add quotation line</Button></div>
                    </form>
                  )}
                </div>

                <div className="space-y-4">
                  {canManage && quotation.status === "draft" && (
                    <form action={updateTrainingQuotationPricing} className="grid gap-3 rounded-xl border border-[var(--vims-line)] p-4 sm:grid-cols-2">
                      <input type="hidden" name="quotationId" value={quotation.id} />
                      <Field label="Valid until"><Input name="validUntil" type="date" defaultValue={quotation.validUntil} required /></Field>
                      <Field label="Discount"><Input name="discountAmount" type="number" min="0" step="0.01" defaultValue={Number(quotation.discountAmount)} /></Field>
                      <Field label="Tax rate %"><Input name="taxRate" type="number" min="0" max="100" step="0.001" defaultValue={Number(quotation.taxRate)} /></Field>
                      <div className="flex items-end"><Button type="submit" size="sm" variant="secondary">Update pricing</Button></div>
                    </form>
                  )}

                  <div className="rounded-xl border border-[var(--vims-line)] bg-[var(--vims-panel-soft)] p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--vims-ink-muted)]">Commercial controls</p>
                    <p className="mt-2 text-sm text-[var(--vims-ink-soft)]">Client requests cannot be scheduled until a quotation is accepted and still within its validity period. Acceptance authorizes delivery but does not create the training session.</p>
                  </div>
                  {quotation.terms && <div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--vims-ink-muted)]">Terms</p><p className="mt-1 whitespace-pre-wrap text-sm text-[var(--vims-ink-soft)]">{quotation.terms}</p></div>}
                  {quotation.clientDecisionNotes && <div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--vims-ink-muted)]">Client decision notes</p><p className="mt-1 whitespace-pre-wrap text-sm text-[var(--vims-ink-soft)]">{quotation.clientDecisionNotes}</p></div>}
                  {quotation.acceptedAt && <p className="text-xs text-[var(--vims-ink-muted)]">Accepted by {quotation.acceptedByName} {quotation.acceptedByEmail ? `· ${quotation.acceptedByEmail}` : ""} · {formatDateTime(quotation.acceptedAt)}</p>}
                  {canManage && <QuotationActions quotation={quotation} expired={expired} />}
                </div>
              </div>
            </Card>
          );
        })}
      </section>
    </div>
  );
}

function QuotationActions({ quotation, expired }: { quotation: typeof trainingQuotations.$inferSelect; expired: boolean }) {
  if (quotation.status === "draft") return <div className="flex flex-wrap gap-2"><TransitionButton id={quotation.id} status="pending_approval" label="Submit for approval" /><TransitionButton id={quotation.id} status="cancelled" label="Cancel" secondary /></div>;
  if (quotation.status === "pending_approval") return <div className="flex flex-wrap gap-2"><TransitionButton id={quotation.id} status="approved" label="Approve quotation" /><TransitionButton id={quotation.id} status="draft" label="Return to draft" secondary /><TransitionButton id={quotation.id} status="cancelled" label="Cancel" secondary /></div>;
  if (quotation.status === "approved") return <div className="flex flex-wrap gap-2"><TransitionButton id={quotation.id} status="sent" label="Mark as sent" /><TransitionButton id={quotation.id} status="superseded" label="Supersede" secondary /><TransitionButton id={quotation.id} status="cancelled" label="Cancel" secondary /></div>;
  if (quotation.status === "sent") return (
    <div className="space-y-3">
      <form action={transitionTrainingQuotation} className="space-y-3 rounded-xl border border-[var(--vims-line)] p-3">
        <input type="hidden" name="quotationId" value={quotation.id} /><input type="hidden" name="status" value="accepted" />
        <Field label="Accepted by"><Input name="acceptedByName" required maxLength={200} /></Field>
        <Field label="Acceptance email"><Input name="acceptedByEmail" type="email" maxLength={200} /></Field>
        <Field label="Acceptance notes"><TextArea name="decisionNotes" maxLength={4000} /></Field>
        <Button type="submit" disabled={expired}><CheckCircle2 className="h-4 w-4" /> Record client acceptance</Button>
      </form>
      <form action={transitionTrainingQuotation} className="space-y-2">
        <input type="hidden" name="quotationId" value={quotation.id} /><input type="hidden" name="status" value="rejected" />
        <Field label="Rejection reason"><TextArea name="decisionNotes" required maxLength={4000} /></Field>
        <Button type="submit" variant="secondary"><XCircle className="h-4 w-4" /> Record rejection</Button>
      </form>
      {expired && <TransitionButton id={quotation.id} status="expired" label="Mark expired" secondary />}
    </div>
  );
  return null;
}

function TransitionButton({ id, status, label, secondary = false }: { id: string; status: string; label: string; secondary?: boolean }) {
  return <form action={transitionTrainingQuotation}><input type="hidden" name="quotationId" value={id} /><input type="hidden" name="status" value={status} /><Button type="submit" size="sm" variant={secondary ? "secondary" : undefined}>{label}</Button></form>;
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`block ${className}`}><span className="mb-1.5 block text-xs font-semibold text-[var(--vims-ink-soft)]">{label}</span>{children}</label>;
}

function money(currency: string, amount: number) {
  try {
    return new Intl.NumberFormat("en-GH", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function daysUntil(date: string) {
  const end = new Date(`${date}T23:59:59.999Z`).getTime();
  return Math.ceil((end - Date.now()) / 86_400_000);
}

function statusTone(status: string): "slate" | "blue" | "amber" | "emerald" | "red" | "violet" {
  if (status === "accepted") return "emerald";
  if (status === "rejected" || status === "cancelled" || status === "expired") return "red";
  if (status === "pending_approval") return "amber";
  if (status === "sent") return "violet";
  if (status === "approved") return "blue";
  return "slate";
}

const selectClass = "min-h-10 w-full rounded-lg border border-[var(--vims-line)] bg-[var(--vims-panel-solid)] px-3 text-sm text-[var(--vims-ink)] outline-none focus:border-[var(--vims-primary)]";
