# 📅 NovaCal — Self-Hosted Intelligent Calendar Platform

> **Pure, self-hosted calendar platform.** Zero external SaaS dependencies. Bun-native monorepo, QR passwordless auth bridge, real-time WebSocket collaboration, built-in MCP server for AI agents (Cursor/Claude/OpenCode), offline-first mobile app.

[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.3-f9f9f9?logo=bun)](https://bun.sh/)
[![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=next.js)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-green)]()

---

## ✨ Features

| Capability | Detail |
|-----------|--------|
| **Calendar Views** | Day, 3-day, Week, Month, Year — with edge-to-edge grid canvas |
| **Drag & Drop** | Magnetic 15-min snap rescheduling with real-time sync |
| **QR Auth Bridge** | Passwordless login via mobile scanner — no typing passwords |
| **Real-Time Sync** | WebSocket-powered instant updates across all connected clients |
| **AI Agents** | Built-in MCP server (8 tools) for Cursor, Claude, OpenCode |
| **RBAC** | 5-tier workspace roles: OWNER → ADMIN → EDITOR → VIEWER → FREE_BUSY |
| **PostgreSQL FTS** | Typo-tolerant full-text search via GIN-indexed tsvector |
| **Recurrence** | Full RRule support (RFC 5545) with single-instance overrides |
| **Public Sharing** | Cryptographically secure, password-protected calendar/event links |
| **Offline Mobile** | Local SQLite cache + sync queue — works without internet |
| **Self-Hosted** | Pure Docker deployment via Dokploy — no managed services |
| **MCP Tools** | 8 AI agent tools: list, create, update, delete events, find common time, availability, search, upcoming |

---

## 📋 Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| [Bun](https://bun.sh/) | ≥1.3 | Runtime, package manager, bundler |
| [Docker](https://www.docker.com/) | ≥24.0 | Container deployment (PostgreSQL + Redis) |
| [Docker Compose](https://docs.docker.com/compose/) | ≥2.0 | Orchestrate 4 containers |
| [Node.js](https://nodejs.org/) | ≥20.0 | Fallback (Bun preferred) |
| [PostgreSQL](https://www.postgresql.org/) | 16 | Primary database (Dockerized) |
| [Redis](https://redis.io/) | 7 | Sessions, Pub/Sub, rate limiting (Dockerized) |

### For mobile development

| Tool | Version | Purpose |
|------|---------|---------|
| [Expo CLI](https://expo.dev/) | Latest | React Native development |
| [Expo Go](https://expo.dev/go) | Latest | On-device testing |
| [Android Studio](https://developer.android.com/studio) | Latest | Android emulator |

---

## 🚀 Quick Start

```bash
# 1. Clone and install
git clone https://github.com/user-ahsan/NovaCal.git
cd novacal
bun install

# 2. Set up environment
cp .env.example .env
# Edit .env with your settings (see Configuration below)

# 3. Start infrastructure (PostgreSQL + Redis)
bun run docker:up

# 4. Generate database schema
bun run db:generate
bun run db:push

# 5. Start development servers
bun run dev:all      # Web (3000) + Realtime (3001) + MCP (3001)
```

Open [http://localhost:3000](http://localhost:3000) → Login/QR page.

---

## 📁 Project Structure

```
novacal/
├── apps/
│   ├── web/                     # Next.js 15 App Router
│   │   ├── app/
│   │   │   ├── (auth)/          # Login, QR, setup, auth callback
│   │   │   ├── (dashboard)/     # Calendar, agenda, search
│   │   │   ├── (admin)/         # Instance administration
│   │   │   ├── (settings)/      # Profile, security, sessions
│   │   │   ├── (workspace)/     # Team settings, members
│   │   │   ├── (developer)/     # MCP config, API keys, webhooks
│   │   │   ├── (public)/        # Share links (p/[hash], e/[hash])
│   │   │   ├── api/             # REST API routes (auth, events, etc.)
│   │   │   ├── not-found.tsx    # 404 page
│   │   │   └── error.tsx        # Global error boundary
│   │   ├── components/          # Web components (GridCanvas, etc.)
│   │   ├── lib/                 # Server utilities (auth, errors, rbac)
│   │   └── next.config.ts       # Next.js config
│   ├── mobile/                  # Expo React Native
│   │   ├── app/                 # Expo Router screens
│   │   ├── components/          # Mobile components (9)
│   │   └── services/            # API client, offline sync, FCM
│   ├── realtime/                # WebSocket server
│   │   ├── handlers/            # Connection, events, presence
│   │   └── rooms/               # Workspace channel management
│   └── mcp-server/              # MCP SDK SSE server
│       ├── tools/               # 8 MCP tools (list, create, etc.)
│       ├── auth.ts              # Bearer token validation
│       └── rbac.ts              # Per-tool role checks
├── packages/
│   ├── shared/                  # Zod schemas, TS types, constants
│   │   ├── constants/           # Animation, system, roles
│   │   └── types/               # Shared TypeScript interfaces
│   ├── db/                      # Drizzle ORM
│   │   ├── schema/              # 5 schema files (11 tables)
│   │   ├── migrations/          # SQL migrations (3 files)
│   │   └── client.ts            # Drizzle client instance
│   ├── auth/                    # Better Auth config
│   └── ui/                      # shadcn/ui primitives (16 components)
├── docker/
│   ├── compose.yml              # 4-container orchestration
│   ├── Dockerfile               # Multi-stage web build
│   └── realtime.Dockerfile      # WebSocket server build
├── docs/                        # Full technical specification
│   ├── 01-database-schema.md    # Entity relationships, indexing
│   ├── 02-component-library.md  # Components, constants, animations
│   ├── 03-api-contract.md       # REST endpoints, WebSocket contract
│   ├── 04-mcp-server.md         # MCP tools, auth, RBAC
│   ├── 05-route-map.md          # All web + mobile routes
│   ├── 06-design-spec.md        # Design language, dark theme
│   ├── 07-animation-guide.md    # Framer Motion + Reanimated specs
│   ├── 08-user-flows.md         # 10 user flows, 40 requirements
│   └── 09-master-spec.md        # Architecture, build roadmap
├── .env.example                 # Environment template
├── AGENTS.md                    # Agent rules (100 commandments)
├── agent-mistakes.md            # Agentic mistakes log (M-001–M-040)
├── plan.md                      # Multi-agent orchestration plan
├── eslint.config.js             # ESLint v10 flat config
├── vitest.config.ts             # Test configuration
└── package.json                 # Bun workspace root
```

---

## 🔧 Configuration

### Environment Variables

Create `.env` from `.env.example`:

```env
# Database
DATABASE_URL=postgresql://novacal:password@novacal-db:5432/novacal

# Redis
REDIS_URL=redis://novacal-redis:6379

# Auth
BETTER_AUTH_SECRET=<generate-random-64-char>
BETTER_AUTH_URL=https://calendar.yourdomain.com

# MCP
MCP_PORT=3001

# Real-time Server
WS_PORT=3001
WS_URL=wss://ws.yourdomain.com

# Network
TRUST_PROXY=false          # Enable behind Cloudflare Tunnel
NODE_ENV=production
```

### Docker Compose Ports

| Container | Internal | External | Purpose |
|-----------|----------|----------|---------|
| `novacal-web` | 3000 | 3000 | Next.js + REST API |
| `novacal-realtime` | 3001 | 3001 | WebSocket UI + SSE MCP |
| `novacal-db` | 5432 | — | PostgreSQL 16 (internal) |
| `novacal-redis` | 6379 | — | Redis 7 (internal) |

---

## 📜 Available Scripts

### Development
```bash
bun run dev          # Start web dev server (Next.js :3000)
bun run dev:web      # Same as dev
bun run dev:realtime # Start WebSocket server (:3001)
bun run dev:mcp      # Start MCP server (SSE + tools)
bun run dev:all      # Web + Realtime + MCP concurrently
```

### Testing & Quality
```bash
bun run typecheck    # Full TypeScript compilation (0 errors)
bun run lint         # ESLint across all .ts/.tsx
bun run test         # Vitest (runs all __tests__)
bun run test:watch   # Tests in watch mode
```

### Database
```bash
bun run db:generate  # Generate Drizzle migrations
bun run db:migrate   # Apply migrations to database
bun run db:push      # Push schema directly (dev)
bun run db:studio    # Open Drizzle Studio GUI
```

### Docker
```bash
bun run docker:up      # Start all containers (-d)
bun run docker:down    # Stop all containers
bun run docker:logs    # Tail container logs
bun run docker:rebuild # Rebuild and restart
```

### Setup
```bash
bun run setup      # bun install + db:generate + db:push
bun run build      # Production build (Next.js)
bun run clean      # Remove node_modules, dist, .next
```

---

## 🐳 Deployment

### Docker (Dokploy / Self-Hosted VPS)

```bash
# 1. Build and start all services
bun run docker:rebuild

# 2. Apply database migrations
bun run db:migrate

# 3. Configure Dokploy ingress
#    calendar.yourdomain.com → novacal-web:3000
#    ws.yourdomain.com       → novacal-realtime:3001

# 4. Set environment variables in Dokploy dashboard
#    (copy from .env.example)

# 5. Health check
curl https://calendar.yourdomain.com/api/health
# → { "status": "healthy", "postgres": "connected", "redis": "connected", ... }
```

### Cloudflare Tunnel

Set `TRUST_PROXY=true` in `.env` for correct IP detection behind Cloudflare.

### Requirements

- Docker & Docker Compose on the VPS
- Domain pointing to VPS IP
- Dokploy (or any Docker orchestration)
- 2GB RAM minimum

---

## 👨‍💻 Development Guidelines

### Architecture Rules

| Rule | Description |
|------|-------------|
| **No external deps** | PostgreSQL FTS (not ElasticSearch). Self-hosted Redis (not Upstash). No Supabase, Neon, or managed services. |
| **UTC storage** | Every timestamp is `timestamptz`. Localized at render only. Never store local time. |
| **Soft deletes** | All events use `deleted_at` tombstone. Never `DELETE FROM events`. Critical for offline sync. |
| **Spring physics** | No CSS transitions. Every animation uses Framer Motion spring (web) or Reanimated withSpring (mobile). |
| **Dark mode first** | OLED `#000000` background. `#6366F1` accent sparingly. Surface depth: 4 levels. |
| **Zod validation** | Every API input, MCP argument, and form submission validated with Zod schemas from `packages/shared/`. |
| **RBAC enforcement** | Every mutation checks role hierarchy (OWNER 100 > ADMIN 80 > EDITOR 60 > VIEWER 40 > FREE_BUSY 20). |
| **No OAuth** | Pure self-hosted identity via Better Auth. Email/password + QR bridge only. |

### Code Quality

- **TypeScript strict mode** — zero `any`, zero type errors enforced by CI
- **Single responsibility** — one file = one concern. UI never queries DB directly
- **Component limit** — React components ≤ 300 lines. Extract sub-components or hooks
- **Co-located tests** — `component.tsx` → `component.test.tsx` alongside source
- **Error boundaries** — every route group has `error.tsx`. Every data-fetching component handles loading/empty/error states
- **No spinners** — only skeleton shimmer. No `<Spinner>` components anywhere
- **Workspace imports** — `@novacal/*` packages only. No `../../apps/web/...` relative imports

### Git Workflow

```bash
# Conventional commits with emoji prefixes
# ✨ feat:     new feature
# 🐛 fix:      bug fix
# 🔒️ fix:     security fix
# 🔧 chore:    tooling, configuration
# 📝 docs:     documentation
# ♻️ refactor:  code restructure
# ✅ test:     tests
# 📱 feat:     mobile-specific feature
```

### Agent Mistakes Protocol

Every agent MUST read `agent-mistakes.md` before starting. The file tracks 40+ documented mistakes (M-001 through M-040) with fixes and lessons. Each agent prompt includes "⚠️ Previous mistakes: M-00X" references to prevent recurrence.

---

## 📚 Documentation Index

| Doc | File | Covers | For |
|-----|------|--------|-----|
| 1 | `docs/01-database-schema.md` | 11 tables, Drizzle ORM, GIN indexes, FTS vectors, migrations | Schema work |
| 2 | `docs/02-component-library-global-constants.md` | 17 shadcn components, 13 bespoke web, 9 mobile, animation configs | UI work |
| 3 | `docs/03-api-websocket-contract.md` | 30+ REST endpoints, WebSocket protocol, error codes, rate limits | API work |
| 4 | `docs/04-mcp-server-implementation.md` | 8 MCP tools, SSE transport, RBAC, client integration | AI agents |
| 5 | `docs/05-route-map-web-mobile.md` | All web/mobile routes, layouts, auth gates | Routing |
| 6 | `docs/06-design-specification.md` | Design language, typography, color palette, glassmorphism | Design |
| 7 | `docs/07-component-animation-guide.md` | Framer Motion + Reanimated specs per component | Animations |
| 8 | `docs/08-user-flows-requirements.md` | 10 user flows, 20 FR, 20 FE, traceability matrix | Requirements |
| 9 | `docs/09-master-technical-specification.md` | Architecture, deployment, build roadmap | Architecture |

### Supporting Files

| File | Purpose |
|------|---------|
| `AGENTS.md` | 100 project rules — every agent MUST read this first |
| `agent-mistakes.md` | Mistake log (M-001–M-040) — every agent MUST read before executing |
| `plan.md` | Multi-agent orchestration plan for building the full project |
| `docs/security-audit-report.md` | Security audit findings and remediation |

---

## 🧪 Testing

```bash
# Run all tests
bun run test

# TypeScript check
bun run typecheck

# Lint
bun run lint
```

Tests are co-located with source files in `__tests__/` directories:
- `apps/web/app/api/*/__tests__/` — API route tests
- `apps/mcp-server/__tests__/` — MCP server tests
- `apps/realtime/__tests__/` — WebSocket tests

---

## 🤖 MCP Server (AI Agent Integration)

NovaCal has a built-in MCP server for AI agents:

### 8 Available Tools

| Tool | Description | RBAC |
|------|-------------|------|
| `list_events` | Query events by date range | VIEWER |
| `create_event` | Create event with conflict detection | EDITOR |
| `update_event` | Modify existing event | EDITOR |
| `delete_event` | Delete event (requires `confirmDestructive: true`) | EDITOR |
| `find_common_time` | Find earliest slot across team members | VIEWER |
| `get_availability` | Get free/busy blocks | FREE_BUSY |
| `search_events` | Full-text search with typo tolerance | VIEWER |
| `get_upcoming_events` | Summary of next N days | VIEWER |

### Connecting Claude/Cursor

```json
{
  "mcpServers": {
    "novacal": {
      "url": "https://cal.yourdomain.com/mcp/sse",
      "headers": { "Authorization": "Bearer ncp_key_..." }
    }
  }
}
```

See `docs/04-mcp-server-implementation.md` for full integration guide.

---

## 🏗️ Architecture Overview

### Container Architecture
```
novacal-web       :3000 → REST API + Next.js pages
novacal-realtime  :3001 → WebSocket (UI) + SSE (MCP)
novacal-db        :5432 → PostgreSQL 16 (internal only)
novacal-redis     :6379 → Redis 7 (internal only)
```

### Data Flow
```
Browser/Mobile → REST API (novacal-web:3000) → Drizzle ORM → PostgreSQL
Browser      ↔ WebSocket (novacal-realtime:3001) ↔ Redis Pub/Sub
AI Agent     ↔ SSE (novacal-realtime:3001/mcp)    → MCP Server → PostgreSQL
Mobile       → Local SQLite (offline) → Sync Queue → REST API (on reconnect)
```

---

## 🔒 Security

- **API keys**: SHA-256 hashed in DB. `revokedAt` column for invalidation.
- **QR auth**: 60s TTL, single-use challenges, unguessable UUID WebSocket channels.
- **RBAC**: 5-tier role hierarchy enforced at API + MCP layer.
- **RLS**: PostgreSQL Row-Level Security on all 11 tables (defense in depth).
- **Rate limiting**: Auth 10 req/min, Standard 100 req/min, MCP 100 req/min, Search 30 req/min.
- **Headers**: X-Content-Type-Options, X-Frame-Options, CSP, HSTS on all services.
- **.env**: `.gitignore`-d. Never commit secrets. See `.env.example` for template.

---

## 🗺️ Roadmap

| Priority | Feature | Status |
|----------|---------|--------|
| P0 | Bun monorepo + workspace structure | ✅ Done |
| P0 | Docker Compose (PG + Redis) | ✅ Done |
| P0 | Drizzle schema (11 tables) | ✅ Done |
| P0 | Better Auth (email/password + QR) | ✅ Done |
| P1 | WebSocket server + Redis Pub/Sub | ✅ Done |
| P1 | QR auth bridge | ✅ Done |
| P1 | Calendar UI (Day/Week/Month + DnD) | ✅ Done |
| P1 | Event CRUD + UTC timezone | ✅ Done |
| P1 | RBAC (5 roles) | ✅ Done |
| P2 | RRule recurrence | ✅ Done |
| P2 | PostgreSQL FTS search | ✅ Done |
| P2 | Expo mobile app scaffold | ✅ Done |
| P2 | MCP server (8 tools) | ✅ Done |
| P2 | Public share links | ✅ Done |
| P3 | Offline SQLite sync | ✅ Done |
| P3 | .ics export | ✅ Done |
| P3 | FCM push notifications | ✅ Done |
| P3 | MCP config page | ✅ Done |

---

## 🤝 Contributing

1. Read `AGENTS.md` completely (100 rules)
2. Read `agent-mistakes.md` (40+ documented mistakes to avoid)
3. Read relevant `docs/*.md` for your domain
4. Run `bun install` and `bun run typecheck` to verify setup
5. Follow conventional commit format: `emoji type: description`
6. Ensure `bun run typecheck` and `bun run test` pass before PR

---

## 📄 License

MIT

---

**Built with** ☕, [Bun](https://bun.sh/), [Next.js](https://nextjs.org/), [Drizzle ORM](https://orm.drizzle.team/), [shadcn/ui](https://ui.shadcn.com/), and [Expo](https://expo.dev/).
