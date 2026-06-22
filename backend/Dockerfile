# syntax=docker/dockerfile:1

# ---- 1. Dependencies ----
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

# ---- 2. Builder ----
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# prisma.config.ts references env("DATABASE_URL"); provide a placeholder for build-time
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/salesgenius?schema=public
# Generate Prisma client (driver-adapter client is portable)
RUN npx prisma generate
# Compile TypeScript -> dist/
RUN npm run build

# ---- 3. Runner ----
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat openssl tini
WORKDIR /app
ENV NODE_ENV=production

# Full node_modules (with generated Prisma client) + build output + prisma assets
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/package.json ./package.json

# Inline entrypoint (avoids host CRLF issues)
RUN echo '#!/bin/sh' > /app/entrypoint.sh && \
    echo 'set -e' >> /app/entrypoint.sh && \
    echo '' >> /app/entrypoint.sh && \
    echo 'echo "[entrypoint] Waiting for database..."' >> /app/entrypoint.sh && \
    echo 'until npx prisma db push --accept-data-loss >/dev/null 2>&1; do' >> /app/entrypoint.sh && \
    echo '  echo "[entrypoint] DB not ready, retrying in 2s..."' >> /app/entrypoint.sh && \
    echo '  sleep 2' >> /app/entrypoint.sh && \
    echo 'done' >> /app/entrypoint.sh && \
    echo 'echo "[entrypoint] Schema applied."' >> /app/entrypoint.sh && \
    echo '' >> /app/entrypoint.sh && \
    echo 'echo "[entrypoint] Running seed (idempotent)..."' >> /app/entrypoint.sh && \
    echo 'node prisma/seed.runtime.mjs || echo "[entrypoint] Seed skipped/failed."' >> /app/entrypoint.sh && \
    echo '' >> /app/entrypoint.sh && \
    echo 'echo "[entrypoint] Starting backend server..."' >> /app/entrypoint.sh && \
    echo 'exec node dist/main.js' >> /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

EXPOSE 4000
ENTRYPOINT ["/sbin/tini", "--", "/app/entrypoint.sh"]
