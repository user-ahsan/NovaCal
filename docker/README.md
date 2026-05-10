# 🚀 NovaCal Dokploy Deployment Guide

> Copy-paste deployment instructions for Dokploy on a self-hosted VPS.

---

## 📋 Prerequisites

| Requirement | Version | Check |
|-------------|---------|-------|
| VPS (any provider) | 2GB RAM, 20GB SSD | `free -m` |
| Docker | ≥24.0 | `docker --version` |
| Docker Compose | ≥2.0 | `docker compose version` |
| Domain (optional) | Pointed to VPS IP | `dig +short calendar.yourdomain.com` |
| Cloudflare Tunnel (optional) | `cloudflared` installed | `cloudflared --version` |

---

## 🚀 Quick Deploy (3 Commands)

```bash
# 1. Clone the repository
git clone https://github.com/user-ahsan/NovaCal.git /opt/novacal
cd /opt/novacal

# 2. Configure environment
cp .env.example .env
nano .env   # Edit: set BETTER_AUTH_SECRET, domain URLs, passwords

# 3. Launch everything
docker compose -f docker/compose.yml up -d --build

# Verify
curl http://localhost:3000/api/health
# → {"status":"healthy","postgres":"connected","redis":"connected","uptime":5,"version":"1.0.0"}
```

---

## 🏗️ Dokploy Dashboard Setup

### New Service

```
1. Navigate to Dokploy Dashboard → Services → New Service
2. Configure:
   ├── Name:        novacal
   ├── Repository:  https://github.com/user-ahsan/NovaCal
   ├── Branch:      main
   ├── Build Method: Docker Compose
   └── Compose Path: docker/compose.yml
3. Click "Deploy"
```

### Environment Variables

Set these in Dokploy's environment tab (never commit `.env`):

```env
DATABASE_URL=postgresql://novacal:password@novacal-db:5432/novacal
DATABASE_PASSWORD=password
REDIS_URL=redis://novacal-redis:6379
BETTER_AUTH_SECRET=<openssl rand -hex 64>
BETTER_AUTH_URL=https://calendar.yourdomain.com
MCP_PORT=3001
WS_PORT=3001
WS_URL=wss://ws.yourdomain.com
TRUST_PROXY=false
NODE_ENV=production
```

### Ingress Rules

| Domain | Internal Service | Port |
|--------|-----------------|------|
| `calendar.yourdomain.com` | `novacal-web` | 3000 |
| `ws.yourdomain.com` | `novacal-realtime` | 3001 |

Set these in Dokploy → Settings → Ingress Rules.

---

## 📖 Full Commands Reference

### Deployment Lifecycle

```bash
# ─── Build & Start ───
docker compose -f docker/compose.yml up -d --build          # Build images + start all
docker compose -f docker/compose.yml up -d                   # Start existing containers
docker compose -f docker/compose.yml build --no-cache        # Force full rebuild

# ─── Stop & Cleanup ───
docker compose -f docker/compose.yml down                   # Stop all + remove containers
docker compose -f docker/compose.yml down -v                # Stop all + DELETE volumes (DATA LOSS)
docker compose -f docker/compose.yml stop                   # Graceful stop (preserves containers)

# ─── Logs ───
docker compose -f docker/compose.yml logs -f                # Tail ALL logs
docker compose -f docker/compose.yml logs -f novacal-web    # Tail web only
docker compose -f docker/compose.yml logs -f novacal-realtime # Tail realtime only
docker compose -f docker/compose.yml logs -f novacal-db     # Tail database only
docker compose -f docker/compose.yml logs --tail=100        # Last 100 lines

# ─── Restart ───
docker compose -f docker/compose.yml restart novacal-web     # Restart single service
docker compose -f docker/compose.yml restart                 # Restart all

# ─── Scaling ───
docker compose -f docker/compose.yml up -d --scale novacal-web=3  # Run 3 web instances
# (Requires removing port mapping or using load balancer)

# ─── Health ───
docker compose -f docker/compose.yml ps                     # Container status
docker inspect --format='{{json .State.Health}}' novacal-web # Health check details
```

### First-Time Setup

```bash
# After containers are running, apply database migrations
docker exec -it novacal-web bun run db:push

# Verify setup
curl http://localhost:3000/api/health
```

### Updates

```bash
# Pull latest, rebuild, restart
cd /opt/novacal
git pull
docker compose -f docker/compose.yml up -d --build --remove-orphans
docker compose -f docker/compose.yml restart
```

### Troubleshooting

```bash
# Check if containers are running
docker ps | grep novacal

# Inspect container logs for errors
docker logs novacal-web --tail=50
docker logs novacal-realtime --tail=50
docker logs novacal-db --tail=50
docker logs novacal-redis --tail=50

# Check database connection
docker exec -it novacal-db pg_isready -U novacal

# Test Redis
docker exec -it novacal-redis redis-cli ping
# → PONG

# Exec into a container
docker exec -it novacal-web sh
docker exec -it novacal-realtime sh

# View resource usage
docker stats novacal-web novacal-realtime novacal-db novacal-redis

# Full reset (⚠️ DELETES ALL DATA)
docker compose -f docker/compose.yml down -v
docker compose -f docker/compose.yml up -d --build
docker exec -it novacal-web bun run db:push
```

---

## 🔧 Container Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Docker Network: novacal-net                 │
│                        172.28.0.0/16                          │
│                                                              │
│  ┌──────────────────┐    ┌──────────────────┐                │
│  │   novacal-web     │    │ novacal-realtime  │               │
│  │   Port: 3000      │    │   Port: 3001      │               │
│  │   Memory: 512M    │    │   Memory: 256M    │               │
│  │   Health: /api/   │    │   Health: /health │               │
│  │   health          │    │                   │               │
│  └────────┬─────────┘    └────────┬─────────┘                │
│           │                       │                           │
│           └──────────┬────────────┘                           │
│                      │                                        │
│  ┌───────────────────┴───────────────────┐                    │
│  │          Redis 7 (novacal-redis)       │                   │
│  │          Port: 6379 (internal)         │                   │
│  │          Memory: 256M                  │                   │
│  └───────────────────┬───────────────────┘                    │
│                      │                                        │
│  ┌───────────────────┴───────────────────┐                    │
│  │      PostgreSQL 16 (novacal-db)        │                   │
│  │      Port: 5432 (internal)             │                   │
│  │      Memory: 512M                      │                   │
│  └───────────────────────────────────────┘                    │
└─────────────────────────────────────────────────────────────┘
```

---

## ☁️ Cloudflare Tunnel Setup

```bash
# Install cloudflared on VPS
sudo apt install cloudflared

# Authenticate
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create novacal

# Configure tunnel
cat > ~/.cloudflared/config.yml << 'EOF'
tunnel: <your-tunnel-uuid>
credentials-file: /home/user/.cloudflared/<your-tunnel-uuid>.json

ingress:
  - hostname: calendar.yourdomain.com
    service: http://localhost:3000
  - hostname: ws.yourdomain.com
    service: http://localhost:3001
  - service: http_status:404
EOF

# Start tunnel
cloudflared tunnel run novacal

# Set TRUST_PROXY=true in .env for correct IP detection
```

---

## 🐳 Docker Images

| Image | Size (approx) | Based On |
|-------|--------------|----------|
| `novacal-web` | ~250MB | `oven/bun:1.3.13-slim` |
| `novacal-realtime` | ~200MB | `oven/bun:1.3.13-slim` |
| `postgres:16-alpine` | ~200MB | Alpine Linux |
| `redis:7-alpine` | ~30MB | Alpine Linux |

### Image Optimization

- **Multi-stage builds**: 3 stages (deps → build → production slim)
- **Minimal base**: `bun-slim` (no build tools, no dev packages)
- **Non-root user**: Runs as `novacal` user (uid 1001) — security best practice
- **Next.js standalone**: Uses `.next/standalone/` output (minimal server only)
- **Layer caching**: Dependency manifests copied before source code (cached unless `package.json` changes)

---

## 🔒 Security

- **Non-root containers**: All services run as unprivileged users
- **Health checks**: Every service has health checks preventing routing to dead containers
- **Memory limits**: Hard caps prevent OOM killer issues
- **Internal networks**: PostgreSQL and Redis are NOT exposed to the internet
- **Graceful shutdown**: `STOPSIGNAL SIGTERM` + `stop_grace_period` for clean shutdown
- **Log rotation**: JSON-file driver with 10MB max per file, 3 files rotated

---

## ⚡ Performance Tuning

```bash
# Increase system limits for WebSocket connections
echo "fs.file-max=100000" >> /etc/sysctl.conf
echo "net.core.somaxconn=65535" >> /etc/sysctl.conf
sysctl -p

# For Dokploy, ensure reverse proxy has:
# proxy_read_timeout 86400s;      # For SSE long-lived connections
# proxy_send_timeout 86400s;
# proxy_buffering off;            # Required for SSE
```
