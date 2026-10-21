# VIMS: Paystack and Ghana Mobile Money integration

## Integration status
VIMS uses **Paystack hosted checkout** for one-time, GHS-denominated subscription payments. Customers may choose a card or the Ghana Mobile Money channel (subject to merchant account/channel activation). VIMS does not accept or store payment card numbers, CVVs, mobile-money PINs or OTPs.

**Release gate:** No **new live checkouts** are allowed unless all secrets are configured for the intended deployment and `PAYSTACK_LIVE_PAYMENTS_ENABLED=true`. Keep the flag `false` through staging and code review. Previously initiated transactions must remain verifiable when checkout is paused; do not remove the Paystack credential before reconciling them. Use the Paystack **test** environment first. Do not use real customer details in test transactions.

## Environment settings (server only)

| Setting | Meaning |
| --- | --- |
| `PAYSTACK_MODE=test` | Enables sandbox transactions with a test key. |
| `PAYSTACK_SECRET_KEY=sk_test_...` | Paystack test secret; configure in Vercel only, never commit it. |
| `PAYSTACK_LIVE_PAYMENTS_ENABLED=false` | Must remain disabled during staging and initial verification. |
| `NEXT_PUBLIC_APP_URL=https://your-vims-host.example` | Exact HTTPS origin receiving verified callback URLs; no path or trailing query string. |
| `PAYSTACK_MODE=live` and `PAYSTACK_SECRET_KEY=sk_live_...` | Production only, after authorization and staging sign-off. |
| `PAYSTACK_LIVE_PAYMENTS_ENABLED=true` | Explicit final live-charging control for production. |

Set `PAYSTACK_MODE` and its matching secret in each Vercel environment. **Never** use the test and live secrets in the same deployment. Do not expose secrets via `NEXT_PUBLIC_` variables. Restrict access to the Paystack account and enable MFA.

## Gateway and webhook setup

1. In the merchant Paystack dashboard, enable supported **Ghana GHS** card and mobile-money channels. Mobile Money operator options and live availability depend on the merchant account.
2. Register the Paystack webhook address as `https://YOUR-VIMS-DOMAIN/api/payments/paystack/webhook`. The endpoint accepts **POST** only.
3. Paystack signs raw event bytes with the merchant secret using HMAC-SHA512; VIMS rejects invalid signatures. It re-fetches each successful transaction from Paystack and matches reference, currency, exact pesewas, payer email, channel and test/live environment before recording settlement.
4. Use a TLS-enabled custom domain or Vercel HTTPS deployment. The provider's webhook must be publicly reachable; do not use an authentication-protected preview URL.
5. Never treat a redirect, webhook payload alone, screenshot, or customer claim as proof of payment.
6. VIMS persists a tenant-scoped attempt under a unique provider-compliant reference and prevents multiple payments for one subscription billing-period start while another attempt is pending or successful. A pending transaction with a network error must be verified before retrying.

## Customer instructions

1. Sign in as the **Organization Owner** and open **Organization Account → Pay subscription online**.
2. Review the subscription's GHS amount and billing period. No manual amount entry is permitted.
3. Choose **Card payment** or **Ghana Mobile Money**, then click **Continue to secure Paystack checkout**.
4. On Paystack's hosted checkout, complete the card or mobile money instructions. For mobile money, select the displayed operator, enter the registered phone number and approve the request on the phone. **Never enter a mobile-money PIN or card details into a VIMS form.**
5. After returning to VIMS, check the verification status. Mobile-money confirmation may take a few minutes; **do not pay again while pending**.
6. If the return link is lost, go to **Organization Account → Pay subscription online → Payment history → Check status**.
7. Save your transaction reference and contact the platform billing administrator if Paystack confirms settlement but VIMS still shows pending.

### Billing boundary
Payments are **one-time** receipts, not recurring mobile-money deductions. Successful settlement is recorded but **does not automatically activate a workspace, change roles, extend paid periods or waive tenant-isolation checks**. A subscription administrator must reconcile plan periods and invoice terms through the existing audited subscriber lifecycle.

## Test and release checklist

- Apply `migrations/20261017_subscription_payments_paystack.sql` first on an isolated Neon rehearsal branch; inspect indexes, constraints and all existing subscriber records.
- Run `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and CI browser E2E checks.
- Set **test** credentials in an isolated Vercel environment and initialize one test card checkout and one supported MoMo simulation according to Paystack's official test instructions.
- Verify webhook signature acceptance, invalid signature denial, replay idempotency, exact amount and currency matching, channel matching, tenant isolation and forbidden non-owner checkout.
- Test a customer-abandoned checkout, delayed mobile-money authorization and duplicated callback. Check that no second checkout is allowed while an attempt is unresolved.
- Test an unavailable provider and retry through **Check status**, not by blindly starting a new payment.
- Confirm verified transactions appear under the right organization in **Super Admin → Subscription Payments** and **Organization Account → Payment history**.
- Only after explicit production approval, provision production secrets, confirm the production migration/backup point, test live webhook reachability and intentionally enable `PAYSTACK_LIVE_PAYMENTS_ENABLED`.
- Monitor Paystack dashboard reconciliation, unexpected pending transactions, chargebacks and refunds. Refunds/chargebacks are **not automated** in this initial release.

Reference: https://paystack.com/docs/api/transaction/ , https://paystack.com/docs/payments/webhooks/ and https://paystack.com/docs/payments/payment-channels/ .


## Emergency pause and pending-payment recovery

- Set `PAYSTACK_LIVE_PAYMENTS_ENABLED=false` to disable new live hosted-checkout initialization. This does **not** cancel provider-side transactions that already started.
- Leave `PAYSTACK_MODE=live` and the matching protected credential available to the server while reconciling pending live transactions. Never replace a live secret with a test secret while live settlements remain unresolved.
- Keep the webhook enabled with a valid HMAC-SHA512 signature and independent Paystack verification. Status checks continue to validate tenant, GHS amount, reference, payer email, channel and mode before writing the payment ledger.
- If you rotate or revoke a credential, coordinate with Paystack and settle/reconcile outstanding transactions first; the previous signature cannot be verified after removing the correct signing key.
- Do not automatically grant subscription entitlements on receipt. Review refunds, chargebacks, invoice issuance and administrator-approved lifecycle transitions independently.

## Paystack merchant and production readiness

The screenshot of Paystack Live/Approved indicates the merchant account is approved, but it does not prove VIMS has a configured key or a reachable webhook. Confirm live Ghana Mobile Money support for MTN MoMo, ATMoney and Telecel within the merchant account; these channel options may vary.

Use only Paystack's **hosted checkout**. The VIMS website must not collect mobile-money PINs, OTPs, raw card details or passwords. Configure the production webhook as:

```text
https://YOUR-PRODUCTION-DOMAIN/api/payments/paystack/webhook
```

Run the automated `tests/paystack-live-checkout-guard.test.ts` and existing `tests/paystack-subscription-payments.test.ts` before go-live. Test invalid key/mode combinations, rejected unsigned events, duplicate callback replay, failed settlement, delayed MoMo approval, an already-paid billing period, and another organization's reference. Do not issue a live charge without an approved small-amount smoke-test plan.
