# ═══════════════════════════════════════════════════════════════════════════════
# NovaCal — Real-time Server Dockerfile (Production Multi-Stage)
# Target: Dokploy / Docker Compose
# Runtime: WebSocket (UI) + SSE (MCP) on port 3001
# ═══════════════════════════════════════════════════════════════════════════════
# Build:
#   docker build -f docker/realtime.Dockerfile --build-arg BUN_VERSION=1.3.13 -t novacal-realtime .
#
# Stages:
#   deps    → Install dependencies (cached unless package.json changes)
#   runner  → Production image (bun-slim, non-root, ~200MB)
# ═══════════════════════════════════════════════════════════════════════════════

ARG BUN_VERSION=1.3.13

# ─── Stage 1: Install dependencies ──────────────────────────────────────────
FROM oven/bun:${BUN_VERSION} AS deps
WORKDIR /app

# Copy root manifests
COPY package.json bun.lock tsconfig.json tsconfig.base.json ./

# Copy realtime + all workspace package manifests (needed for workspace links)
COPY apps/realtime/package.json apps/realtime/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/

# Install all dependencies (monorepo — no --production flag)
RUN bun install --frozen-lockfile

# ─── Stage 2: Production image ──────────────────────────────────────────────
FROM oven/bun:${BUN_VERSION}-slim AS runner
WORKDIR /app

# Security: run as non-root user
RUN addgroup --system --gid 1001 novacal \
    && adduser --system --uid 1001 novacal

# Labels
LABEL org.opencontainers.image.title="NovaCal Realtime Server"
LABEL org.opencontainers.image.description="Self-hosted intelligent calendar platform - WebSocket + SSE Server"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.source="https://github.com/user-ahsan/NovaCal"

# Environment
ENV NODE_ENV=production
ENV WS_PORT=3001
ENV PORT=3001

# Copy source and dependencies from deps stage
COPY --from=deps --chown=novacal:novacal /app/apps/realtime ./apps/realtime
COPY --from=deps --chown=novacal:novacal /app/packages/shared ./packages/shared
COPY --from=deps --chown=novacal:novacal /app/packages/db ./packages/db
COPY --from=deps --chown=novacal:novacal /app/package.json /app/bun.lock ./
COPY --from=deps --chown=novacal:novacal /app/node_modules ./node_modules

# Switch to non-root user
USER novacal

EXPOSE 3001

STOPSIGNAL SIGTERM

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD node -e "const h=require('http');h.get('http://localhost:3001/health',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>process.exit(JSON.parse(d).status==='healthy'?0:1))}).on('error',()=>process.exit(1))"

CMD ["bun", "run", "--cwd", "apps/realtime", "start"]
