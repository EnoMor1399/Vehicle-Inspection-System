"use client";

import { useActionState } from "react";
import { verifySubscriptionPayment, type VerifySubscriptionPaymentState } from "./actions";

const initial: VerifySubscriptionPaymentState = { ok: false, message: "" };

export function VerifyPaymentForm({ paymentId }: { paymentId: string }) {
  const [state, action, pending] = useActionState(verifySubscriptionPayment, initial);
  return (
    <form action={action} className="flex min-w-36 flex-col items-start gap-1">
      <input type="hidden" name="paymentId" value={paymentId} />
      <button type="submit" disabled={pending}
        className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-50 disabled:opacity-60">
        {pending ? "Verifying…" : "Verify with Paystack"}
      </button>
      {state.message && (
        <span role={state.ok ? "status" : "alert"} className={`max-w-52 text-xs ${state.ok ? "text-emerald-800" : "text-red-700"}`}>
          {state.message}
        </span>
      )}
    </form>
  );
}
