# Vehicle Inspection Management System — Enterprise production image
FROM node:22-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

# Lightweight database migration image. This stage deliberately does not build Next.js.
FROM base AS migrator
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi
COPY migrations ./migrations
COPY scripts/apply-enterprise-upgrade.mjs ./scripts/apply-enterprise-upgrade.mjs
COPY scripts/verify-enterprise-upgrade.mjs ./scripts/verify-enterprise-upgrade.mjs
CMD ["npm", "run", "db:upgrade"]

# Application build stage
FROM base AS builder
RUN apk add --no-cache libc6-compat python3 make g++
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --include=dev; else npm install --include=dev; fi
COPY . .
# Server-rendered pages are force-dynamic. Build-only values satisfy production
# configuration validation without embedding production credentials in the image.
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build \
    NEXT_PUBLIC_APP_URL=http://localhost:3000 \
    JWT_SECRET=build-only-jwt-secret-value-000000000000000000000000 \
    SESSION_SECRET=build-only-session-secret-value-000000000000000000000 \
    CSRF_SECRET=build-only-csrf-secret-value-000000000000000000000000 \
    API_KEY_SALT=build-only-api-key-salt-value-00000000000000000000000 \
    FIELD_ENCRYPTION_KEY=build-only-field-encryption-key-0000000000000000000000 \
    CERTIFICATE_SIGNING_SECRET=build-only-certificate-signing-secret-000000000000000000 \
    npx next build

# Minimal non-root runtime image. Next standalone already includes required runtime modules.
FROM base AS runner
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
