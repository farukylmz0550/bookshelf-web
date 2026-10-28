FROM --platform=$BUILDPLATFORM node:22-slim AS base
ARG TARGETARCH
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS build
WORKDIR /app
COPY . .
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN apt-get update && apt-get install -y --no-install-recommends openssl curl ca-certificates && \
    groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nextjs && \
    rm -rf /var/lib/apt/lists/*
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/scripts/cron.mjs ./scripts/cron.mjs
COPY --from=build --chown=nextjs:nodejs /app/docker-entrypoint.sh ./
COPY --from=build --chown=nextjs:nodejs /app/config.yaml ./config.yaml
ARG TARGETARCH
RUN if [ "$TARGETARCH" = "arm64" ]; then curl -fsSL -o /usr/local/bin/kepubify https://github.com/pgaskin/kepubify/releases/download/v4.0.4/kepubify-linux-arm64; else curl -fsSL -o /usr/local/bin/kepubify https://github.com/pgaskin/kepubify/releases/download/v4.0.4/kepubify-linux-64bit; fi && chmod +x /usr/local/bin/kepubify
RUN chmod +x docker-entrypoint.sh && mkdir -p /data && chown nextjs:nodejs /data
USER nextjs
EXPOSE 3000
CMD ["./docker-entrypoint.sh"]
