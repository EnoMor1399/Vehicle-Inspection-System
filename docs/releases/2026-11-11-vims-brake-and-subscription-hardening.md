# VIMS November 2026 — Section E and Subscription Safety Release

## Release purpose

Bring the remaining reviewed Section E brake-testing enhancement and the subscription expiry guard onto the **current** production main branch. Retain all later production implementations, including the improved A4 inspection certificate.

## Application changes

- Four **independent**, optional brake-efficiency readings for trailer head service/parking brakes and tanker/flatbed service/parking brakes (0–100%, at most two decimal places).
- Preserve zero-percent measured readings and leave unmeasured values as `NULL`; no artificial PASS/FAIL cutoffs.
- Subscription `trialing` and `grace` periods deny access when the corresponding expiry timestamp is absent, invalid, or past.
- Retain tenant-scope and authorization requirements for all inspection operations.

## Database prerequisite and non-destructive verification

The following production Neon state was **read-only verified** before building the release:
- All four new nullable `numeric(5,2)` brake columns exist on `public.inspections`.
- All four `vims_*_brake_range` constraints are validated.
- Existing inspection record count at verification: 147.

Do not reset inspection records, certificates, authorizations, users, credentials, or payments. The release contains an additive, idempotent migration in the controlled runner for environments that do not yet have the columns; the application requires the columns before deployment.

## Gates before production merge

1. Secret/policy scan and dependency audit succeed.
2. TypeScript, ESLint and regression tests succeed.
3. Next.js production build and Docker liveness succeed.
4. PostgreSQL-backed browser E2E succeeds.
5. Vercel preview for the **exact release head SHA** reaches READY.
6. GitHub branch-protection requirements accept the merge commit.

If a workflow remains queued with **zero jobs**, investigate GitHub Actions scheduling; do not bypass required checks. Re-trigger release checks after provider recovery if needed.

## Post-release verification

1. Confirm the new `main` SHA matches the promoted Vercel production deployment.
2. Confirm production deployment READY and post-deployment verification success.
3. Open a real inspection and verify independent trailer head and tanker/flatbed brake values (including 0 and blank) save and reappear in inspection details.
4. Confirm certificates still print legibly and real signed QR verification remains functional.
5. Verify users and organization subscription policies without altering live account access.
6. Check runtime errors on inspection/certificate routes.

## Rollback

If a regression occurs, revert the **application** merge commit through the standard reviewed PR and redeploy. Keep additive brake-efficiency columns intact to avoid data loss. Do not disable the fail-closed subscription guard casually; investigate affected subscription records and back up data before any remediations.

## Older draft branches

PRs #86–#90 are based on older code and conflict with current production; their newly introduced files already exist on current main. Do not merge obsolete branches over the current implementations without a detailed residual diff review.
