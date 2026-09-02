# VIMS Enterprise V2.4 — Production Readiness Checklist

## Status

**Source candidate: READY — COMPLETE THROUGH PHASE 16**  
**Production rollout: NOT EXECUTED**

The Enterprise V2.4 source candidate has completed the planned source-hardening phases. Production deployment, production database migration and live-environment verification remain intentionally separate and have not been executed as part of this source-only upgrade. The exact latest GitHub quality-gate run and source head are recorded on draft PR #14.

## 1. Security and identity

- [x] Authentication and session management
- [x] Active-account validation during authenticated requests
- [x] Disabled-account session invalidation
- [x] Canonical password policy
- [x] Failed-login and account-protection controls
- [x] Role-based access control and privilege ceiling
- [x] Super Administrator last-admin transaction protection
- [x] Session revocation on sensitive access changes
- [x] API-key authentication with active-owner validation
- [x] Strict API-key generation scope/expiry validation
- [x] API-key and session mutation ownership enforcement
- [x] 2FA enrollment and verification rate limiting
- [x] Prevention of silent 2FA secret overwrite on already-enabled accounts
- [x] CSRF and request-security controls
- [x] API/request rate limiting
- [x] Endpoint-aware mutation body limits
- [x] Streaming JSON size enforcement before parsing
- [x] Frontend error telemetry uses the same streaming body bound for chunked/no-length requests
- [x] ErrorBoundary telemetry payload matches the strict server schema
- [x] Sensitive audit payload redaction and bounds
- [x] Workflow committed-secret scan
- [x] GitHub Actions pinned to immutable commit SHAs
- [ ] Independent production penetration/security assessment

## 2. Vehicle and inspection integrity

- [x] Vehicle administrative-state creation rules
- [x] Inspection-derived vehicle states protected from generic API updates
- [x] Inspection-derived vehicle states protected from web Server Action updates
- [x] Decommissioned vehicle terminal-state enforcement
- [x] Idempotent vehicle decommission operation
- [x] Transporter references validated before vehicle persistence
- [x] Transporter changes validated and persisted
- [x] Empty vehicle PATCH rejection
- [x] Persisted-state audit logging
- [x] Inspection evidence restricted to JPEG/PNG/WebP base64 data URLs
- [x] Per-item and aggregate evidence-count/size limits
- [x] Browser comprehensive-inspection evidence/signature validation
- [x] Browser daily pre-trip evidence/signature/input validation
- [x] Comprehensive inspection attachment MIME and decoded-size verification
- [x] Regression tests for lifecycle, evidence and direct-access policy
- [ ] Live production CRUD and inspection-flow verification after deployment

## 3. Public verification and data isolation

- [x] Signed certificate verification links required before public record disclosure
- [x] Unsigned, malformed, unknown and tampered verification requests return one generic failure state
- [x] Public certificate verification exposes only minimum authenticity/validity facts
- [x] Public verification does not expose VIN/chassis details or handwritten signature images
- [x] Transporter-scoped vehicle, inspection and certificate access controls
- [x] Daily-inspection direct-ID permission check for internal users
- [x] Transporter direct-detail authorization for internal and portal users
- [x] Authenticated/API responses excluded from service-worker persistence
- [ ] Live tenant/isolation verification after deployment

## 4. Database and migrations

- [x] PostgreSQL 18 source/runtime baseline
- [x] Connection pooling
- [x] Ordered enterprise migration runner
- [x] V2.4 failed-login, session, audit and notification indexes prepared
- [x] Redundant session/API-key indexes removed by migration plan
- [x] Direct post-migration verifier (`npm run db:verify`)
- [x] Guarded manual production database-upgrade workflow
- [x] Database workflow is host-neutral and does not call a deployment URL
- [x] Predictive-maintenance fleet analysis removes per-vehicle N+1 history queries
- [ ] Production V2.4 migration executed
- [ ] Production `db:verify` result recorded
- [ ] Pre-upgrade production backup captured
- [ ] Isolated restore drill completed and documented
- [ ] Production slow-query/latency baseline captured after rollout

## 5. Imports, settings and administrative mutations

- [x] Import file/row/mapping envelopes validated server-side
- [x] Import row counts bounded by entity type
- [x] Strict integer parsing rejects partially numeric values
- [x] Import vehicle/transporter reference lookups batched
- [x] System-settings updates use a strict server-side whitelist
- [x] Password minimum cannot be lowered below V2.4 security floor
- [x] Security timers, login limits and operational periods bounded server-side
- [x] Theme colors, URLs and contact fields validated and bounded
- [x] Logo payload restricted to bounded raster images; active SVG content rejected
- [x] Transporter and station Server Actions use runtime schemas
- [x] Notification, API-key and session identifiers bounded before database use
- [ ] Live administrative workflow verification after deployment

## 6. Reporting, exports and information disclosure

- [x] Reports page protected by reporting RBAC
- [x] Reports CSV/XLSX exports use centralized spreadsheet formula neutralization
- [x] Spreadsheet column-width bounds
- [x] Power BI default datasets use explicit least-privilege field allow-lists
- [x] VIN/chassis and transporter TIN/contact/mobile/email data are not silently exposed by default reporting datasets
- [x] Power BI query behavior is bounded and validated
- [x] Count queries run only when explicitly requested where applicable
- [x] Power BI generated integration destinations do not trust spoofable forwarded request hosts
- [x] Unexpected Power BI failures return generic server errors instead of raw internals
- [x] Regression tests cover reporting disclosure and export formula safety
- [ ] Live production reporting/export verification after deployment

## 7. Integrations, webhook delivery and incident safety

- [x] Webhook URL validation during registration
- [x] DNS-aware public-address enforcement for outbound integrations
- [x] Private/loopback/link-local/metadata destinations rejected
- [x] Webhook signing secrets encrypted at rest
- [x] Signed HMAC-SHA256 webhook delivery implemented for vehicle and inspection events
- [x] REST and web-admin mutation paths emit the same documented webhook events
- [x] Webhook destination is revalidated and re-resolved immediately before every delivery
- [x] Outbound webhook socket connects to the already validated public address while preserving TLS SNI/Host identity
- [x] Automatic redirect following is avoided for webhook delivery
- [x] Webhook network timeout and payload size are bounded
- [x] Webhook payload is minimum-data by design
- [x] Webhook delivery success/failure bookkeeping updates `lastTriggeredAt` and `failureCount`
- [x] Unsupported `user.created` subscription removed from the public contract
- [x] Error-tracking webhook destination validation
- [x] Incident request metadata normalized and bounded
- [x] Excessive/malformed Content-Length protection
- [x] Regression tests for registration, DNS/SSRF, signing and event emission policy
- [ ] Live production integration/webhook verification after deployment

## 8. Build, testing and CI

- [x] TypeScript validation
- [x] ESLint
- [x] Expanded regression test suite
- [x] High-severity dependency audit
- [x] Secret/workflow policy enforcement
- [x] Production-mode Next.js build
- [x] Production build installs required development build tooling explicitly
- [x] Production runtime Docker image build
- [x] Database migrator Docker image build
- [x] Running production-container liveness smoke test
- [x] GitHub concurrency prevents stale duplicate quality runs
- [x] Phase 14 reporting/export security accepted by full quality gate
- [x] Phase 15 error telemetry/recovery hardening accepted by full quality gate (`33637758671`)
- [x] Phase 16 webhook delivery covered by the final full quality gate recorded on draft PR #14
- [ ] Full browser end-to-end test suite against deployed environment
- [ ] Production load/performance test against an approved non-production target

## 9. Runtime health and verification

- [x] Database-independent `/api/health/live` endpoint
- [x] Database-aware `/api/health` readiness endpoint
- [x] Release version reported in health response/header
- [x] Database latency/degraded-state telemetry
- [x] Host-neutral post-deployment smoke verifier (`npm run release:smoke`)
- [x] Protected manual post-deployment verification workflow
- [x] HTTPS enforcement in production smoke verifier
- [x] Exact release-version verification
- [ ] Run post-deployment verification against the selected production host
- [ ] Verify authentication, tenant isolation, inspection flows, reports and audit logs live
- [ ] Confirm runtime error logs are clean after rollout

## 10. Container and infrastructure readiness

- [x] Multi-stage production Dockerfile
- [x] Non-root application runtime
- [x] Separate lightweight migration image
- [x] PostgreSQL 18 Docker Compose baseline
- [x] Local database port restricted to `127.0.0.1`
- [x] Docker Compose migration service performs upgrade plus verification
- [x] Host-neutral deployment and rollback documentation
- [ ] Selected non-Vercel production runtime provisioned
- [ ] HTTPS/domain configured on selected runtime
- [ ] Production secrets installed in platform secret storage
- [ ] Scaling/resource limits configured for actual runtime

## 11. Monitoring, backup and operations

- [x] Liveness/readiness endpoints suitable for external monitoring
- [x] Monitoring signals and alert categories documented
- [x] Backup-before-migration procedure documented
- [x] Rollback procedure documented
- [x] Backup restore must be proven before operational sign-off
- [ ] External uptime monitor connected to deployed host
- [ ] Centralized runtime logging/error tracking connected
- [ ] Automated production backup schedule configured on selected database/platform
- [ ] Backup retention policy approved
- [ ] Restore drill completed successfully
- [ ] Operational alert ownership/escalation configured

## 12. Documentation

- [x] V2.4 source-upgrade record
- [x] Production readiness checklist aligned through Phase 16
- [x] Host-neutral deployment guide
- [x] Database migration and verification procedure
- [x] Post-deployment verification procedure
- [x] Rollback procedure
- [x] Monitoring and backup/restore requirements
- [x] API documentation aligned with implemented V2.4 endpoints and signed webhook contract
- [x] Existing UI/mobile documentation retained
- [ ] Final production environment inventory recorded after host selection
- [ ] Production incident/escalation contacts recorded by the operating organization

## Phase status

### Enterprise V2.4 source hardening

**COMPLETE THROUGH PHASE 16.** The source pass covers bounded API and Server Action inputs, certificate privacy, transporter/direct-ID isolation, evidence/signature/document safety, import hardening, predictive-query batching, administrative lifecycle parity, strict settings validation, API-key boundaries, 2FA enrollment protection, reporting/export information-disclosure controls, frontend error-telemetry/recovery hardening, and signed delivery-time SSRF-protected webhooks.

### Production preparation without deployment

**SOURCE PREPARATION COMPLETE.** The database migration/verifier, PostgreSQL 18 container path, deployment guide and release verification tooling are ready. The production database has not been changed.

### Post-deployment verification phase

**TOOLING COMPLETE; LIVE EXECUTION PENDING.** Live verification requires an actual deployed non-Vercel runtime and therefore cannot be truthfully marked complete before deployment.

### Operations enhancement phase

**SOURCE/PROCESS PREPARATION COMPLETE; PLATFORM-BOUND ITEMS PENDING.** Health signals, rollback, monitoring requirements and backup/restore procedures are defined. External uptime monitoring, automated backups, custom domain/runtime scaling and provider-specific alerting require the selected production platform.

## Production sign-off gates

Do not mark Enterprise V2.4 production-complete until all of the following are true:

- [ ] Production promotion explicitly authorized
- [ ] Non-Vercel production runtime deployed
- [ ] Production database migration executed successfully
- [ ] `npm run db:verify` passes against production
- [ ] `npm run release:smoke` passes against production
- [ ] Live functional/security verification passes
- [ ] Backup and isolated restore drill passes
- [ ] Monitoring and alert ownership are active
- [ ] Final go-live approval is recorded

---

**Last updated:** 2026-09-02  
**Release candidate:** VIMS Enterprise V2.4 (`2.4.0`)  
**Deployment state:** Source-only; no production deployment performed