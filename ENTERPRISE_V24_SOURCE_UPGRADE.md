# VIMS Enterprise V2.4 — Source Upgrade Candidate

Status: **Source-complete candidate; not deployed to Vercel and not applied to the production database.**

This upgrade continues from the Enterprise V2.3 production baseline. The `source-only-hardening` branch is explicitly excluded from Vercel Git deployments in `vercel.json`, so GitHub validation can run without changing the live application.

## Phase 1 — Production maintenance and release safety

Completed on the V2.3 baseline and retained here:

- preview-first production cutover and administrator repair workflows;
- main-ref enforcement for production-secret workflows;
- immutable commit-SHA pins for GitHub Actions;
- explicit PostgreSQL `verify-full` TLS normalization;
- healthy-readiness verification after database upgrades;
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
- `transporter_id` PATCH requests are now actually validated and persisted instead of being silently ignored;
- vehicle PATCH rejects empty changes and returns the actual persisted state to audit logging;
- repeated decommission requests are idempotent.

## Phase 5 — Security and operations query scaling

Source preparation completed; production database execution is intentionally pending:

- partial indexes for failed-login detection by email and IP;
- active-session recency index;
- audit entity/user recency indexes;
- unread-notification recency index;
- removal of redundant non-unique session-token and API-key-hash indexes already covered by UNIQUE constraints;
- migration added to the guarded enterprise migration plan.

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

## Phase 8 — Build and regression gate

Completed in source:

- GitHub quality gate now includes a production-mode Next.js build after security policy, TypeScript, ESLint, regression tests and high-severity dependency audit pass;
- CI build uses non-secret local-only placeholder configuration and does not require the production database;
- new regression tests cover audit redaction, vehicle lifecycle policy, migration planning, webhook resolved-address rules and delegated role policy.

## Promotion requirements

Before this candidate is considered a production V2.4 release:

1. The draft PR must pass every GitHub quality-gate job, including `Production build`.
2. Review the final diff and merge intentionally to `main` only when deployment is permitted.
3. Deploy the merged release separately.
4. Run the guarded production database-upgrade workflow to apply `20260902_security_query_indexes.sql`.
5. Verify liveness, healthy database readiness, authentication, vehicle update/decommission workflows, user-access changes, webhook registration, reports and runtime errors.

Until those promotion steps occur, the live VIMS production application remains on its existing release and this document must continue to show **source-complete, not production-applied**.
