# syntax=docker/dockerfile:1.7
# Multi-stage build for WorldForge (Next.js standalone server + Prisma).

FROM node:22-bookworm-slim AS deps
WORKDIR /app
# OpenSSL is needed by the Prisma CLI's schema engine (migrations in the `tools` image).
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# postinstall runs `prisma generate`.
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_OUTPUT=standalone
RUN npx prisma generate && npx next build

# Tooling image used for migrations and seeding (has the full dependency tree).
FROM build AS tools
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed"]

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 STORAGE_LOCAL_DIR=/app/storage
# Prisma 7 runs through the pg driver adapter (no native query engine), so no system packages are needed.
RUN groupadd --system --gid 1001 worldforge && useradd --system --uid 1001 --gid worldforge worldforge \
  && mkdir -p /app/storage && chown worldforge:worldforge /app/storage
COPY --from=build --chown=worldforge:worldforge /app/.next/standalone ./
COPY --from=build --chown=worldforge:worldforge /app/.next/static ./.next/static
COPY --from=build --chown=worldforge:worldforge /app/public ./public
USER worldforge
EXPOSE 3000
VOLUME ["/app/storage"]
CMD ["node", "server.js"]
