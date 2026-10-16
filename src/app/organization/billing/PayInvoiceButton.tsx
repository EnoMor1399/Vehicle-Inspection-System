"use client";

import { useActionState, useEffect } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import {
  startPaystackInvoicePayment,
  type BillingPaymentActionState,
} from "./actions";

const initial: BillingPaymentActionState = { ok: false, message: "" };

export function PayInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const [state, action, pending] = useActionState(startPaystackInvoicePayment, initial);

  useEffect(() => {
    if (state.authorizationUrl) {
      window.location.assign(state.authorizationUrl);
    }
  }, [state.authorizationUrl]);

  return (
    <div className="space-y-2">
      <form action={action}>
        <input type="hidden" name="invoiceId" value={invoiceId} />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
          {pending ? "Preparing…" : "Pay online"}
        </button>
      </form>
      {state.message && !state.authorizationUrl && (
        <p className={`max-w-sm text-xs ${state.ok ? "text-emerald-700" : "text-red-700"}`}>
          {state.message}
        </p>
      )}
    </div>
  );
}
