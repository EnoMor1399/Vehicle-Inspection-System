# VIMS Enterprise V2.4 — Host-Neutral Deployment and Operations Guide

## Scope

This guide covers the production-ready, non-Vercel path for the Vehicle Inspection Management System (VIMS) Enterprise V2.4.

The `source-only-hardening` branch is intentionally **not a deployment branch**. The current work may be built, tested and reviewed in GitHub without changing the live application. Production promotion must remain a separate, explicit operation.

## Supported baseline

- Node.js 22
- PostgreSQL 18
- Docker Engine with Docker Compose v2 for the recommended container path
- HTTPS termination at the selected production platform or reverse proxy
- At least 2 CPU cores and 4 GB RAM recommended for the application runtime
- Managed, encrypted backup storage for production database backups

## Required production configuration

Set secrets in the production platform or protected runtime secret store. Do not commit a production `.env` file.

Required values:

```text
DATABASE_URL
NEXT_PUBLIC_APP_URL
JWT_SECRET
SESSION_SECRET
CSRF_SECRET
API_KEY_SALT
FIELD_ENCRYPTION_KEY
CERTIFICATE_SIGNING_SECRET
```

Optional integrations may also require Upstash Redis, SMTP, object storage or error-tracking configuration.

All secret values should be independently generated. Database connections using `sslmode=require` are normalized by VIMS database-maintenance tooling to certificate-verifying TLS.

## Release validation before production

Every production candidate must first pass the GitHub `VIMS Quality Gate`:

1. committed-secret and workflow-policy scan;
2. TypeScript validation;
3. ESLint;
4. regression tests;
5. high-severity dependency audit;
6. production-mode Next.js build;
7. production runtime and migrator Docker-image build;
8. local production-container liveness smoke test.

These checks build and start artifacts inside GitHub Actions only. They do not publish or deploy them.

## Recommended container deployment path

### 1. Clone the approved release

```bash
git clone https://github.com/EnoMor1399/Vehicle-Inspection-System.git
cd Vehicle-Inspection-System
git checkout <approved-release-ref>
```

Use an reviewed commit or release tag. Do not deploy an unreviewed moving branch.

### 2. Create the production environment file

Example structure only:

```dotenv
POSTGRES_USER=vims
POSTGRES_PASSWORD=<strong-database-password>
POSTGRES_DB=vims
NEXT_PUBLIC_APP_URL=https://vims.example.com
JWT_SECRET=<independent-secret>
SESSION_SECRET=<independent-secret>
CSRF_SECRET=<independent-secret>
API_KEY_SALT=<independent-secret>
FIELD_ENCRYPTION_KEY=<independent-secret>
CERTIFICATE_SIGNING_SECRET=<independent-secret>
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

For a managed PostgreSQL service such as Neon, supply its protected `DATABASE_URL` to the application/migration runtime rather than exposing database credentials in source control.

### 3. Build the images

```bash
docker compose build app migrate
```

The application builder installs the development build toolchain even under production mode, while the final runtime image remains minimal and non-root.

### 4. Back up the database before migration

For a PostgreSQL database reachable from the deployment host:

```bash
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" > "vims-pre-2.4-$(date +%Y%m%d-%H%M%S).dump"
```

Store the dump in encrypted backup storage with access controls and a documented retention policy. A backup is not considered proven until a restore has been tested in an isolated database.

### 5. Apply and verify database upgrades

Using Docker Compose:

```bash
docker compose run --rm migrate
```

The migration service runs both:

```text
npm run db:upgrade
npm run db:verify
```

`db:verify` confirms the V2.4 security/operations indexes are present and the redundant indexes are absent. Do not continue a rollout if verification fails.

The protected GitHub `Production database upgrade` workflow is an alternative for an intentionally promoted `main` release. It is manual, main-ref-only, production-environment-protected and requires the exact confirmation phrase `APPLY_VIMS_DB_UPGRADE`.

### 6. Start the application

```bash
docker compose up -d app
```

Then inspect status and logs:

```bash
docker compose ps
docker compose logs --tail=200 app
```

### 7. Verify health

Liveness does not require a database connection:

```bash
curl -fsS https://vims.example.com/api/health/live
```

Readiness verifies the database:

```bash
curl -fsS https://vims.example.com/api/health
```

The release must report version `2.4.0`. The readiness endpoint must report `healthy` before production traffic is accepted.

The source-controlled smoke verifier can perform both checks:

```bash
VIMS_BASE_URL=https://vims.example.com EXPECTED_VERSION=2.4.0 npm run release:smoke
```

The protected `Post-deployment verification` GitHub workflow runs the same verifier against an explicitly supplied production URL and does not modify the target.

## Required post-deployment verification

After the runtime and database are live, verify all of the following before closing the release:

- Super Administrator login and session renewal/revocation;
- disabled-account rejection;
- vehicle create, update and decommission lifecycle rules;
- transporter scoping and tenant isolation;
- inspection create/update workflow and checklist navigation;
- reports and analytics generation;
- audit-log creation and sensitive-field redaction;
- rate limiting and suspicious-login controls;
- webhook/integration registration and public-address enforcement;
- notification retrieval;
- health/readiness latency and error logs;
- backup creation and isolated restore validation.

## Reverse proxy and HTTPS

Terminate HTTPS at the chosen production platform or a hardened reverse proxy. Forward the original host, client address and protocol headers. Redirect HTTP to HTTPS and enable HSTS only after HTTPS is confirmed across the intended domain/subdomains.

Do not expose PostgreSQL directly to the public internet. The provided Docker Compose file binds the local database port to `127.0.0.1`.

## Monitoring and alerting

Monitor at minimum:

- `/api/health/live` for process availability;
- `/api/health` for database readiness and latency;
- HTTP 5xx rate;
- authentication failures and account lockouts;
- database connection saturation;
- application memory/CPU;
- failed background/integration operations;
- backup success and restore-test age.

Alerting should distinguish liveness failure from database degradation so operations can identify whether the application process or a dependency is failing.

## Rollback

Application rollback and database rollback are separate decisions.

1. Stop new traffic or place the system in the chosen maintenance mode.
2. Capture current logs and database state.
3. Redeploy the last approved application image/commit if the failure is application-only.
4. Restore the pre-upgrade database backup only when a database rollback is actually required and the data-loss implications are understood.
5. Run liveness/readiness and the complete post-deployment verification checklist again.

Never restore a production database over the current database without an explicit rollback decision and a preserved copy of the current state.

## Current V2.4 promotion boundary

The source candidate may be validated and hardened in GitHub now. It must not be described as production-applied until all of these are true:

- the final GitHub quality gate is green;
- an intentional production promotion is authorized;
- the selected non-Vercel runtime is deployed;
- production database migrations pass `db:verify`;
- live post-deployment checks pass;
- backup/restore readiness is confirmed.
