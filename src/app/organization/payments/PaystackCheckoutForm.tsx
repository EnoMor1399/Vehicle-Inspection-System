"use client";

import { useActionState, useEffect } from "react";
import { CreditCard, Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { startSubscriptionCheckout, type CheckoutState } from "./actions";

const initial: CheckoutState = { ok: false, message: "" };

export function PaystackCheckoutForm({ enabled }: { enabled: boolean }) {
  const [state, action, pending] = useActionState(startSubscriptionCheckout, initial);
  useEffect(() => {
    if (state.ok && state.checkoutUrl) window.location.assign(state.checkoutUrl);
  }, [state]);
  return (
    <form action={action} className="space-y-4">
      <fieldset className="grid gap-3 sm:grid-cols-2" disabled={!enabled || pending}>
        <legend className="mb-3 text-sm font-semibold text-slate-800">Choose payment method</legend>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <input required type="radio" name="channel" value="card" defaultChecked className="mt-1 h-4 w-4 accent-emerald-700" />
          <span><span className="flex items-center gap-2 text-sm font-bold text-slate-900"><CreditCard className="h-4 w-4" /> Card payment</span>
            <span className="mt-1 block text-xs leading-5 text-slate-600">Pay securely with a card on Paystack. VIMS does not store card details.</span></span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <input required type="radio" name="channel" value="mobile_money" className="mt-1 h-4 w-4 accent-emerald-700" />
          <span><span className="flex items-center gap-2 text-sm font-bold text-slate-900"><Smartphone className="h-4 w-4" /> Ghana Mobile Money</span>
            <span className="mt-1 block text-xs leading-5 text-slate-600">Choose MTN MoMo, ATMoney or Telecel on Paystack and approve the prompt on your phone.</span></span>
        </label>
      </fieldset>
      <div className="flex gap-2 rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs leading-5 text-blue-950">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        Payments are verified on the server. Never enter your MoMo PIN or card details into a VIMS form.
        Mobile Money confirmations may take a few minutes; do not pay twice while confirmation is pending.
      </div>
      {state.message && <p role={state.ok ? "status" : "alert"} className={`rounded-lg p-3 text-sm ${state.ok ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900"}`}>{state.message}</p>}
      <button type="submit" disabled={!enabled || pending}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-6 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        {pending ? "Opening secure checkout..." : "Continue to secure Paystack checkout"}
      </button>
      {!enabled && <p className="text-sm text-amber-800">Online payments are not yet enabled for this environment. Contact your administrator.</p>}
    </form>
  );
}
