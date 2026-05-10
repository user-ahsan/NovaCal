# ═══════════════════════════════════════════════════════════════════════════════
# NovaCal — Web App Dockerfile (Production Multi-Stage)
# Target: Dokploy / Docker Compose
# Runtime: Next.js 15 + REST API on port 3000
# ═══════════════════════════════════════════════════════════════════════════════
# Build:
#   docker build -f docker/Dockerfile --build-arg BUN_VERSION=1.3.13 -t novacal-web .
#
# Stages:
#   deps    → Install dependencies (cached unless package.json changes)
#   build   → Build Next.js application with standalone output
#   runner  → Production image (bun-slim, non-root, ~250MB)
# ═══════════════════════════════════════════════════════════════════════════════

ARG BUN_VERSION=1.3.13

# ─── Stage 1: Install ALL dependencies ──────────────────────────────────────
FROM oven/bun:${BUN_VERSION} AS deps
WORKDIR /app

# Copy root dependency manifests
COPY package.json bun.lock tsconfig.json tsconfig.base.json ./

# Copy ALL workspace package manifests (every workspace in root package.json)
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/auth/package.json packages/auth/
COPY packages/ui/package.json packages/ui/
COPY apps/web/package.json apps/web/

# Install with frozen lockfile for reproducible builds
# NOTE: Do NOT use --production in monorepos — workspace links won't resolve
RUN bun install --frozen-lockfile

# ─── Stage 2: Build Next.js application ─────────────────────────────────────
FROM oven/bun:${BUN_VERSION} AS build
WORKDIR /app

# Copy installed dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json /app/bun.lock /app/tsconfig.json /app/tsconfig.base.json ./

# Copy all source files
COPY packages/shared packages/shared/
COPY packages/db packages/db/
COPY packages/auth packages/auth/
COPY packages/ui packages/ui/
COPY apps/web apps/web/

# Build Next.js with standalone output
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN bun run --cwd apps/web build

# ─── Stage 3: Production image ──────────────────────────────────────────────
FROM oven/bun:${BUN_VERSION}-slim AS runner
WORKDIR /app

# Security: run as non-root user
RUN addgroup --system --gid 1001 novacal \
    && adduser --system --uid 1001 novacal \
    && mkdir -p /app/.next /app/public /app/node_modules

# Labels
LABEL org.opencontainers.image.title="NovaCal Web App"
LABEL org.opencontainers.image.description="Self-hosted intelligent calendar platform - Web Application"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.source="https://github.com/user-ahsan/NovaCal"

# Environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy standalone output (Next.js places server.js at root of standalone/)
COPY --from=build --chown=novacal:novacal /app/apps/web/.next/standalone ./

# Copy static assets (separate from standalone for CDN/edge caching)
COPY --from=build --chown=novacal:novacal /app/apps/web/public ./public

# Copy .next/static for optimal caching (separate from server code)
COPY --from=build --chown=novacal:novacal /app/apps/web/.next/static ./.next/static

# Switch to non-root user
USER novacal

EXPOSE 3000

STOPSIGNAL SIGTERM

# Health check — uses Node.js built-in http (no curl needed)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "const h=require('http');h.get('http://localhost:3000/api/health',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>process.exit(JSON.parse(d).status==='healthy'?0:1))}).on('error',()=>process.exit(1))"

# Next.js standalone server
CMD ["node", "server.js"]
