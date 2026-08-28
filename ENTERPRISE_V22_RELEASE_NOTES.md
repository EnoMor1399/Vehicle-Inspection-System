# Vehicle Inspection Management System — Enterprise V2.2.0

## Release purpose

Enterprise V2.2 is a system-wide hardening, workflow-correction, tenant-isolation, API-safety, and professional UX release built on the V2.1 professional interface and formal certificate design.

## Validation performed in the release workspace

- Parsed 123 TypeScript/TSX source and script files with the TypeScript parser: **0 syntax diagnostics**.
- Resolved all relative and `@/` local imports: **0 unresolved local imports**.
- Security pattern scan found no direct `db.delete(...)`, raw `DELETE FROM`, `eval`, `new Function`, or `dangerouslySetInnerHTML` patterns in source/scripts/migrations.
- Capability-language scan found only explicit disclaimers for unavailable native-app/computer-vision features.
- Removed the obsolete duplicate certificate toolbar and generated `tsconfig.tsbuildinfo`.

A dependency-backed `npm run typecheck`, `npm run lint`, and `npm run build` still must be run on the deployment workstation because dependencies are not installed in the packaging environment.


## Cumulative upgrade compatibility

The supplied V2.2 cumulative patch can be applied directly over the original Enterprise V2 release. It replaces/adds 90 application files and removes two obsolete files (`src/middleware.ts` and the duplicate `src/app/certificate/[id]/CertificateToolbar.tsx`). It therefore also includes the V2.1 professional UI, 2FA login, Next.js 16 proxy migration, and formal certificate redesign.

## Database migration

Run before deploying the V2.2 application code:

```powershell
cd "D:\Project\vehicle-inspection-system"
npm run db:upgrade
```

V2.2 adds `users.transporter_id`, a foreign key to `transporters.id`, and an index used to enforce transporter portal scoping.

## Required local verification

```powershell
npm run typecheck
npm run lint
npm run build
```

Do not push to `main` until all three commands complete successfully.

## Production deployment

```powershell
git add -A
git status
git commit -m "Upgrade VIMS to Enterprise V2.2 security workflow and professional UX"
git push origin main
```

With Vercel connected to the GitHub `main` branch, that push triggers the production deployment automatically.

## Package-lock note

V2.2 does not add or remove npm dependencies; only the application version changes from V2.1. The patch intentionally leaves the workstation's existing `package-lock.json` in place. If using the full archive as a fresh copy, run `npm install` once to generate/update the lock file before committing.

## Changed files (73)

- `.env.example`
- `package.json`
- `public/manifest.json`
- `public/sw.js`
- `scripts/apply-enterprise-upgrade.mjs`
- `src/app/api-docs/page.tsx`
- `src/app/api/auth/logout/route.ts`
- `src/app/api/errors/route.ts`
- `src/app/api/health/route.ts`
- `src/app/api/v1/ai/detect-defects/route.ts`
- `src/app/api/v1/powerbi/$metadata/route.ts`
- `src/app/api/v1/powerbi/route.ts`
- `src/app/api/v1/predictive-maintenance/route.ts`
- `src/app/apps/page.tsx`
- `src/app/audit/page.tsx`
- `src/app/certificate/[id]/page.tsx`
- `src/app/daily-inspections/DailyInspectionForm.tsx`
- `src/app/daily-inspections/[id]/page.tsx`
- `src/app/daily-inspections/page.tsx`
- `src/app/daily-inspections/server.ts`
- `src/app/documents/DocumentActions.tsx`
- `src/app/documents/page.tsx`
- `src/app/guide/data.ts`
- `src/app/import/ImportWizard.tsx`
- `src/app/import/page.tsx`
- `src/app/import/server.ts`
- `src/app/inspections/InspectionForm.tsx`
- `src/app/inspections/[id]/page.tsx`
- `src/app/inspections/new/page.tsx`
- `src/app/inspections/page.tsx`
- `src/app/inspections/server.ts`
- `src/app/locations/page.tsx`
- `src/app/login/AuthForm.tsx`
- `src/app/login/page.tsx`
- `src/app/notifications/actions.ts`
- `src/app/notifications/page.tsx`
- `src/app/offline/page.tsx`
- `src/app/page.tsx`
- `src/app/portal/page.tsx`
- `src/app/powerbi/page.tsx`
- `src/app/predictive/page.tsx`
- `src/app/reports/page.tsx`
- `src/app/rfid/page.tsx`
- `src/app/security/page.tsx`
- `src/app/security/setup-2fa/page.tsx`
- `src/app/settings/SettingsForm.tsx`
- `src/app/settings/page.tsx`
- `src/app/settings/server.ts`
- `src/app/transporters/page.tsx`
- `src/app/transporters/server.ts`
- `src/app/users/page.tsx`
- `src/app/vehicles/VehiclesList.tsx`
- `src/app/vehicles/[id]/edit/page.tsx`
- `src/app/vehicles/page.tsx`
- `src/app/vehicles/server.ts`
- `src/components/AppShell.tsx`
- `src/components/Charts.tsx`
- `src/components/ErrorBoundary.tsx`
- `src/components/GpsCapture.tsx`
- `src/components/PWAProvider.tsx`
- `src/components/RfidScanner.tsx`
- `src/components/SignaturePad.tsx`
- `src/components/YearlyComparisonChart.tsx`
- `src/db/schema.ts`
- `src/lib/analytics.ts`
- `src/lib/api-auth.ts`
- `src/lib/auth.ts`
- `src/lib/config.ts`
- `src/lib/rate-limit.ts`
- `src/lib/require-auth.ts`
- `src/lib/security.ts`
- `src/lib/seed.ts`
- `src/lib/session.ts`

## Added files (6)

- `migrations/20260823_enterprise_v22_hardening.sql`
- `src/app/inspections/InspectionApprovalPanel.tsx`
- `src/app/locations/StationEditor.tsx`
- `src/app/locations/actions.ts`
- `src/app/users/UserAccessEditor.tsx`
- `src/app/users/actions.ts`

## Removed files (2)

- `src/app/certificate/[id]/CertificateToolbar.tsx`
- `tsconfig.tsbuildinfo`
