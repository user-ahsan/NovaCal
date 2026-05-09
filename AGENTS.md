# AGENTS.md — NovaCal Universal Agent Context

> **Recognized by:** Cursor, Claude Code, OpenCode, Copilot, and all standard AI coding agents.
> **Purpose:** Definitive single source of truth for the NovaCal project. Every agent MUST read this file before executing any task.
> **Philosophy:** Zero hallucinations. Zero rogue file creation. One way to do everything. Documentation-driven development.

---

## Project Identity

**NovaCal** is a pure, self-hosted intelligent calendar platform. Zero external SaaS dependencies. Bun-native monorepo, QR passwordless auth bridge, real-time WebSocket collaboration, built-in MCP server for AI agents (Cursor/Claude/OpenCode), offline-first mobile app.

**Deployment target:** Docker via Dokploy on self-hosted VPS.
**Database:** PostgreSQL 16 + Redis 7 (both Dockerized).
**Protocol:** SSE for MCP. WebSocket for real-time UI. REST for everything else.
**Timezone rule:** UTC storage always. Localized at render time only. Never store local time.

---

## Tech Stack (Authoritative)

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Bun | Latest |
| Web | Next.js 15 App Router | 15 |
| Mobile | React Native + Expo | Latest |
| ORM | Drizzle ORM | Latest |
| Auth | Better Auth | Latest |
| DB | PostgreSQL | 16 |
| Cache/Queue | Redis | 7 |
| Real-time | Custom Node.js WS + Redis Pub/Sub | - |
| MCP | @modelcontextprotocol/sdk | Latest |
| UI Components | shadcn/ui | Latest |
| Styling | Tailwind CSS | v4 |
| Animation (Web) | Framer Motion | Latest |
| Animation (Mobile) | React Native Reanimated | Latest |
| Deployment | Docker + Dokploy | - |

---

## Merged Directory Structure

This is the SINGLE canonical directory layout. All docs agree on this structure. Do NOT create files outside this tree. Do NOT invent new directories.

```
novacal/
├── apps/
│   ├── web/                          # Next.js 15 (App Router)
│   │   ├── app/
│   │   │   ├── (auth)/               # Login, register, QR scan page
│   │   │   │   ├── setup/            # First-run wizard (Instance Admin)
│   │   │   │   ├── login/            # Email/password fallback
│   │   │   │   │   └── qr/           # Dynamic QR code page
│   │   │   │   └── auth/callback/    # Better Auth session handler
│   │   │   ├── (dashboard)/          # Authenticated calendar views
│   │   │   │   ├── calendar/         # Main grid (day/week/month)
│   │   │   │   ├── agenda/           # Infinite scroll list
│   │   │   │   └── search/           # Full-text search
│   │   │   ├── (developer)/          # MCP config, API keys, webhooks
│   │   │   │   ├── mcp/              # AI agent config hub
│   │   │   │   ├── api-keys/         # REST API key management
│   │   │   │   └── webhooks/         # Outgoing webhook config
│   │   │   ├── (workspace)/          # Team management
│   │   │   │   └── w/[id]/
│   │   │   │       ├── settings/     # Workspace settings
│   │   │   │       └── members/      # Member directory + roles
│   │   │   ├── (admin)/              # Instance administration
│   │   │   │   ├── dashboard/        # Global metrics
│   │   │   │   ├── users/            # User management
│   │   │   │   └── system/           # Diagnostics
│   │   │   ├── (settings)/           # User personal settings
│   │   │   │   ├── profile/
│   │   │   │   ├── security/
│   │   │   │   ├── sessions/         # Device ledger
│   │   │   │   └── preferences/
│   │   │   ├── (public)/             # Public sharing routes
│   │   │   │   ├── p/[hash]/         # Public calendar view
│   │   │   │   └── e/[hash]/         # Single event landing
│   │   │   ├── api/                  # REST API route handlers
│   │   │   │   ├── auth/             # Better Auth + QR bridge
│   │   │   │   ├── events/           # CRUD + search
│   │   │   │   ├── workspaces/       # RBAC management
│   │   │   │   ├── share/            # Public link CRUD
│   │   │   │   ├── mcp/              # SSE endpoint for AI agents
│   │   │   │   └── system/           # Health + metrics
│   │   │   ├── not-found.tsx         # 404 page
│   │   │   └── error.tsx             # 500 page
│   │   ├── components/               # App-specific React components
│   │   └── lib/                      # Server utilities
│   ├── mobile/                       # Expo React Native
│   │   ├── app/                      # Expo Router screens
│   │   │   ├── (auth)/               # connect, login, scanner
│   │   │   ├── (tabs)/               # calendar, agenda, notifications, settings
│   │   │   ├── (modals)/             # event/new, event/[id], search
│   │   │   ├── (settings)/           # profile, workspaces, sync
│   │   │   ├── +not-found.tsx
│   │   │   └── _layout.tsx
│   │   ├── components/               # Mobile-specific components
│   │   └── services/                 # API client, offline sync, FCM
│   ├── realtime/                     # Custom Node.js WebSocket server
│   │   ├── handlers/
│   │   ├── rooms/
│   │   └── index.ts
│   └── mcp-server/                   # MCP SDK SSE server
│       ├── tools/                    # MCP tool implementations
│       │   ├── list-events.ts
│       │   ├── create-event.ts
│       │   ├── update-event.ts
│       │   ├── delete-event.ts
│       │   ├── find-common-time.ts
│       │   ├── get-availability.ts
│       │   ├── search-events.ts
│       │   └── get-upcoming-events.ts
│       ├── auth.ts                   # Bearer token validation
│       ├── rbac.ts                   # Tool-scoped role checks
│       └── index.ts                  # SSE transport + server setup
├── packages/
│   ├── shared/                       # Zod schemas, TS types, constants
│   │   ├── constants/
│   │   │   ├── animation.ts          # Web spring configs
│   │   │   ├── animation.mobile.ts   # Reanimated configs
│   │   │   └── system.ts            # Roles, time, cache, pagination
│   │   └── types/                    # Shared TypeScript interfaces
│   ├── db/                           # Drizzle ORM
│   │   ├── schema/
│   │   │   ├── auth.ts              # users, sessions, qr_challenges
│   │   │   ├── workspace.ts         # workspaces, workspace_members, roleEnum
│   │   │   ├── calendar.ts          # calendars, events, event_attendees
│   │   │   ├── developer.ts         # api_keys, webhooks
│   │   │   ├── sharing.ts           # public_links
│   │   │   └── index.ts             # Re-exports all schemas
│   │   ├── migrations/              # Drizzle + raw SQL migration files
│   │   └── client.ts                # Drizzle client instance
│   ├── auth/                         # Better Auth server + client config
│   └── ui/                           # Shared shadcn/ui styled components
│       ├── button.tsx
│       ├── input.tsx
│       ├── dialog.tsx
│       └── ... (17 shadcn primitives)
├── docker/
│   ├── compose.yml                   # Orchestrates 4 containers
│   ├── Dockerfile                    # Multi-stage web build
│   └── realtime.Dockerfile           # WebSocket server build
├── docs/                             # Full technical documentation
│   ├── 01-database-schema.md
│   ├── 02-component-library-global-constants.md
│   ├── 03-api-websocket-contract.md
│   ├── 04-mcp-server-implementation.md
│   ├── 05-route-map-web-mobile.md
│   ├── 06-design-specification.md
│   ├── 07-component-animation-guide.md
│   ├── 08-user-flows-requirements.md
│   └── 09-master-technical-specification.md
├── package.json                      # Bun workspace root
├── bun.lock
├── .env                              # Environment variables (gitignored)
├── .env.example                      # Template for env vars
└── AGENTS.md                         # THIS FILE
```

---

## Architecture Overview

### Container Architecture (4 Docker services)
```
novacal-web       :3000 → REST API + Next.js pages
novacal-realtime  :3001 → WebSocket (UI) + SSE (MCP)
novacal-db        :5432 → PostgreSQL 16 (internal only)
novacal-redis     :6379 → Sessions, Pub/Sub, rate limiting (internal only)
```

### Data Flow
```
Browser/Mobile → REST API (novacal-web:3000) → Drizzle ORM → PostgreSQL
Browser      ↔ WebSocket (novacal-realtime:3001) ↔ Redis Pub/Sub
AI Agent     ↔ SSE (novacal-realtime:3001/mcp)    → MCP Server → PostgreSQL
Mobile       → Local SQLite (offline) → Sync Queue → REST API (on reconnect)
```

### Database Tables (11 tables, from 01-database-schema.md)
| Table | Domain | Key |
|-------|--------|-----|
| `users` | Auth | PK id, UNIQUE email |
| `sessions` | Auth | PK id (text), FK user_id |
| `qr_challenges` | Auth | PK id, 60s TTL |
| `workspaces` | Collaboration | PK id, UNIQUE slug |
| `workspace_members` | Collaboration | Composite PK (workspaceId, userId) |
| `calendars` | Scheduling | PK id, FK workspace_id |
| `events` | Scheduling | PK id, GIN FTS index, sync index |
| `event_attendees` | Scheduling | Composite PK (eventId, userId) |
| `api_keys` | Developer | PK id, UNIQUE key_hash |
| `webhooks` | Developer | PK id |
| `public_links` | Sharing | PK id, UNIQUE hash |

---

## AGENT RULES — The 100 Commandments

### ─── FOUNDATIONAL RULES (1–15) ───

1. **READ AGENTS.MD FIRST.** Every agent (Cursor, Claude, OpenCode, Copilot) must read this file before executing any task. No exceptions.

2. **DOCS ARE THE SOURCE OF TRUTH.** The `docs/` folder contains the complete technical specification. When in doubt, read the relevant doc. Never guess.

3. **NO HALLUCINATIONS.** Do not invent packages, APIs, routes, database tables, or components that are not defined in the docs. Everything must be traceable to a doc reference.

4. **ONE WAY TO DO EVERYTHING.** For any given task (creating an event, adding a route, writing a migration), there is exactly ONE pattern. Follow the docs. Do not introduce alternative approaches.

5. **NO DUPLICATION.** Never create a second component, utility, hook, or function that does what an existing one already does. Search the codebase before creating anything new.

6. **NO ROGUE FILE CREATION.** Do not create files outside the canonical directory structure defined above. Every file has a designated home. Use it.

7. **NO MULTIPLE SOLUTIONS TO ONE PROBLEM.** If there are two ways to handle auth, two ways to style components, or two ways to do animations, delete one. Pick the documented approach.

8. **STRICT MONOREPO DISCIPLINE.** `packages/shared/` for shared code. `apps/` for application code. Never import from `apps/web` into `apps/mobile`. Always use `packages/` as the bridge.

9. **TYPE EVERYTHING.** Every function, component, API route, and database query must be fully typed with TypeScript. No `any`. No untyped exports.

10. **ZOD FOR ALL VALIDATION.** Every API input, MCP tool argument, and form submission must be validated with Zod schemas from `packages/shared/`.

11. **DOCS BEFORE CODE.** When implementing a feature, reference the specific doc section(s) that define it. Link doc section to implementation in PRs.

12. **NEVER INSTALL PACKAGES AUTONOMOUSLY.** Do not run `npm install`, `bun add`, `npx shadcn-ui add`, or any package installation command without explicit user approval. Present the required package and ask.

13. **NEVER RUN SHELL COMMANDS WITHOUT APPROVAL.** Database migrations, Docker commands, git operations, file deletions, and any destructive shell command require explicit user approval.

14. **NEVER MODIFY CONFIG FILES WITHOUT CONTEXT.** Database URLs, auth secrets, environment variables, Docker compose files, and CI configs are sacred. Changes require user approval and doc reference.

15. **STOP ON ERRORS. REPORT. DO NOT AUTO-FIX.** When a test fails, a build breaks, or a command errors — STOP immediately. Report the error with full context. Propose a fix. Request approval. Never auto-correct silently.

### ─── CODE QUALITY & ARCHITECTURE (16–30) ───

16. **CLEAN ARCHITECTURE PILLARS.** Separation of concerns: UI components never query the database directly. Services handle business logic. Repositories handle data access. Routes handle HTTP.

17. **NO OVER-ENGINEERING.** Don't add abstraction layers "just in case." New abstractions require justification with a specific doc reference.

18. **COMPONENT SIZE LIMIT.** Single React component files should not exceed 300 lines. If larger, extract sub-components or custom hooks.

19. **SINGLE RESPONSIBILITY PER FILE.** One file = one concern. Don't mix API route handlers with business logic. Don't mix database queries with React components.

20. **SHARED CODE IN PACKAGES.** Any code used by both web and mobile apps belongs in `packages/shared/`. Types, constants, validation schemas, and utility functions live there.

21. **NO RELATIVE IMPORTS ACROSS APPS.** Use workspace package imports (`@novacal/shared`, `@novacal/db`, `@novacal/ui`). Never `../../apps/web/...`.

22. **CONSISTENT NAMING.** Components: PascalCase. Functions: camelCase. Files: kebab-case for components, camelCase for utilities. Database tables: snake_case. TypeScript types: PascalCase.

23. **EXPLICIT EXPORTS.** Every package must have a clear `index.ts` barrel export. No importing from deep internal paths.

24. **NO MAGIC NUMBERS.** All constants live in `packages/shared/constants/`. Animation values, timeouts, limits, role hierarchies — all defined once, referenced everywhere.

25. **ERROR BOUNDARIES EVERYWHERE.** Every route group must have an `error.tsx`. Every data-fetching component must handle loading, empty, and error states.

26. **NO SWALLOWED ERRORS.** Every try/catch must either: (a) show user-facing error, (b) log to observability, or (c) re-throw. Never `catch(e) {}` silently.

27. **PREFER SERVER COMPONENTS.** In Next.js App Router, components are Server Components by default. Only add `"use client"` when you need interactivity, browser APIs, or hooks.

28. **NO PROP DRILLING BEYOND 2 LEVELS.** Beyond 2 levels of prop passing, use React Context, URL search params, or state management. Not Redux — use Zustand or React Query.

29. **CO-LOCATE TESTS.** Test files live alongside their source files. `component.tsx` → `component.test.tsx`. Integration tests in `__tests__/` at the feature level.

30. **NO DEAD CODE.** Remove unused imports, variables, and comments before committing. Use ESLint and the TypeScript compiler to enforce this.

### ─── DATABASE & DATA RULES (31–45) ───

31. **UTC-ONLY STORAGE.** Every timestamp in the database is UTC (`timestamptz`). Never store local time. Timezone conversion happens at the presentation layer only.

32. **SOFT DELETES FOR SYNC.** All event deletions use `deleted_at` column (soft delete). Never `DELETE FROM events` directly. This enables offline reconciliation.

33. **DRIZZLE FOR ALL MIGRATIONS.** Schema changes go through Drizzle ORM migration files in `packages/db/migrations/`. No manual SQL for schema creation. Raw SQL only for performance indexes.

34. **RLS-READY FOREIGN KEYS.** Every table referencing user data has a foreign key to the users table. PostgreSQL Row Level Security is the hard backstop for multi-tenant isolation.

35. **GIN INDEX FOR FULL-TEXT SEARCH.** Event search uses PostgreSQL native `tsvector`/`tsquery` with a GIN index. No ElasticSearch. No external search service.

36. **COMPOSITE INDEX FOR GRID QUERIES.** `idx_events_time_range` on `(calendar_id, start_time, end_time) WHERE deleted_at IS NULL` is mandatory for calendar grid performance.

37. **SYNC INDEX.** `idx_events_sync` on `(updated_at)` enables mobile offline sync pull queries without full table scans.

38. **WEIGHTED FTS.** Full-text search ranks: Title (A weight) > Location (B weight) > Description (C weight). Defined in generated `search_vector` column.

39. **NO BINARY ATTACHMENTS.** Events do not support file uploads (images, PDFs). Description is Markdown-only. Enforced at the API validation layer.

40. **POLYMORPHIC SHARING TABLE.** `public_links` uses `entity_type` + `entity_id` pattern to serve both calendar views and event landing pages from a single table.

41. **COMPOSITE PRIMARY KEYS.** `workspace_members` and `event_attendees` use composite PKs to prevent duplicate membership/attendance.

42. **BETTER AUTH CONVENTIONS.** Sessions use text PK (not UUID) per Better Auth standard. QR challenges have 60-second hard TTL.

43. **ROLE HIERARCHY IN DATABASE.** `workspace_role` enum: `OWNER` (100) > `ADMIN` (80) > `EDITOR` (60) > `VIEWER` (40) > `FREE_BUSY` (20). Numeric hierarchy enables efficient permission checks.

44. **RESTRICT DELETE ON OWNERS.** `workspaces.owner_id` uses `onDelete: "restrict"`. Cannot delete a user who owns workspaces. Must transfer ownership first.

45. **API KEY HASHING.** API keys are bcrypt-hashed in the database. Plaintext shown once on creation. `key_hash` has a UNIQUE constraint.

### ─── API & CONTRACT RULES (46–60) ───

46. **BASE URL CONVENTION.** All REST endpoints under `/api/v1/`. WebSocket at `wss://ws.yourdomain.com/realtime`. MCP SSE at `/mcp/sse`.

47. **STANDARD ERROR FORMAT.** Every API error follows: `{ error: { code: string, message: string, details: object } }`. Six error codes: UNAUTHORIZED, VALIDATION_ERROR, CONFLICT, INTERNAL_ERROR, RATE_LIMITED, NOT_FOUND.

48. **REQUIRED HEADERS.** `Authorization: Bearer <token>` on all non-auth endpoints. `X-Workspace-Id: <uuid>` on all workspace-scoped endpoints. `Content-Type: application/json` always.

49. **IDEMPOTENCY KEY SUPPORT.** Event creation endpoints accept optional `X-Idempotency-Key` header for safe retries.

50. **RATE LIMITING BY SCOPE.** Standard API: 100 req/min. Auth endpoints: 10 req/min. MCP: 5 concurrent connections + 100 req/min. Search: 30 req/min. Destructive ops: 5 req/min.

51. **WEBSOCKET CONTRACT.** Client sends `SUBSCRIBE { workspaceId, token }` on connect. Server broadcasts `EVENT_CREATED`, `EVENT_UPDATED`, `EVENT_DELETED`, `USER_ONLINE/OFFLINE`, `MEMBER_ADDED/REMOVED/UPDATED`, `AUTH_COMPLETE`.

52. **WEBSOCKET HEARTBEAT.** Server pings every 30s. Client must pong within 10s or connection is dropped. Exponential backoff reconnect: 1s, 2s, 4s, 8s, max 30s.

53. **WEBSOCKET SINGLE SOURCE.** Only `apps/realtime/` handles WebSocket connections. Next.js API routes do NOT handle WebSockets. One realtime server = one source of truth.

54. **CURSOR-BASED PAGINATION.** List endpoints use cursor-based pagination via `Link` headers when results exceed limit. Default limit: 50, max: 200.

55. **QR AUTH FLOW.** Web generates challenge → stores in Redis (60s TTL) → displays QR → mobile scans → POST `/auth/qr/approve` with session token → server broadcasts `AUTH_COMPLETE` via WebSocket → browser receives token → redirects to dashboard.

56. **QR SECURITY.** Challenge UUID is unguessable. WebSocket channel is UUID-based (no auth needed on WS). Redis TTL is strict 60s. Challenge is single-use (status: PENDING → APPROVED).

57. **PUBLIC SHARE HASHES.** Generated via `crypto.randomBytes(32).toString('hex')`. 64 hex characters. Stored hashed in DB. Supports optional password + TTL expiration.

58. **MCP ENDPOINTS.** `GET /mcp/sse` — establishes SSE stream (auth via Bearer token before stream open). `POST /mcp/message` — receives JSON-RPC (rate-limited before processing).

59. **HEALTH CHECK.** `GET /api/health` returns `{ status, postgres, redis, uptime, version }`. No auth required. Used by Docker health checks.

60. **API VERSIONING.** Current version: v1. URL prefix: `/api/v1/`. Breaking changes increment version. Non-breaking additions stay in v1.

### ─── UI/UX & ANIMATION RULES (61–75) ───

61. **DARK MODE FIRST.** Default theme is OLED black (`#000000` background). Design system defined in `06-design-specification.md`. Light mode is a variant, not the primary.

62. **SHADCN/UI AS BASE.** All UI components start from shadcn/ui primitives. Do not build buttons, inputs, dialogs, dropdowns from scratch. Import via `npx shadcn-ui@latest add [component]` (with approval).

63. **NO CSS TRANSITIONS WITH FRAMER MOTION.** shadcn/ui components get `transition-none` class. All animations use Framer Motion spring physics. Never mix CSS transitions with JS animations.

64. **SPRING PHYSICS ONLY.** No linear animations. No `ease-in-out`. Every animation uses Framer Motion `type: "spring"` or Reanimated `withSpring`. Spring configs defined in `packages/shared/constants/animation.ts`.

65. **ANIMATION GLOBALS.** Use pre-defined spring configs: `SPRING_SWIFT` (toggles, buttons), `SPRING_FLUID` (page transitions, modals), `SPRING_GENTLE` (drag-and-drop). Never hardcode spring values in components.

66. **NO SPINNERS.** Loading states use Skeleton components with shimmer effect. Never show a spinning circle.

67. **BEAUTIFUL EMPTY STATES.** No blank white screens. Empty states show subtle illustrations with encouraging text. Defined in `06-design-specification.md` Section 4.

68. **SURFACE DEPTH ARCHITECTURE.** Depth 0: `#000000` (app background). Depth 1: `#09090B` (sidebar). Depth 2: `#121214` (cards, events). Depth 3: `#18181B` (modals). Each level has 1px inner border: `rgba(255,255,255,0.05)`.

69. **TYPOGRAPHY HIERARCHY.** Inter/SF Pro for UI. JetBrains Mono for time blocks, dates, code. Heavy contrast: 32px Semibold headers, 13px Regular zinc-400 body text.

70. **GLASSMORPHISM STANDARD.** Modals: `backdrop-filter: blur(12px)`. Dropdowns: `blur(12px)`. Sticky headers: `blur(12px)`. Command palette: `blur(24px)`.

71. **ACCENT COLOR SPARINGLY.** `#6366F1` (Electric Indigo) used ONLY for CTAs, current time indicator, and active states. Not for backgrounds or decorations.

72. **GRID CANVAS RULES.** The `<GridCanvas>` component handles all calendar grid rendering. Snaps to 15-minute increments. Overlap detection distributes concurrent events into columns. Drag-and-drop uses magnetic snap.

73. **MOBILE: BOTTOM SHEET PATTERN.** Event creation and details use Apple Maps-style bottom sheets. Swipe down to dismiss. Background dims with blur. Haptic feedback on interactions.

74. **MOBILE: NATIVE THREAD ANIMATIONS.** All Reanimated animations run on the UI thread via `useAnimatedScrollHandler` and `useSharedValue`. No JS-thread animations for scroll-based effects.

75. **MOBILE: OFFLINE-FIRST UI.** Every screen must render from local SQLite cache immediately. Network state shown via `<StatusDot>` (grey→orange→green). Sync progress via `<SyncProgressRing>`.

### ─── MCP & AI AGENT RULES (76–85) ───

76. **MCP IS FIRST-CLASS.** The MCP server (`apps/mcp-server/`) is a core service, not an addon. It shares types, DB client, and auth with the web app via the monorepo.

77. **8 MCP TOOLS ONLY.** The MCP server exposes exactly these tools: `list_events`, `create_event`, `update_event`, `delete_event`, `find_common_time`, `get_availability`, `search_events`, `get_upcoming_events`. Do not add tools without updating `04-mcp-server-implementation.md`.

78. **DESTRUCTIVE OPS REQUIRE CONFIRMATION.** `delete_event` requires `confirmDestructive: true` parameter. The server rejects deletions without this flag. Human-in-the-loop enforcement.

79. **MCP RBAC PER TOOL.** Each tool has a minimum role requirement: `search_events` → VIEWER, `create_event` → EDITOR, `delete_event` → EDITOR. Enforced in `apps/mcp-server/rbac.ts`.

80. **MCP SESSION TTL.** SSE sessions expire after 5 minutes of inactivity. Configurable via `MCP_SESSION_TTL` env var.

81. **MCP RATE LIMITING.** 100 requests/min per API key. 10 tool calls per 10 seconds (burst protection). 5 destructive calls per minute.

82. **MCP AUDIT TRAIL.** All MCP operations are logged: `apiKeyId`, `tool`, `params`, `timestamp`, `ip`. Viewable in admin dashboard.

83. **NO MCP BYPASS.** The MCP server cannot bypass PostgreSQL RLS. All queries go through the authenticated user's context. RLS is the hard backstop.

84. **MCP TOOL SCHEMAS IN ZOD.** Every MCP tool input schema uses Zod validation. Descriptions are critical — the LLM relies entirely on them to know when to trigger a tool.

85. **SELF-DOCUMENTING MCP.** `GET /api/mcp/config` returns the exact JSON for Cursor/Claude MCP configuration. Users copy-paste directly.

### ─── MOBILE & OFFLINE RULES (86–95) ───

86. **OFFLINE-FIRST ARCHITECTURE.** The mobile app must function fully offline. Calendar read, event creation, and event editing all work against local SQLite. Network is an enhancement, not a requirement.

87. **SYNC QUEUE PATTERN.** Offline mutations go into a sync queue with status `PENDING_SYNC`. On reconnect: push local changes, pull remote changes, reconcile (last-write-wins with conflict notification).

88. **SQLITE LOCAL CACHE.** Mobile app uses `expo-sqlite` for local storage. Schema mirrors PostgreSQL schema (simplified). Clear migration path between local and server schemas.

89. **NO HARDCODED INSTANCE URL.** Mobile app's first screen is `/connect` where user enters their self-hosted instance URL. URL is persisted in secure storage.

90. **QR SCANNER DEDICATED MODULE.** The `/scanner` route is a dedicated camera interface for web auth only. Uses `expo-camera` + `react-native-reanimated` for targeting reticle.

91. **HAPTIC FEEDBACK MAP.** Drag event: light haptic. Change view: light haptic. Toggle switch: light haptic. Event created: double-pulse. QR approved: double-pulse.

92. **MOBILE SEARCH: LOCAL FIRST.** Search queries local SQLite FTS first (instant results), then falls back to server PostgreSQL FTS. User sees results as they type.

93. **PUSH NOTIFICATIONS VIA FCM.** Firebase Cloud Messaging for meeting reminders and invite notifications. Reminder timing configurable: 10min, 30min, 1hr, 1 day before.

94. **DATABASE SYNC UI.** Mobile settings show: SQLite file size, pending sync count, last sync timestamp. "Force Push" and "Pull Latest" manual buttons for power users.

95. **Expo Managed Workflow.** The mobile app uses Expo managed workflow. No native module ejections unless explicitly documented and approved.

### ─── ANTI-PATTERNS & PROHIBITIONS (96–100) ───

96. **NO THIRD-PARTY OAUTH.** No Google, Apple, GitHub, or any third-party OAuth providers. Pure self-hosted identity via Better Auth with email/password + QR bridge. This is an architectural decision, not a missing feature.

97. **NO MANAGED SERVICES.** No Supabase, no Neon, no Vercel Postgres, no Upstash Redis. Everything runs self-hosted on the VPS via Docker. PostgreSQL and Redis are Docker containers managed by Dokploy.

98. **NO EXTERNAL SEARCH ENGINES.** No ElasticSearch, MeiliSearch, Algolia, or Typesense. PostgreSQL native Full-Text Search (GIN-indexed tsvector) handles all search needs. Zero external dependencies.

99. **NO FILE UPLOADS.** No image uploads, no PDF attachments, no binary files on events. This keeps the database lightweight, backups small, and sync payloads fast. Markdown descriptions provide rich text without bloat.

100. **NO MARKETING PAGES.** The app assumes deployment behind a reverse proxy (Nginx/Caddy/Traefik). No landing page, no pricing page, no blog. Root route renders login/QR or redirects to calendar. Go straight to business.

---

## Documentation Index

Every agent must reference these docs before implementing features in their domain:

| Doc | File | Covers |
|-----|------|--------|
| 1 | `docs/01-database-schema.md` | PostgreSQL schema, Drizzle ORM definitions, ERD, indexing strategy, offline sync model, table inventory |
| 2 | `docs/02-component-library-global-constants.md` | All global constants, animation configs, CSS theme variables, shadcn/ui imports, bespoke component specs (Web + Mobile) |
| 3 | `docs/03-api-websocket-contract.md` | Complete REST API contract (auth, workspaces, events, search, MCP, share), WebSocket contract, error schema, rate limiting |
| 4 | `docs/04-mcp-server-implementation.md` | MCP server tech spec, SSE transport, 8 tool definitions, RBAC, security, client integration docs (Claude/Cursor), human-in-the-loop |
| 5 | `docs/05-route-map-web-mobile.md` | Every route in the web app (7 groups) and mobile app (5 groups), layout requirements, auth gates per route |
| 6 | `docs/06-design-specification.md` | Design Language System, typography, color palette, motion physics, glassmorphism, web UI layout, mobile UX patterns |
| 7 | `docs/07-component-animation-guide.md` | Exact animation implementations: Framer Motion for web, Reanimated for mobile. Every component's animation spec with code. |
| 8 | `docs/08-user-flows-requirements.md` | 10 user flow diagrams, 20 functional requirements (FR-01–FR-20), 20 feature requirements (FE-01–FE-20), traceability matrix |
| 9 | `docs/09-master-technical-specification.md` | Complete tech stack, monorepo structure, QR bridge spec, search engine spec, RBAC model, Docker compose, env vars, build roadmap |

---

## Quick Reference: When to Read Which Doc

| Task | Required Doc(s) |
|------|-----------------|
| Write a database migration | Doc 01 |
| Create a UI component | Doc 02 + Doc 06 + Doc 07 |
| Add an API endpoint | Doc 03 |
| Implement MCP tool | Doc 04 |
| Add a new route/page | Doc 05 |
| Change design/styling | Doc 06 |
| Add animation | Doc 07 |
| Implement a user flow | Doc 08 |
| Understand architecture | Doc 09 |
| Deploy/infrastructure | Doc 09 Section 8 |
| New agent joining project | All docs + this AGENTS.md |

---

## Environment Variables Template

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
TRUST_PROXY=false
NODE_ENV=production
```

---

## Agent Onboarding Checklist

When a new AI agent (Cursor, Claude, OpenCode) joins this project, it must:

1. [ ] Read `AGENTS.md` completely (this file)
2. [ ] Read `docs/09-master-technical-specification.md` for project overview
3. [ ] Read `docs/01-database-schema.md` before any database work
4. [ ] Read `docs/05-route-map-web-mobile.md` before any routing work
5. [ ] Read `docs/02-component-library-global-constants.md` before any UI work
6. [ ] Read `docs/06-design-specification.md` before any design work
7. [ ] Read `docs/07-component-animation-guide.md` before any animation work
8. [ ] Run `bun run dev` to verify the dev environment works
9. [ ] Run `bun run typecheck` to verify TypeScript compiles
10. [ ] Review the 100 rules above before writing any code

---

**Last updated:** 2026-05-10
**Version:** 1.0.0
**Maintained by:** NovaCal core team
