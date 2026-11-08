FROM node:24-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates git openssh-client && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@12.11.2
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm exec prisma generate

FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
RUN mkdir -p /app/yuri-blog/public && pnpm build

FROM node:24-bookworm-slim AS web
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates git openssh-client && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/yuri-blog/public ./yuri-blog/public
RUN mkdir -p /app/data/uploads && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["node","yuri-blog/server.js"]

FROM base AS tools
ENV NODE_ENV=production
RUN mkdir -p /app/data/uploads && chown -R node:node /app
USER node
CMD ["node","--import","tsx","scripts/worker.ts"]
