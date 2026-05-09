# ─────────────────────────────────────────────────────────────────────────────
# NovaCal — Web App Dockerfile (Multi-stage)
# Builds the Next.js 15 application with Bun runtime
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Install dependencies ───────────────────────────────────────────
FROM oven/bun:latest AS base
WORKDIR /app

# Copy root dependency manifests
COPY package.json bun.lock tsconfig.json tsconfig.base.json ./

# Copy workspace package manifests (for dependency resolution)
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/auth/package.json packages/auth/
COPY apps/web/package.json apps/web/

# Install with frozen lockfile for reproducible builds
RUN bun install --frozen-lockfile

# ── Stage 2: Build application ──────────────────────────────────────────────
FROM base AS build
WORKDIR /app

# Copy all source files
COPY . .

# Build the web app (Next.js)
RUN bun run --filter=@novacal/web build

# ── Stage 3: Production runner ──────────────────────────────────────────────
FROM oven/bun:latest AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy built artifacts from build stage
COPY --from=build /app/apps/web/.next ./.next
COPY --from=build /app/apps/web/public ./public
COPY --from=build /app/apps/web/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules

EXPOSE 3000

CMD ["bun", "run", "start"]
