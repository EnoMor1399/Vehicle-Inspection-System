# VIMS Platform Subscription Payments — Super Admin Control

VIMS Paystack integration is for **VIMS platform subscription fees owed by subscriber organizations**, **not** vehicle inspections, transporters, guest bookings or tenant retail sales. Do not route unrelated service payments through this ledger.

## Responsibilities

- **VIMS Super Admin:** owns the GHS subscription-plan catalog and billing cycle, assigns/updates organization subscriptions, defines per-organization billing amount and dates, approves or pauses online subscription checkout, reviews transactions, and requests independent provider verification for unresolved receipts.
- **Organization Owner:** can only pay the current, Super Admin-assigned **own organization's** subscription using Paystack-hosted Card or Ghana Mobile Money checkout, see their own payment history and check outstanding status. The checkout amount comes from the server-side subscription record.
- **Other tenant roles / scoped Super Admin operational sessions:** cannot edit platform billing plans or start platform subscription payments.

## Deliberate separation of controls

1. **Payment collection approval:** `organization_subscriptions.checkout_enabled` defaults to `false`; only an authenticated Platform Super Admin can enable it per organization. The gateway live/test environment flag remains a separate deployment operator control.
2. **Plan pricing:** Super Admin can update GHS plan catalog prices and billing cycles in `/platform/payments`; these changes apply to future subscriber assignments, not outstanding invoices or already-assigned subscription terms.
3. **Organization amount and lifecycle:** Super Admin edits per-organization amount/status/dates in `/platform/organizations/{organizationId}`. This is separate from collecting and verifying money.
4. **Payment settlement:** Paystack verification must match the reference, server-recorded GHS amount in pesewas, customer email, environment and payment channel. The Super Admin's **Verify with Paystack** action shares the canonical reconciliation logic and does not manually mark a payment as successful.
5. **Subscription entitlements:** A confirmed payment is a receipt only. Payment verification never automatically changes subscription status, tenant operational access or user permissions. Existing audited subscription lifecycle / tenant isolation gates remain in force.
6. **Emergency pause:** Disabling new checkout does not disable signed webhook delivery or the server's verification of already-initiated Paystack charges.

## Safe rollout (migration first)

This PR includes `migrations/20261025_super_admin_subscription_checkout_control.sql`. It adds one column to `organization_subscriptions` with a **fail-closed false default for every existing subscription**. This will pause new payment checkout for all existing subscriber organizations immediately after migration until approved individually.

**Do not merge/deploy without an authorized cutover:** first test migration on a verified staging Neon database, inspect live pending payments and the expected tenant population, confirm the backup/rollback plan, and ensure the migration is applied to the intended production database **before** deploying the code that selects this column. Do not run the entire historical migration script blindly in production.

Recommended release sequence:
1. Validate migration in staging with `npm run db:target`, review applied schema and confirm no tenant/ledger data has been lost.
2. Run GitHub quality + E2E tests, test a paused organization checkout and explicit Super Admin approval in an isolated test environment.
3. Reverify webhook signature, exact GHS amount, duplicate callbacks, no cross-tenant leakage, audit availability, and whether the Super Admin can pause **new** collection while an already-issued payment still settles.
4. Coordinate a maintenance window and apply the additive migration to the verified production database, leaving collection disabled by default; inspect the resulting column and backup.
5. Deploy reviewed application code, then explicitly approve selected subscriber organizations through Super Admin subscription management. Do **not** toggle Vercel `PAYSTACK_MODE`, `PAYSTACK_SECRET_KEY` or `PAYSTACK_LIVE_PAYMENTS_ENABLED` as part of this change.
6. Independently verify actual Paystack webhook reachability and merchant settlement before declaring live billing operational.

This feature has **no new recurring MoMo debit** and no automatic refunds, payouts, or chargeback resolution.
