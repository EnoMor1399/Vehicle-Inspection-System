# VIMS Enterprise V2.4 — Source Upgrade Candidate

Status: **Source-complete candidate; not deployed and not applied to the production database.**

This upgrade continues from the Enterprise V2.3 production baseline. The `source-only-hardening` branch remains a non-deployment branch. GitHub validation, container verification and database-upgrade preparation can run without changing the live application.

## Phase 1 — Production maintenance and release safety

Completed on the V2.3 baseline and retained here:

- preview-first production cutover and administrator repair workflows;
- main-ref enforcement for production-secret workflows;
- immutable commit-SHA pins for GitHub Actions;
- explicit PostgreSQL `verify-full` TLS normalization;
- protected production environment for database maintenance;
- CI enforcement of maintenance-workflow safeguards.

## Phase 2 — Authentication and session resilience

Completed in this source candidate:

- canonical password policy with bounded environment parsing;
- session validation joins the session and active account in one database round-trip;
- disabled accounts invalidate active sessions immediately;
- API-key authentication joins the key owner in one query;
- account lookup and suspicious-login checks execute concurrently;
- security/login telemetry failures no longer turn otherwise valid authentication decisions into outages;
- session activity refresh is treated as non-critical telemetry.

## Phase 3 — Audit data protection

Completed:

- recursive redaction of passwords, secrets, tokens, API keys, authorization data, cookies and sensitive connection fields;
- cycle/depth/array/object-key protection for arbitrary audit payloads;
- bounded audit strings and payload sizes;
- normalized IP storage;
- audit persistence failures log only bounded error messages, never the sensitive audit payload.

## Phase 4 — Vehicle lifecycle and API integrity

Completed:

- new vehicles can start only in administrative states (`active` or `suspended`);
- inspection-derived states (`under_inspection`, `passed`, `failed`) cannot be manufactured through generic vehicle updates;
- inspection-derived states can leave the generic API only through decommissioning;
- decommissioned vehicles are terminal through the generic vehicle API;
- `transporter_id` PATCH requests are validated and persisted instead of being silently ignored;
- vehicle PATCH rejects empty changes and returns the persisted state to audit logging;
- repeated decommission requests are idempotent.

## Phase 5 — Security and operations query scaling

Source preparation and verification tooling completed; production database execution remains intentionally pending:

- partial indexes for failed-login detection by email and IP;
- active-session recency index;
- audit entity/user recency indexes;
- unread-notification recency index;
- removal of redundant non-unique session-token and API-key-hash indexes already covered by UNIQUE constraints;
- migration added to the guarded enterprise migration plan;
- direct database post-migration verification through `npm run db:verify`;
- the production database-upgrade workflow no longer depends on any application-host URL.

Migration: `migrations/20260902_security_query_indexes.sql`

Do **not** mark this phase production-applied until the guarded database-upgrade workflow is deliberately run after promotion.

## Phase 6 — Outbound integration and incident safety

Completed:

- webhook registration checks resolved DNS addresses as well as URL syntax;
- private, loopback, link-local, metadata, documentation and other non-public resolved addresses are rejected;
- frontend incident reports use normalized client IP, user-agent and request IDs;
- malformed or excessive Content-Length values are rejected;
- the optional error-tracking webhook is DNS-checked before delivery.

## Phase 7 — Identity and RBAC transaction safety

Completed:

- role assignment has a privilege ceiling based on the actor's current role;
- Super Administrator access remains exclusively controlled by a Super Administrator;
- user-access mutations are serialized in one database transaction;
- active Super Administrator rows are locked before last-admin checks, preventing concurrent demotions from orphaning the system;
- role, active-state and transporter-scope changes revoke sessions in the same transaction as the access update;
- audit records show whether sessions were revoked.

## Phase 8 — Build, container and regression gate

Completed in source:

- GitHub quality gate includes secret/workflow policy enforcement, TypeScript, ESLint, regression tests, high-severity dependency audit and a production-mode Next.js build;
- production dependency installation explicitly includes the build toolchain even when `NODE_ENV=production`;
- the quality gate builds both the production runtime image and the database migrator image;
- the runtime image is started locally inside GitHub Actions and `/api/health/live` must respond successfully;
- Docker image validation publishes or deploys nothing;
- Docker Compose is aligned to PostgreSQL 18 and the migration service runs both `db:upgrade` and `db:verify`;
- regression coverage includes audit redaction, vehicle lifecycle policy, migration planning, webhook resolved-address rules and delegated role policy.

## Phase 9 — Request, evidence, export and predictive-query hardening

Completed in source:

- mutating JSON APIs use a streaming bounded body reader, so oversized payloads are rejected before unbounded JSON parsing;
- the API proxy applies endpoint-aware request limits that match route policy: a small default mutation envelope, a dedicated AI compatibility envelope and a larger but bounded inspection-evidence envelope;
- malformed, forged and excessive `Content-Length` values are rejected consistently;
- inspection evidence is restricted to base64 JPEG, PNG or WebP data URLs;
- per-item, per-inspection photo counts and combined evidence size are bounded;
- the AI compatibility endpoint no longer accepts multi-megabyte image blobs it cannot analyze and no longer exposes internal error text in its response;
- CSV and XLSX exports neutralize spreadsheet formula prefixes, including whitespace/tab bypass forms;
- export display-column widths are bounded to avoid pathological spreadsheet layouts;
- predictive-maintenance fleet analysis no longer performs one history query per vehicle; a ranked batch query supplies bounded recent histories for risk calculation;
- regression tests cover bounded JSON streaming, evidence format/count limits, proxy-limit alignment and spreadsheet formula neutralization.

## Final source acceptance result

GitHub quality gate run `33627752634` passed on source head `7171d17d84b229f7ad6e890b034fcf22717e3216`:

- Secret and workflow policy scan: **PASS**
- Dependency audit: **PASS**
- TypeScript: **PASS**
- ESLint: **PASS**
- Regression tests: **PASS**
- Production build: **PASS**
- Docker runtime and migrator image build: **PASS**
- Local production-container liveness smoke: **PASS**

## Release identity

Enterprise V2.4 uses `package.json` as the source-controlled runtime release identity. The candidate reports version **2.4.0** through the existing release-version module and health endpoints.

## Host-neutral promotion requirements

Before this candidate is considered a production V2.4 release:

1. The draft PR must pass every GitHub quality-gate job, including `Production build` and `Docker image and liveness smoke`.
2. Review the final diff and promote intentionally only when a production rollout is authorized.
3. Deploy the tested container/application to the selected non-Vercel production environment, or run it through an approved equivalent production runtime.
4. Deliberately run the guarded production database-upgrade workflow to apply `20260902_security_query_indexes.sql`; the workflow must pass `db:verify` before it is considered successful.
5. Perform live post-deployment verification for database readiness, authentication, inspection and vehicle workflows, user-access changes, tenant isolation, rate limiting, reports, audit logs, integrations and runtime errors.
6. Verify backup and restore procedures against the chosen production platform before declaring the release operationally complete.

Until the production promotion steps occur, the live VIMS production application remains unchanged and this document must continue to show **source-complete, not production-applied**.
