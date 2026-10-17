# VIMS — consolidated atomic release

Release branch: `release/vims-unified-20261017`. Source PRs: #86, #87, #88, #89, #90.

## Combined capabilities
- Super Admin MFA-gated temporary password resets with forced owner password replacement and read-only support view.
- Tenant-safe subscriber workspace activation readiness, owner invitation reissue, SMTP delivery attempts, duplicate-email detection and administrator onboarding.
- Super Admin Content Management Centre with draft/publish/restore and subscription tier management.
- Paystack hosted card/Ghana Mobile Money checkout with HMAC-validated webhook, independent verification and duplicate-payment safeguards.
- Lower-noise navigation, dashboard, login and subscriber registration screens while retaining all operational features.

## Production release plan and hard gates
1. Confirm current main SHA and release PR status. Use **one squash merge** only once the full release build, TypeScript, lint, unit, browser E2E and Docker checks pass on the exact combined commit.
2. Make a fresh Neon recovery branch from production. Verify live database name `Vehicle-Inspection-Enterprise`, organization/user/subscription counts and restore availability.
3. Apply additive migrations transactionally in order:
   - `migrations/20261017_super_admin_support_sessions.sql` (already applied in production; use idempotent rerun only if necessary)
   - `migrations/20261017_platform_content_centre.sql`
   - `migrations/20261017_subscription_payments_paystack.sql`.
   Do not clear or overwrite operational records.
4. Confirm production configuration and separate staging/prod secrets. **Keep `PAYSTACK_LIVE_PAYMENTS_ENABLED` disabled**; live payments require independent merchant sandbox test and authorization.
5. When Vercel rate limit clears, merge exactly this release PR and deploy main once. Inspect build/runtime logs and verify login, onboarding, Platform Account Support, Content Centre, payment-disabled display and mobile navigation.
6. Verify tenant isolation, role-scoped admin access and unchanged payments/organization status. Roll back the app deployment if needed without destroying additive migration tables or audit/payment evidence.

## Known operational follow-ups
- An existing Super Admin email cannot also be used for a different Organization Owner account; the owner must be invited at another approved address.
- SMTP relay acceptance does not prove inbox delivery.
- Paystack merchant test credentials have not been configured and gateway acceptance tests have not been executed; no real charging should be enabled automatically.
- Native browser screenshot review of all redesigned pages and authenticated MFA support workflow should be completed as final sign-off.

This manifest does not indicate production release until a verified deployment and database checkpoint exist.

## Vercel production release trigger — 2026-10-17

- GitHub PR #91 was squash-merged as `ecdf3aea5c7bce3fd0fa4b94b774266156fce0ff` after additive CMS and payment migrations succeeded on Neon production.
- Source `vercel.json` has an intentionally restrictive `ignoreCommand`: it cancels all single-parent commits pushed to `main`, including a reviewed squash merge. Vercel canceled the automatic build for `ecdf3aea` for exactly that reason, not because application source or schema tests failed.
- The original protective `ignoreCommand` is retained. This release-trigger PR **must be merged using the GitHub `merge` method (two-parent merge commit), NOT `squash` or `rebase`**, so Vercel builds production normally from the same code, with this runbook update.
- Confirm Vercel deployment's target is `production` and its built SHA equals the final `main` merge SHA; verify aliases and public sign-in/readiness checks before reporting a successful deployment.
- Do not enable live Paystack charges. Confirm production recovery branch `br-steep-rice-af6pjjt4` remains intact.
- For future releases, account for the ignored-build-step policy before choosing a GitHub merge strategy. Do not bypass or disable build protection globally.
