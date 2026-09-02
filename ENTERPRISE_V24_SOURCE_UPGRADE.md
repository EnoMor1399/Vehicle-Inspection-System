# VIMS Enterprise V2.4 — Source Upgrade Completion Record

Status: **SOURCE COMPLETE THROUGH PHASE 16 — NOT DEPLOYED AND NOT APPLIED TO THE PRODUCTION DATABASE.**

This record covers the completed Enterprise V2.4 source-hardening program on the `source-only-hardening` branch. The branch is intentionally host-neutral and non-deploying. GitHub validation, container verification, migration preparation, release tooling, and security regression coverage may run without changing the live VIMS application or production database.

## Phase 1 — Production maintenance and release safety

Completed:

- protected, deliberate production maintenance workflows;
- main-ref enforcement for production-secret operations;
- immutable commit-SHA pins for GitHub Actions;
- explicit PostgreSQL TLS normalization;
- protected production environment boundaries;
- CI enforcement of maintenance-workflow safeguards;
- removal of hard dependency on a Vercel production URL from release/database maintenance tooling.

## Phase 2 — Authentication and session resilience

Completed:

- canonical bounded password policy;
- session validation joins session and active account state in one database round-trip;
- disabled accounts invalidate active sessions immediately;
- API-key authentication validates the active key owner;
- account lookup and suspicious-login checks execute concurrently;
- security/login telemetry failures cannot convert an otherwise valid authentication decision into an outage;
- session activity refresh is non-critical telemetry.

## Phase 3 — Audit data protection

Completed:

- recursive redaction of passwords, secrets, tokens, API keys, authorization data, cookies, and sensitive connection fields;
- cycle/depth/array/object-key protection for arbitrary audit payloads;
- bounded audit strings and payload sizes;
- normalized IP storage;
- audit persistence failures log only bounded error information, not sensitive payloads.

## Phase 4 — Vehicle lifecycle and API integrity

Completed:

- new vehicles may start only in administrative states;
- inspection-derived states cannot be manufactured through generic vehicle updates;
- inspection-derived states may leave the generic API only through approved decommissioning behavior;
- decommissioned vehicles are terminal through generic vehicle mutation paths;
- transporter changes are validated and persisted;
- empty vehicle PATCH requests are rejected;
- repeated decommission requests are idempotent;
- persisted state is used for audit logging.

## Phase 5 — Security and operations query scaling

Source preparation completed; production execution intentionally pending:

- failed-login query indexes by email and IP;
- active-session recency index;
- audit entity/user recency indexes;
- unread-notification recency index;
- redundant indexes already covered by UNIQUE constraints removed from the migration plan;
- guarded migration and direct post-migration verification tooling;
- host-neutral production database-upgrade workflow.

Migration: `migrations/20260902_security_query_indexes.sql`

Do not mark this phase production-applied until the guarded production database-upgrade workflow is deliberately executed after promotion.

## Phase 6 — Outbound integration and incident safety

Completed:

- webhook registration validates resolved DNS addresses as well as URL syntax;
- private, loopback, link-local, metadata, documentation, and other non-public destinations are rejected;
- frontend incident reports use normalized and bounded request metadata;
- malformed or excessive Content-Length values are rejected;
- optional error-tracking webhook destinations are DNS-checked before delivery.

## Phase 7 — Identity and RBAC transaction safety

Completed:

- delegated role assignment has a privilege ceiling based on the actor’s current role;
- Super Administrator control remains exclusive to Super Administrators;
- user-access mutations are serialized transactionally;
- active Super Administrator rows are locked before last-admin checks;
- role, active-state, and transporter-scope changes revoke sessions in the same transaction;
- audit records reflect sensitive access changes and session revocation.

## Phase 8 — Build, container and regression gate

Completed:

- GitHub quality gate includes secret/workflow policy enforcement, TypeScript, ESLint, regression tests, high-severity dependency audit, and production Next.js build;
- production build explicitly installs required build tooling;
- CI builds both the runtime and database migrator images;
- the production container must answer `/api/health/live` during the CI smoke test;
- Docker verification publishes or deploys nothing;
- Docker Compose is aligned to PostgreSQL 18 and the migration service runs both upgrade and verification;
- CI concurrency prevents stale duplicate quality runs.

## Phase 9 — Request, evidence, export and predictive-query hardening

Completed:

- mutating JSON APIs use streaming bounded body reads;
- endpoint-aware proxy limits match API payload policies;
- malformed, forged, and excessive Content-Length values are rejected consistently;
- inspection evidence is restricted to bounded base64 JPEG, PNG, or WebP data URLs;
- per-item, per-inspection, and aggregate evidence limits are enforced;
- AI compatibility input is bounded and internal error text is not disclosed;
- CSV/XLSX exports neutralize spreadsheet formula prefixes, including whitespace/tab bypass forms;
- spreadsheet display widths are bounded;
- predictive-maintenance history queries are batched rather than executed N+1 per vehicle.

## Phase 10 — Public verification and horizontal-access protection

Completed:

- public certificate verification requires a valid cryptographic signature;
- unsigned, malformed, unknown, and tampered links return one generic failure state;
- public verification discloses only minimum authenticity and validity facts;
- VIN, chassis details, owner/transporter details, and handwritten signature images are not exposed publicly;
- transporter-scoped certificate and inspection access remains enforced;
- daily-inspection direct-ID reads require permission for internal users and transporter scope for portal users.

## Phase 11 — Browser submission, evidence and import hardening

Completed:

- comprehensive and daily inspection Server Actions share bounded evidence/signature policies with API paths;
- handwritten signatures are restricted to bounded PNG data URLs;
- comprehensive inspection attachments are limited to bounded PDF/JPEG/PNG payloads with MIME and decoded-size checks;
- daily pre-trip text, dates, odometer, checklist, notes, evidence, and signatures are validated and bounded;
- import files, rows, and mappings are runtime-validated;
- integer imports reject partially numeric values;
- repeated vehicle/transporter reference lookups are batched;
- authenticated HTML/API responses remain excluded from persistent service-worker caches.

## Phase 12 — Administrative mutation and configuration safety

Completed:

- system settings use a strict server-side whitelist;
- password minimums cannot be lowered below the V2.4 security floor;
- security timers, login limits, certificate periods, and reminder windows are bounded;
- theme colours, organization URLs, and contact fields are validated;
- logo payloads are restricted to bounded raster data rather than active SVG content;
- web vehicle create/update follows the same lifecycle policy as API paths;
- transporter references are validated before persistence;
- transporter and station Server Actions use runtime schemas;
- transporter direct-detail access closes low-privilege alternate read paths;
- API-key generation validates scope and expiry strictly;
- notification, API-key, and session mutation identifiers are bounded before database use.

## Phase 13 — 2FA enrollment protection

Completed:

- authenticator enrollment and verification use dedicated two-factor rate limits;
- verification attempts are bounded by the existing policy;
- accounts with 2FA already enabled cannot silently replace the enrolled secret by re-running setup;
- enrollment failures emit security telemetry without exposing secret material.

## Phase 14 — Reporting, export and Power BI authorization hardening

Completed:

- reports are protected by reporting RBAC;
- CSV/XLSX exports use centralized spreadsheet formula neutralization and bounded widths;
- default Power BI datasets use explicit least-privilege field allow-lists;
- VIN/chassis details and sensitive transporter tax/contact fields are not silently disclosed by default datasets;
- OData/Power BI query behavior is validated and bounded;
- expensive count queries run only when explicitly requested where applicable;
- generated integration destinations do not trust spoofable forwarded request hosts;
- unexpected reporting failures return generic server errors rather than raw internals;
- regression coverage verifies reporting disclosure and export safety.

## Phase 15 — Frontend telemetry and recovery hardening

Completed:

- frontend error telemetry is bounded server-side;
- chunked or no-length requests cannot bypass the telemetry request limit;
- ErrorBoundary payload shape is aligned with the strict server schema;
- recovery navigation uses safe application destinations rather than attacker-controlled values;
- regression coverage verifies error-telemetry bounds and schema alignment.

## Phase 16 — Signed webhook delivery and event parity

Completed:

- vehicle and inspection webhook delivery uses HMAC-SHA256 signatures;
- webhook secrets remain encrypted at rest;
- destinations are revalidated and re-resolved immediately before every delivery;
- outbound sockets connect to an already validated public address while preserving TLS SNI/Host identity;
- automatic redirects are not followed;
- network timeout and payload size are bounded;
- webhook payloads use minimum-data disclosure;
- success/failure bookkeeping updates delivery state safely;
- REST and web-admin mutation paths emit the same documented vehicle/inspection events;
- unsupported subscription contracts are removed rather than advertised;
- regression coverage verifies registration policy, DNS/SSRF controls, signing, and event emission parity.

## Source acceptance requirements

Every current PR head must pass the `VIMS Quality Gate`, including:

- secret and workflow policy scan;
- high-severity dependency audit;
- TypeScript validation;
- ESLint;
- regression tests;
- production Next.js build;
- Docker runtime image build;
- Docker migrator image build;
- running production-container liveness smoke.

The authoritative latest run and source head are recorded on PR #14 so this document does not become stale after documentation-only commits.

## Release identity

Enterprise V2.4 uses `package.json` as the source-controlled release identity and remains version **2.4.0**.

## Source-only completion boundary

The planned source-hardening program is **complete through Phase 16**. No additional source phase is currently documented as outstanding in this V2.4 roadmap.

The following are intentionally production-only and remain pending until a later explicit rollout request:

1. select and provision the approved non-Vercel production runtime;
2. promote/merge the release intentionally without triggering an unauthorized deployment path;
3. deploy the tested application/container to that runtime;
4. capture a production backup and deliberately execute the guarded database upgrade;
5. pass `npm run db:verify` against production;
6. pass host-neutral post-deployment smoke verification;
7. run live authentication, tenant/isolation, inspection, vehicle, reporting, audit, and integration checks;
8. prove backup/restore readiness;
9. activate production monitoring, logging, backup scheduling, alert ownership, and operational sign-off.

Until those production-only steps are explicitly authorized and executed, VIMS Enterprise V2.4 must continue to be described as **source complete, not production applied**.
