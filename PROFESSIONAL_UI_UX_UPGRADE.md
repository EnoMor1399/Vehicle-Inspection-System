# Vehicle Inspection Enterprise V2.1 — Professional UI/UX Upgrade

## Scope
This release refines Enterprise V2 without changing the core database schema. It focuses on usability, visual hierarchy, accessibility, authentication completion, mobile stability, and Next.js 16 compatibility.

## Improvements
- Reorganized the main navigation into Operations, Intelligence, Administration, and Access & Support groups.
- Added a persistent professional application header with active-page context and an enterprise security indicator.
- Improved active navigation states, mobile drawer behavior, keyboard focus visibility, and accessible labels.
- Replaced broad mobile CSS overrides that could force unrelated flex containers into columns, make all buttons full-width, or convert all tables globally.
- Added safer mobile touch targets while preserving each page's intended layout.
- Added reduced-motion support and improved global focus/selection behavior.
- Completed the two-factor authentication login experience: when the server requires 2FA, users now receive a six-digit authenticator-code field and can finish sign-in.
- Aligned signup password guidance with the Enterprise V2 minimum policy: 12+ characters including uppercase, lowercase, number, and special character.
- Removed the non-functional “Forgot password?” control and replaced it with clear administrator-managed recovery guidance.
- Refined shared cards, buttons, and form inputs for a more consistent enterprise visual language.
- Migrated `src/middleware.ts` to the Next.js 16 `src/proxy.ts` convention to remove the middleware deprecation warning.
- Updated package version to 2.1.0.

## Deployment
No database migration is required for this UI/UX release.

Run before pushing:

```powershell
npm run typecheck
npm run lint
npm run build
```

Then deploy through the existing GitHub → Vercel integration:

```powershell
git add -A
git commit -m "Upgrade VIMS to Enterprise V2.1 professional UI and UX"
git push origin main
```
