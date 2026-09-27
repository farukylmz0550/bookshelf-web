FROM node:22-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS build
COPY . .
RUN npx prisma generate
RUN npm run build

# v3.4.0 — kepubify (static Go binary) for optional EPUB→KEPUB conversion in
# the Kobo sync download path (config.yaml → kobo.kepubify).
# v3.5.0 — pulled from the official GitHub release instead of the retired
# ghcr.io/pgaskin/kepubify image (unpublished upstream → 3.4.0+ builds failed).
# Pinned by SHA-256 (checksum verified by ADD during build).
FROM scratch AS kepubify
ADD --chmod=0755 --checksum=sha256:37d7628d26c5c906f607f24b36f781f306075e7073a6fe7820a751bb60431fc5 \
    https://github.com/pgaskin/kepubify/releases/download/v4.0.4/kepubify-linux-64bit \
    /usr/local/bin/kepubify

FROM node:22-slim AS production
WORKDIR /app
ENV NODE_ENV=production

LABEL org.opencontainers.image.source="https://github.com/farukylmz0550/bookshelf-web" \
      org.opencontainers.image.title="Bookshelf" \
      org.opencontainers.image.description="Self-hosted personal library manager" \
      org.opencontainers.image.licenses="GPL-3.0"

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Non-root user
RUN groupadd -r nodejs && useradd -r -g nodejs -d /app -s /sbin/nologin nextjs

COPY --from=build --chown=nextjs:nodejs /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=build --chown=nextjs:nodejs /app/prisma7.config.ts ./
COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/docker-entrypoint.sh ./
# v3.0.0 — default config baked in; override with a volume mount
# (-v ./config.yaml:/app/config.yaml:ro) to customize without rebuilding.
COPY --from=build --chown=nextjs:nodejs /app/config.yaml ./config.yaml

COPY --from=kepubify /usr/local/bin/kepubify /usr/local/bin/kepubify

RUN chmod +x docker-entrypoint.sh

# SQLite veri dizini (DATABASE_URL=file:/data/bookshelf.db) non-root'a yazılabilir olmalı
RUN mkdir -p /data && chown nextjs:nodejs /data

USER nextjs

EXPOSE 3000
CMD ["./docker-entrypoint.sh"]
