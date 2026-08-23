# Vehicle Inspection Management System — Enterprise Upgrade 2.0

## Upgrade objective

This release raises the system from a functional inspection application to a more controlled enterprise platform. The upgrade focuses on security, governance, deployment reliability, API integrity, audit preservation, RFID asset identity, and a formal certificate/verification workflow.

## Major functional upgrades

### Certificate governance and verification
- Rebuilt the certificate as a formal A4 controlled document with institutional navy/gold styling, serif display typography, structured vehicle/inspection data, signature blocks, technical summary, document reference, validity dates, and print-safe layout.
- Uses the configured organization logo, name, tagline, registration number, tax ID, contact details, and theme accent instead of hard-coded branding claims.
- Removed unverified accreditation/ISO claims from the certificate and demo seed data.
- Added certificate states for roadworthy, conditional/reinspection, failed, pending authorization, and expired records.
- A roadworthiness certificate is not considered valid until configured approval and digital-signature requirements are satisfied.
- Added HMAC-SHA256 signed verification URLs and QR codes. Altering signed certificate data invalidates the old verification signature.
- Added a human-readable verification code and a public verification page that clearly distinguishes signed, unsigned legacy, invalid, archived, expired, and pending records.
- QR URLs are generated as absolute URLs when deployment headers are available, improving mobile scanning reliability.

### RFID registry
- Added a dedicated `rfid_tags` table instead of storing RFID identifiers in an unrelated vehicle field.
- Added controlled tag assignment/reassignment, active-state checks, last-scan timestamps, conflict prevention, and audit logging.
- Added read/write API operations for RFID lookup and association.

### Safer record lifecycle
- Vehicle deletion now decommissions/archives operational records rather than hard-deleting inspection history.
- Audit action typing was expanded to cover archive/restore/approve/reject and other supported governance events.

### API hardening
- Added strict Zod validation for vehicle, inspection, webhook, and RFID mutation payloads.
- API keys now use one-time generated secrets and store only an HMAC/hashed representation.
- Legacy hashes can be upgraded transparently after successful authentication.
- API keys use explicit `read`, `write`, `inspect`, and `admin` scopes.
- API-key access requires both the key scope and the owning user's current permission; removing a user's permission immediately constrains the integration credential.
- Added an API-key issuance CLI: `npm run api-key:create -- <email> <scopes> "<name>"`.
- Added webhook destination validation to reject unsafe localhost/private-network targets and embedded credentials.
- Inspection creation rejects contradictory PASS results that still contain failed checklist items.
- Inspection numbers use collision-resistant identifiers rather than count-based numbering.

## Security upgrades

### Authentication and account protection
- Removed trust in a plain user-ID cookie; application authentication uses revocable server-side sessions.
- Removed automatic production fallback/creation of a demo super-administrator.
- Disabled demo seeding in production.
- Raised the baseline password standard to 12 characters with upper/lowercase, numeric, and special-character requirements.
- Password hashing cost is configurable and defaults to 12 bcrypt rounds.
- Account lockout thresholds are driven by organization settings/environment rather than hard-coded values.
- Login and 2FA attempts are rate-limited.
- Added optional `REQUIRE_PRIVILEGED_2FA=true` policy for super administrators, administrators, and supervisors. Enroll these users before enabling the policy.
- TOTP secrets are encrypted at rest with AES-256-GCM via `FIELD_ENCRYPTION_KEY`.
- Session revocation verifies ownership and supports revoking all other sessions.

### Authorization consistency
- Per-user permission overrides are honored by API operations and key user-facing/server actions.
- Approval, audit, settings, and daily-inspection authorization now use the same centralized permission policy rather than separate hard-coded role lists.
- Administrator defaults explicitly include approval, audit, and settings permissions, while overrides can still revoke them.

### Rate limiting and request protection
- Added distributed rate limiting with Upstash Redis support for serverless/multi-instance deployments and a bounded in-memory fallback for development/single-instance use.
- API rate limits are keyed by a non-reversible SHA-256 credential fingerprint when an API key/Bearer token is supplied; otherwise they fall back to client IP.
- Rate-limit response headers are emitted for successful and throttled requests.
- Added request IDs, mutation origin allowlisting, and a 10 MB mutation body limit.
- Public certificate verification is independently rate-limited.

### Browser and deployment security
- Added enforced Content Security Policy, HSTS in production, clickjacking prevention, MIME sniffing protection, strict referrer policy, browser permissions restrictions, COOP/CORP, and removal of the framework-powered header.
- Camera and geolocation remain explicitly available to the application because they are legitimate inspection functions; microphone and payment APIs are disabled by browser policy.
- Production cryptographic secrets are validated and represented in `.env.example`.
- Docker Compose now fails fast when mandatory production secrets are missing rather than silently using weak defaults.

## Database upgrade

The enterprise release adds the RFID registry and raises the system setting default for minimum password length.

Run after backing up the database:

```bash
npm install
npm run db:upgrade
```

The migration is idempotent and is located at:

`migrations/20260820_enterprise_upgrade.sql`

## Required production secrets

Generate unique, unrelated values for at least:

- `SESSION_SECRET`
- `JWT_SECRET`
- `CSRF_SECRET`
- `API_KEY_SALT`
- `FIELD_ENCRYPTION_KEY`
- `CERTIFICATE_SIGNING_SECRET`

For multi-instance/Vercel deployments also configure:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Set `NEXT_PUBLIC_APP_URL` to the canonical HTTPS public URL so QR verification links are stable across environments.

## Recommended deployment sequence

1. Back up PostgreSQL.
2. Copy `.env.example` to the deployment environment and replace every placeholder secret.
3. Run `npm install` and retain/commit the generated `package-lock.json`.
4. Run `npm run db:upgrade`.
5. Run `npm run typecheck`, `npm run lint`, and `npm run build` (or `npm run verify`).
6. Deploy the application.
7. Enroll privileged users in 2FA.
8. Optionally set `REQUIRE_PRIVILEGED_2FA=true` after enrollment.
9. Configure Upstash Redis before horizontal/serverless production traffic.
10. Issue new integration keys with the minimum required scopes and revoke obsolete/demo credentials.
11. Generate a test PASS certificate, scan its QR code from another device, and confirm signed verification, validity, approvals, and signatures.

## Validation performed in this review environment

- TypeScript parser validation across the project completed with zero syntax diagnostics after the upgrade.
- `package.json` parses successfully.
- Known hard-coded demo API keys and unverified ISO/accreditation certificate claims were removed.
- The Docker migration path was changed from a pruned development TypeScript runner to a production-compatible Node `.mjs` migration script.

A full dependency-backed `npm run typecheck`, `npm run lint`, and `npm run build` could not be completed in this review environment because package installation did not finish within the available network/runtime window. Run `npm install` followed by `npm run verify` before production deployment.
