# VIMS Paystack & Ghana Mobile Money payment setup

This integration records **one-time subscription payments** via Paystack hosted checkout.
Only the Organization Owner can initiate a payment for their own company's **GHS**
subscription invoice. Available checkout channels: **card** and **mobile_money**
(MTN MoMo, ATMoney/AirtelTigo, Telecel as provided in Paystack's Ghana checkout).

## Required staging configuration

Use a dedicated test-mode Paystack account and a staging Vercel environment.
Add the following **server-side** environment variables (never commit their values):

```dotenv
PAYSTACK_SECRET_KEY=sk_test_...      # Paystack test secret; server only
PAYSTACK_MODE=test
PAYSTACK_LIVE_PAYMENTS_ENABLED=false
NEXT_PUBLIC_APP_URL=https://your-real-staging-domain.example
```

The public return URL must be HTTPS with no path/query. It is used to construct
`/organization/payments/result`. Configure Paystack's webhook URL in its
dashboard as `https://your-real-staging-domain.example/api/payments/paystack/webhook`.
Webhook signatures use the **raw request body** and the same Paystack secret
(HMAC-SHA512). Do not use a browser-origin allowlist on Paystack's server-to-server
webhook: the verified signature and server-side transaction lookup authenticate it.

Additive database migration, applied **before app deployment**:

```bash
# First verify DATABASE_URL and expected database name, then use
npm run db:upgrade
```

The controlled migration runner includes
`migrations/20261017_subscription_payments_paystack.sql`.
For a staged rollout, apply and verify that migration only on the targeted staging
database. Do not run the whole historical migration list blindly against production.

## How a subscriber pays

1. Sign in as the **Organization Owner** of the company.
2. Open **Organization Account → Pay subscription online**, or
   `/organization/payments`.
3. Review the company’s current billing amount and currency. Payments are enabled
   only for eligible positive-amount **GHS** subscriptions.
4. Select **Card payment** or **Ghana Mobile Money**, then Continue to secure Paystack checkout.
5. For **card**, enter the payment details **on Paystack’s hosted page** only.
   VIMS never requests or stores card numbers, CVVs, or PINs.
6. For **Mobile Money**, select MTN MoMo, ATMoney, or Telecel in Paystack,
   enter your MoMo-enabled number, and approve the prompt on your phone.
   Never enter your MoMo PIN on a VIMS page.
7. On return, VIMS contacts the Paystack **verification API**. A successful
   provider response is matched to the original tenant-bound invoice's
   reference, amount in pesewas, GHS currency, customer email and test/live mode.
8. Check **Payment history** for the verified status and reference. If it is
   still **processing**, wait and revisit the page instead of paying again.
   You cannot charge an already-paid subscription billing period again.
9. For problems, share the **payment reference** with the Organization Owner or
   platform support. Do **not** send bank-card details or MoMo PINs.

### Super Administrator

Go to **Platform Administration → Subscription Payments**
(`/platform/payments`) to review cross-company payment attempts and their status.
This page is read-only and available only to the Super Administrator.

## Go-live approval checklist

- [ ] Merchant identity and Ghana Mobile Money channel enabled with Paystack.
- [ ] Complete **staging** DB migration and confirm indexes, constraints, tenant FKs.
- [ ] Configure test secret, test mode, HTTPS return URL and webhook in staging.
- [ ] Sandbox tests: card success, card rejection, Mobile Money authorization,
      delayed webhook, provider timeout, network retries, duplicate webhook.
- [ ] Security tests: forged HMAC, modified payload, mismatched reference,
      amount, currency, email, test/live domain, other-tenant payment access.
- [ ] Verify a payment changes only the **payment ledger**, never user privileges,
      customer subscription plan/status or workspace tenant activation.
- [ ] Set and check an approved commercial billing period with the company. This
      integration does not start automatic recurring charges.
- [ ] Review legal receipts, refunds, chargeback/dispute notifications, invoicing
      and Paystack dashboard reconciliation procedures before accepting real money.
- [ ] Create a fresh production backup and verify the migration target.
- [ ] Obtain explicit go-live approval to set `PAYSTACK_MODE=live`,
      install `sk_live_...` **only** in Vercel's protected server environment,
      configure the **production** webhook, and set
      `PAYSTACK_LIVE_PAYMENTS_ENABLED=true`.
- [ ] Monitor signed webhook delivery, pending transactions and reconciliation
      and verify rollback without dropping the payments ledger.

## Operational safeguards

- Amount, payer identity, tenant and subscription ID originate from the server.
- Provider tokens, cards, CVVs and MoMo PINs are never persisted.
- Paystack secrets stay server-side; browser is redirected only to
  `https://checkout.paystack.com`.
- Signed webhook body is independently re-verified against the Paystack API.
- Repeated webhook callbacks are idempotent; a paid period cannot be double-paid.
- No payment can bypass the required Organization Owner, administrator invitation,
  subscription entitlement or verified tenant isolation gates.
- Only GHS payments are supported by this initial Ghana rollout. Other currencies
  require separate merchant support, currency policy and settlement checks.

Official reference:
- https://paystack.com/docs/api/transaction/
- https://paystack.com/docs/payments/webhooks/
- https://paystack.com/docs/payments/payment-channels/
