# ─── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS build

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /workspace

COPY pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/frontend/package.json ./apps/frontend/

RUN pnpm install --frozen-lockfile --filter @someone/frontend... --filter @someone/shared

COPY tsconfig.base.json ./
COPY packages/shared/ ./packages/shared/
COPY apps/frontend/ ./apps/frontend/

RUN pnpm --filter @someone/shared build
RUN pnpm --filter @someone/frontend build

# ─── Development stage ────────────────────────────────────────────────────────
FROM node:20-alpine AS development

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /workspace

COPY pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/frontend/package.json ./apps/frontend/

RUN pnpm install --filter @someone/frontend... --filter @someone/shared

COPY tsconfig.base.json ./
COPY packages/shared/ ./packages/shared/
COPY apps/frontend/ ./apps/frontend/

WORKDIR /workspace/apps/frontend

EXPOSE 4200

CMD ["pnpm", "start:dev"]

# ─── Production runtime stage ─────────────────────────────────────────────────
FROM nginx:alpine AS production

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=build /workspace/apps/frontend/dist/frontend/browser /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

RUN chown -R appuser:appgroup /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
