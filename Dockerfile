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
CMD ["npm", "run", "db:upgrade"]

# Application build stage
FROM base AS builder
RUN apk add --no-cache libc6-compat python3 make g++
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --include=dev; else npm install --include=dev; fi
COPY . .
# Server-rendered pages are force-dynamic. A build-only URL prevents module initialization
# from failing before runtime DATABASE_URL is injected by the deployment platform.
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build npx next build

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
