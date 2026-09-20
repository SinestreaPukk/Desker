# syntax=docker/dockerfile:1

# Debian slim rather than Alpine, deliberately:
#   - Prisma's query engine wants glibc + openssl; the musl build is a separate
#     binary target and a recurring source of "engine not found" at runtime.
#   - On musl, npm resolves the wasm32 fallbacks of sharp and tailwind's oxide
#     binary, which drags in optional transitive deps that a lockfile resolved
#     on any other platform will not contain, breaking `npm ci`.

# --- deps -------------------------------------------------------------------
FROM node:22-slim AS deps
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# --- build ------------------------------------------------------------------
FROM node:22-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate the Prisma client for the target provider, then build.
# DATABASE_URL is only needed at runtime, but Prisma wants it present to parse
# the datasource block during `generate`.
ARG DATABASE_PROVIDER=postgresql
ENV DATABASE_PROVIDER=$DATABASE_PROVIDER
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
RUN node scripts/gen-schema.mjs && npx prisma generate
RUN npm run build

# --- runtime ----------------------------------------------------------------
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV STORAGE_DIR=/data/storage

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

# Next.js standalone output: server + minimal node_modules.
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

# Prisma CLI + schema + engines, so the container can run `db push` on boot.
COPY --from=build --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=build --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=build --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=build --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=nextjs:nodejs /app/docker-entrypoint.sh ./docker-entrypoint.sh

RUN mkdir -p /data/storage && chown -R nextjs:nodejs /data/storage
USER nextjs
EXPOSE 3000

ENTRYPOINT ["/bin/sh", "./docker-entrypoint.sh"]
CMD ["node", "server.js"]
