# Vehicle Inspection System — Code Review and Corrections

## Review scope
Reviewed the Next.js 16 / React 19 / TypeScript / PostgreSQL / Drizzle application for syntax, authentication, authorization, deployment configuration, database configuration, serverless compatibility, and maintainability.

## Corrections applied

1. **Removed insecure automatic super-admin fallback**
   - `getCurrentUser()` no longer creates or returns a privileged demo administrator when authentication is missing.
   - Authentication now requires a valid, revocable session token.

2. **Removed trust in the legacy plain user-ID cookie**
   - Protected page authentication, API browser authentication, sign-up auto-login, and normal login now use `rsl_session_token`.
   - The old `rsl_user_id` cookie is no longer issued or accepted for authentication. Logout still clears it for compatibility cleanup.

3. **Fixed API key storage/verification**
   - API keys are now looked up by SHA-256 hash rather than comparing plaintext input with the `key_hash` column.
   - Demo seed API key storage now hashes the key before insertion.

4. **Fixed permission override handling**
   - Pages and server actions now pass the full user object to permission helpers instead of passing only `user.role`.
   - Per-user permission grants/revocations are therefore respected.

5. **Disabled production exposure of demo credentials**
   - Demo account quick-fill credentials are displayed only outside production.

6. **Removed automatic demo-data seeding from the root layout**
   - Every application request no longer attempts to seed the database.
   - This prevents a fresh production database from automatically receiving known demo credentials.

7. **Added safer first-admin bootstrap behavior**
   - In production, the first account becomes `super_admin` only when its email matches `BOOTSTRAP_ADMIN_EMAIL`.
   - Other registrations remain `viewer` by default.

8. **Fixed Docker standalone build configuration**
   - Enabled `output: "standalone"` in `next.config.ts`, matching the Docker runner's expected `.next/standalone` output.

9. **Fixed Docker install behavior for this archive**
   - The archive did not include a `package-lock.json`; `npm ci` therefore cannot succeed.
   - Docker build now uses `npm install --include=dev` until a lockfile is generated and committed.

10. **Fixed Drizzle deployment database configuration**
    - Replaced the hard-coded `drizzle.config.json` connection string with `drizzle.config.ts` using `process.env.DATABASE_URL`.
    - Docker migration stage now copies the correct config file.

11. **Fixed browser capability security policy**
    - The original `Permissions-Policy` disabled camera and geolocation even though the app contains photo capture and GPS capture features.
    - Camera and geolocation are now allowed for the same origin while microphone remains disabled.

12. **Improved serverless/runtime behavior**
    - Removed module-level `setInterval` cleanup timers from middleware/security rate-limit stores.
    - Cleanup is now opportunistic, avoiding background timer behavior that is unsuitable for serverless/edge runtimes.

13. **Added repository/environment hygiene**
    - Added `.gitignore` for environment files, dependencies, build output, logs, coverage, and TypeScript build cache.
    - Added `.env.example` including `DATABASE_URL` and production security/bootstrap variables.

14. **Formatting/readability cleanup**
    - Moved a misplaced Drizzle import in `src/lib/settings.ts` to the normal import section.

## Validation performed
- Parsed all 115 `.ts`/`.tsx` source/config files with the TypeScript compiler parser.
- Result: **0 syntax diagnostics**.
- Confirmed `package.json` is valid JSON.
- Confirmed legacy user-ID authentication is no longer used (only logout cleanup remains).
- Confirmed production root layout no longer auto-seeds demo users.

## Remaining validation note
A full `npm install` could not complete in the review environment because package installation timed out. Therefore `npm run typecheck`, `npm run lint`, and `npm run build` should be run in an environment with npm registry access after generating a lockfile.

Recommended sequence:

```bash
npm install
npm run typecheck
npm run lint
npm run build
```

Then commit the generated `package-lock.json` and change the Dockerfile back from `npm install --include=dev` to `npm ci --include=dev` for reproducible production builds.
