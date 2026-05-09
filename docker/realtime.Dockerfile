# ─────────────────────────────────────────────────────────────────────────────
# NovaCal — Real-time Server Dockerfile
# Builds the WebSocket + SSE server for real-time collaboration
# ─────────────────────────────────────────────────────────────────────────────

FROM oven/bun:latest
WORKDIR /app

# Copy root dependency manifests
COPY package.json bun.lock ./

# Copy realtime app manifest
COPY apps/realtime/package.json apps/realtime/

# Install with frozen lockfile for reproducible builds
RUN bun install --frozen-lockfile

# Copy all source files
COPY . .

EXPOSE 3001

CMD ["bun", "run", "--cwd", "apps/realtime", "start"]
