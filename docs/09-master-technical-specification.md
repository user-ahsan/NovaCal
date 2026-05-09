# 🏗️ 🏗️ NovaCal — Master Technical & Feature Specification

# 🏗️ NovaCal — Master Technical & Feature Specification

> **Project:** NovaCal — Pure, Self-Hosted Intelligent Calendar Platform **Deployment:** Docker (Dokploy) on self-hosted VPS **Philosophy:** Zero external dependencies, Bun-native, QR auth bridge, real-time via WebSockets, built-in MCP server for AI agents


---

## 1. Core Architecture & Tech Stack

### Monorepo & Tooling

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Monorepo** | Bun Workspaces | Native Bun runtime. Significantly faster dependency resolution and script execution than NPM. |
| **Web Frontend** | Next.js 15 (App Router) | Best-in-class SSR/SEO for public shared links. API routes co-located with pages. React Server Components for minimal client JS. |
| **Mobile App** | React Native + Expo | Android-first. Shares types, validation schemas, and utility logic with web via the monorepo workspace. |
| **Database** | Pure PostgreSQL 16 (Dockerized) | Running natively on your VPS. No managed DB service. Full control. |
| **ORM** | Drizzle ORM | Lightweight, maps 1:1 to SQL. No hidden magic. Full type safety. |
| **Authentication** | Better Auth | Redis-backed session management. Flexible enough for custom QR bridge. Zero vendor lock-in. |
| **Real-Time Engine** | Custom Node.js WebSocket Server + Redis Pub/Sub | Replaces Supabase Realtime. Zero-latency UI updates, QR bridge signaling, team collaboration broadcasts. |
| **AI / MCP Server** | Node.js + `@modelcontextprotocol/sdk` via SSE | Built into the monorepo as a core service. SSE transport for remote AI agents (Cursor, Claude, OpenCode). |
| **Caching / Queue** | Redis (Dockerized) | Better Auth sessions, WebSocket Pub/Sub routing, rate limiting, ephemeral challenge tokens. |

### Project Structure

```
novacal/
├── apps/
│   ├── web/                      # Next.js 15 (App Router)
│   │   ├── app/
│   │   │   ├── (auth)/           # Login, register, QR scan page
│   │   │   ├── (dashboard)/      # Calendar views, settings
│   │   │   ├── api/              # REST API routes
│   │   │   │   ├── auth/         # Better Auth handlers + QR bridge
│   │   │   │   ├── events/       # CRUD, search, share
│   │   │   │   ├── teams/        # Workspace RBAC management
│   │   │   │   └── mcp/          # SSE endpoint for AI agents
│   │   │   └── p/                # Public share routes (/p/[hash])
│   │   ├── components/
│   │   └── lib/
│   ├── mobile/                   # Expo React Native
│   │   ├── app/                  # Expo Router screens
│   │   ├── components/
│   │   └── services/             # API client, offline sync, FCM
│   ├── realtime/                 # Custom Node.js WebSocket server
│   │   ├── handlers/             # Connection, Pub/Sub, rooms
│   │   ├── rooms/                # Team workspace channel management
│   │   └── index.ts
│   └── mcp-server/               # MCP SDK SSE server
│       ├── tools/
│       │   ├── fts-search.ts
│       │   ├── get-availability.ts
│       │   └── create-smart-event.ts
│       └── index.ts
├── packages/
│   ├── shared/                   # Zod schemas, TypeScript types, constants
│   ├── db/                       # Drizzle schema, migrations, client
│   ├── auth/                     # Better Auth server + client config
│   └── ui/                       # Shared shadcn/ui components
├── docker/
│   ├── compose.yml               # Orchestrates all 4 containers
│   └── Dockerfile                # Multi-stage build for web app
├── package.json                  # Bun workspace root
└── bun.lock
```


---

## 2. Authentication & Security (The QR Bridge)

### A. Identity Management

| Feature | Implementation |
|---------|----------------|
| **Standard Auth** | Email/password registration via Better Auth. No third-party OAuth. |
| **Session Control** | Redis-backed active device tracking. Users can view active sessions (IP, device, timestamp) and remotely revoke them from the dashboard. |
| **Zero-Dependency** | No Google, Apple, or GitHub OAuth. Pure self-hosted identity. |

### B. Zero-Latency QR Bridge

This is the mechanism that allows the mobile app to authenticate the web UI without typing credentials.

```
┌────────────┐         ┌──────────────────┐         ┌────────────┐
│   Web UI   │         │  Node.js Server   │         │  Android   │
│  (Browser) │         │ (WebSocket + API) │         │  (Expo)    │
└──────┬─────┘         └────────┬─────────┘         └─────┬──────┘
       │                       │                         │
       │ 1. Generate           │                         │
       │    Challenge UUID     │                         │
       │    → store in Redis   │                         │
       │    → subscribe to     │                         │
       │      WS channel       │                         │
       │◄──────────────────────│                         │
       │                       │                         │
       │ 2. Display QR code    │                         │
       │    (Challenge UUID)   │                         │
       │                       │                         │
       │ 3. QR refreshes       │                         │
       │    every 60 seconds   │                         │
       │                       │                         │
       │                       │                         │ 4. User scans
       │                       │                         │    QR Code
       │                       │                         │◄─────────
       │                       │                         │
       │                       │ 5. POST /auth-bridge    │
       │                       │    { challengeUUID,     │
       │                       │      authToken }        │
       │                       │◄────────────────────────│
       │                       │                         │
       │                       │ 6. Validate mobile      │
       │                       │    session              │
       │                       │ 7. Write web session    │
       │                       │    token to Redis       │
       │                       │ 8. Publish              │
       │                       │    LOGIN_SUCCESS        │
       │                       │    to WS channel        │
       │                       │                         │
       │ 9. Receive            │                         │
       │    LOGIN_SUCCESS via  │                         │
       │    WebSocket          │                         │
       │◄──────────────────────│                         │
       │                       │                         │
       │ 10. Redirect to       │                         │
       │     dashboard         │                         │
```

#### Endpoint Specification

```
POST /api/auth/approve-qr
Auth: Required (mobile Bearer token)
Body: {
  challengeUUID: string,
  mobileAuthToken: string
}
Response 200: { success: true, sessionToken: string }
Errors:
  - 401: Invalid or expired mobile auth token
  - 404: Challenge UUID not found or expired
  - 409: Challenge already consumed

WebSocket Event (to browser):
{
  type: "LOGIN_SUCCESS",
  payload: { sessionToken: string, userId: string }
}
```

**Key design decisions:**

* Challenge UUIDs expire after 60 seconds (matching QR refresh interval)
* Redis stores `challenge:{uuid}` → `{ status: "PENDING" | "APPROVED", userId: null | string }`
* WebSocket channel is UUID-based (unguessable), so no authentication needed on the WS connection itself
* Zero polling — browser receives the event the instant the mobile app approves


---

## 3. Core Calendar Engine (Lean & Fast)

### A. Visual Interface

| Feature | Detail |
|---------|--------|
| **Grid Views** | Day, 3-Day, Work Week, Full Week, Month, Year |
| **Interactivity** | Drag-and-drop rescheduling. Drag-to-resize duration adjustments. |
| **Theming** | Dark mode / Light mode. Respects system preference (`prefers-color-scheme`). |
| **Components** | Built with Tailwind CSS + shadcn/ui primitives. Radix UI for complex interactions. |

### B. Event Data Model (Text-Only, High Performance)

| Field | Type | Notes |
|-------|------|-------|
| `id`  | `uuid` | Primary key |
| `title` | `text` | Required |
| `description` | `text` | **Markdown supported** (bold, lists, links, code blocks). |
| `location` | `text` | Plain text or link |
| `startTime` | `timestamptz` | UTC only |
| `endTime` | `timestamptz` | UTC only |
| `timezone` | `text` | IANA timezone string (e.g., `"America/New_York"`) |
| `recurrence` | `jsonb` | RRule spec |
| `workspaceId` | `uuid` | FK to workspaces |
| `createdBy` | `uuid` | FK to users |
| `isAllDay` | `boolean` | Default false |

#### Strict No-Attachments Policy

* No PDFs, no images, no file uploads on events
* Keeps database lightweight, backups small, page loads instant
* Descriptions support Markdown for rich text without the bloat

#### Advanced Recurrence (RRule)

Full iCalendar RRule support via the `rrule` library:

```
Every 2nd Tuesday               → FREQ=WEEKLY;BYDAY=TU;INTERVAL=2
Weekdays until Dec 2026         → FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;UNTIL=20261231
Every month on the 15th         → FREQ=MONTHLY;BYMONTHDAY=15
```

#### Timezone Mastery

* **Storage:** Always UTC (`timestamptz`)
* **Display:** Rendered in user's local timezone (from browser `Intl` or user preference)
* **Override:** Individual events can specify a different display timezone
* **Key principle:** UTC in the database. Localized at the edge. Never store local time.

### C. High-Speed Search (PostgreSQL FTS)

No external search engine needed. PostgreSQL's built-in Full-Text Search is sufficient at this scale.

```sql
-- Index (created via Drizzle migration)
CREATE INDEX idx_events_fts ON events USING GIN(
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(location, ''))
);

-- Query (via Drizzle raw SQL or RPC)
SELECT * FROM events
WHERE to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
  @@ to_tsquery('english', 'meeting & deadline');
```

| Property | Behavior |
|----------|----------|
| **Engine** | PostgreSQL native `tsvector` / `tsquery` |
| **Fields** | Title, Description, Location |
| **Speed** | Lightning-fast via GIN index |
| **Tolerance** | Typo-tolerant via prefix matching (`to_tsquery('english', 'meet:*')`) |
| **External deps** | Zero. No ElasticSearch, no MeiliSearch, no Algolia. |


---

## 4. Multi-Team Collaboration & RBAC

### A. Real-Time Multi-Team Editing

| Component | Implementation |
|-----------|----------------|
| **Transport** | Custom Node.js WebSocket server (`apps/realtime/`) |
| **Pub/Sub** | Redis Pub/Sub for horizontal scaling (future-proof) |
| **Room model** | Each Team Workspace is a WebSocket room |
| **Broadcast** | Event mutations (create, update, delete, move) broadcast instantly to all connected clients in that workspace |
| **Optimistic UI** | Calendar updates immediately on user action. Background reconciliation with DB ensures consistency. |

**WebSocket event flow:**

```
User drags event → Client sends { type: "EVENT_MOVE", payload: { id, start, end } }
→ Server validates → Updates DB → Broadcasts to room → All clients update instantly
```

### B. Role-Based Access Control (RBAC)

#### Workspace Model

Users belong to one or more Workspaces. Each workspace is an isolated data environment.

| Role | Permissions |
|------|-------------|
| **Owner** | Full control. Billing, delete workspace, transfer ownership, all admin actions. |
| **Admin** | Invite/remove users, modify workspace settings, manage roles, full event access. |
| **Editor** | Create, edit, delete events within the workspace. |
| **Viewer** | Read-only access to all events (titles, descriptions, details). |
| **Free-Busy Viewer** | Can only see time blocks marked "Busy". No titles, no descriptions, no attendee details. |

#### Conflict Detection

When scheduling an event:


1. Server checks existing events in the same workspace + time range
2. If overlap found for any team member → immediate UI warning
3. UI displays: `"⚠️ Conflict: Sarah has 'Sprint Review' at 2-3 PM"`


---

## 5. Public Connectivity & Sharing

### Cryptographic Links

| Feature | Detail |
|---------|--------|
| **URL format** | `/p/[secure_hash]` — unique, revokable, unguessable |
| **Scope** | Entire calendar view OR individual event |
| **Revocation** | One-click revoke from dashboard. Invalidates hash immediately. |
| **Optional password** | Additional password gate on the public link |
| **Expiration** | Set TTL on the link (e.g., "expires in 7 days") |
| **Generation** | `crypto.randomBytes(32).toString('hex')` — no incrementing IDs |

### Standard Exports

* **.ics download:** Export individual events or entire calendar views
* **Compatible with:** Outlook, Apple Calendar, Google Calendar, Thunderbird


---

## 6. AI & MCP Server (The Built-in Brain)

### Architecture

The MCP server is a first-class citizen in the monorepo, not an afterthought. It exposes tools to AI agents (Cursor, Claude, OpenCode) over SSE.

```
┌──────────────┐     SSE (long-lived)     ┌──────────────────┐
│  AI Agent    │◄──────────────────────►  │  /api/mcp         │
│  (Cursor,    │                          │  Node.js +        │
│   Claude)    │                          │  @mcp/sdk         │
└──────────────┘                          └────────┬─────────┘
                                                   │
                                                   ▼
                                            ┌──────────────┐
                                            │  PostgreSQL   │
                                            │  (via Drizzle)│
                                            └──────────────┘
```

### Exposed Tools

| Tool | Description | Input | Output |
|------|-------------|-------|--------|
| `fts_search` | Query the PostgreSQL FTS engine directly | `{ query: string, workspaceId: string, limit?: number }` | `Event[]` with relevance scores |
| `get_availability` | Cross-reference multiple team members to find free blocks | `{ userIds: string[], dateFrom: string, dateTo: string }` | `{ available: TimeBlock[], conflicts: Conflict[] }` |
| `create_smart_event` | Accept natural language, parse ISO-8601 timestamps, write to DB | `{ description: string, workspaceId: string }` | `{ event: Event, parsed: { title, start, end } }` |

### Authentication

| Method | Detail |
|--------|--------|
| **Header** | `x-mcp-api-key: ncp_key_...` |
| **Generation** | Generated from user dashboard. One-click revoke. |
| **Storage** | Hashed in DB (bcrypt). Plaintext shown once on creation. |

### Self-Documenting Endpoint

```
GET /api/mcp/config
Response: {
  "mcpServers": {
    "novacal": {
      "url": "wss://your-domain.com/api/mcp",
      "headers": { "x-mcp-api-key": "ncp_key_..." }
    }
  }
}
```

This JSON can be directly copy-pasted into Cursor's MCP configuration or Claude's `mcp.json`.


---

## 7. Android Mobile Application

| Feature | Implementation |
|---------|----------------|
| **Framework** | React Native + Expo (managed workflow) |
| **QR Scanner** | Dedicated camera module for the Web UI QR bridge |
| **Offline-First** | Embedded SQLite cache (via `expo-sqlite`). Calendar readable and writable offline. |
| **Sync Engine** | On reconnect: queue local changes, push to PostgreSQL, pull remote changes, reconcile. |
| **Notifications** | Firebase Cloud Messaging (FCM) for meeting reminders and invite notifications. |
| **Auth** | Standard email/password login. Persistent session in secure storage. |

### Offline Sync Logic

```
User creates event while offline
  → Stored in local SQLite with status: "PENDING_SYNC"
  → Added to local sync queue

Device regains connectivity
  → Sync engine fires
  → Pushes pending events to POST /api/events/sync
  → Pulls remote changes since last sync timestamp
  → Merges and reconciles (last-write-wins with user notification on conflicts)
  → Updates local SQLite
```


---

## 8. Deployment & Infrastructure (Dokploy Target)

Everything runs on your VPS. No external services. Four Docker containers.

### Docker Compose

```yaml
# docker/compose.yml
services:
  novacal-web:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    ports:
      - "3000:3000"       # Next.js + REST API
    env_file: ../.env
    depends_on:
      novacal-db:
        condition: service_healthy
      novacal-redis:
        condition: service_started
    networks:
      - novacal-net

  novacal-realtime:
    build:
      context: ..
      dockerfile: docker/realtime.Dockerfile
    ports:
      - "3001:3001"       # WebSockets (UI) + SSE (MCP)
    env_file: ../.env
    depends_on:
      - novacal-redis
    networks:
      - novacal-net

  novacal-db:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U novacal"]
    env_file: ../.env
    networks:
      - novacal-net

  novacal-redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data
    networks:
      - novacal-net

volumes:
  pgdata:
  redisdata:

networks:
  novacal-net:
```

### Networking

| Component | Internal Port | External Access | Protocol |
|-----------|---------------|-----------------|----------|
| `novacal-web` | 3000          | Via Dokploy (domain) | HTTPS (REST + pages) |
| `novacal-realtime` | 3001          | Via Dokploy (subdomain) | WSS (WebSocket + SSE) |
| `novacal-db` | 5432          | Internal only   | TCP      |
| `novacal-redis` | 6379          | Internal only   | TCP      |

### Dokploy Ingress Mapping

```
calendar.yourdomain.com → novacal-web:3000
ws.yourdomain.com       → novacal-realtime:3001
```

### Cloudflare Tunnel Compatibility

Both `novacal-web` and `novacal-realtime` support `X-Forwarded-For` and `X-Forwarded-Proto` header trust, configured via the `TRUST_PROXY` environment variable. This ensures correct IP detection and cookie security when running behind Cloudflare Tunnels.


---

## ✅ Environment Variables

```env
# ── Database ──
DATABASE_URL=postgresql://novacal:password@novacal-db:5432/novacal

# ── Redis ──
REDIS_URL=redis://novacal-redis:6379

# ── Auth ──
BETTER_AUTH_SECRET=your-secret-here
BETTER_AUTH_URL=https://calendar.yourdomain.com

# ── MCP ──
MCP_PORT=3001
MCP_API_KEY=ncp_key_...

# ── Real-time Server ──
WS_PORT=3001
WS_URL=wss://ws.yourdomain.com

# ── Network ──
TRUST_PROXY=false
NODE_ENV=production
```


---

## 📋 Prioritized Build Roadmap

| Priority | Task | Dependencies |
|----------|------|--------------|
| **P0**   | Initialize Bun monorepo with workspace structure | —            |
| **P0**   | Set up Docker Compose (PostgreSQL 16 + Redis 7) | —            |
| **P0**   | Create Drizzle schema (users, workspaces, events, sessions) | DB running   |
| **P0**   | Implement Better Auth (email/password + Redis sessions) | DB + Redis   |
| **P1**   | Build custom Node.js WebSocket server with Redis Pub/Sub | Redis        |
| **P1**   | Implement QR auth bridge (challenge → WS → login) | Auth + WS    |
| **P1**   | Build calendar UI (Day/Week/Month views, drag-and-drop) | shadcn/ui    |
| **P1**   | Implement event CRUD with Drizzle + UTC timezone storage | DB schema    |
| **P1**   | Set up RBAC (Owner/Admin/Editor/Viewer/Free-Busy) | Auth + DB    |
| **P2**   | Add RRule recurrence support | Event model  |
| **P2**   | Build PostgreSQL FTS search (GIN index + tsquery) | DB           |
| **P2**   | Scaffold Expo mobile app with QR scanner | Shared package |
| **P2**   | Build MCP server with SSE + `fts_search` tool | DB           |
| **P2**   | Implement public share links (`/p/[hash]`) | Event model  |
| **P2**   | Implement Cloudflare `TRUST_PROXY` toggle | —            |
| **P3**   | Add `get_availability` + `create_smart_event` MCP tools | MCP server   |
| **P3**   | Implement Offline-First SQLite sync for mobile | Mobile app   |
| **P3**   | Add .ics export | Event model  |
| **P3**   | Implement FCM push notifications | Mobile app   |
| **P3**   | Self-documenting MCP config page at `/api/mcp/config` | MCP server   |
