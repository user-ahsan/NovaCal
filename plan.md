# 🏗️ NovaCal — Multi-Agent Orchestration Build Plan

> **Scope:** Full production-grade calendar platform from spec docs
> **Agents:** 25 specialized agents across 5 sprints
> **Quality:** Final-grade. No stubs. No v1. Everything working.

---

## 📋 ARCHITECTURE

```
MASTER ORCHESTRATOR (supervisor)
├── Context bundles per agent (precise doc references)
├── Parallel swarm launches (4-10 agents per sprint)
├── Quality gates between sprints (typecheck + build)
├── Failure isolation (retry/fix single agent, not whole sprint)
└── Final synthesis + integration
```

---

## 🧠 AGENT ROSTER (25)

| ID | Role | Domain | Output Files |
|----|------|--------|-------------|
| A01 | Infra Architect | Root config | `package.json`, `tsconfig.json`, `tsconfig.base.json` |
| A02 | Shared Package Engineer | Constants & Types | `packages/shared/` (constants, types, Zod schemas) |
| A03 | Database Architect | Drizzle ORM | `packages/db/schema/*.ts`, `client.ts`, migrations |
| A04 | Auth Engineer | Better Auth | `packages/auth/` (server, client, config) |
| A05 | UI Component Engineer | shadcn/ui | `packages/ui/` (17 components + theming) |
| A06 | Bespoke Web Comp Engineer | Complex web components | `apps/web/components/GridCanvas`, `EventBlock`, `TimeLineIndicator`, `MagneticButton`, `FloatingLabelInput`, `GhostSlot`, `CodeBlockCopy` |
| A07 | QR/AI Web Comp Engineer | Auth + AI web components | `apps/web/components/DynamicQRCode`, `MarkdownEditor`, `MiniMonthNavigator`, `RRuleBuilder`, `AICommandBar`, `SyncProgressRing` |
| A08 | Auth API Engineer | Auth REST endpoints | `apps/web/app/api/auth/*/route.ts` (7 endpoints) |
| A09 | Events API Engineer | Events REST endpoints | `apps/web/app/api/events/*/route.ts`, `search/route.ts` |
| A10 | Workspace API Engineer | Workspace REST endpoints | `apps/web/app/api/workspaces/*/route.ts` (5 endpoints) |
| A11 | System+Share API Engineer | System + Share REST | `apps/web/app/api/system/*/route.ts`, `share/*/route.ts` |
| A12 | WebSocket Engineer | Realtime server | `apps/realtime/` (index, handlers, rooms) |
| A13 | MCP Server Engineer | MCP SDK server | `apps/mcp-server/` (index, auth, rbac, 8 tools) |
| A14 | Auth Page Engineer | Web auth UI | `apps/web/app/(auth)/*` (setup, login, qr, callback) |
| A15 | Dashboard Engineer | Core calendar UI | `apps/web/app/(dashboard)/*`, `layout.tsx`, `globals.css`, `middleware.ts` |
| A16 | Settings/Admin/Workspace Engineer | Settings + Admin UI | `apps/web/app/(settings)/*`, `(admin)/*`, `(workspace)/*`, `(developer)/*` |
| A17 | Public Pages Engineer | Public share UI | `apps/web/app/(public)/*`, `not-found.tsx`, `error.tsx` |
| A18 | Mobile Auth Engineer | Mobile auth screens | `apps/mobile/app/(auth)/*`, `_layout.tsx`, `+not-found.tsx` |
| A19 | Mobile Tab Engineer | Main tab screens | `apps/mobile/app/(tabs)/*` (calendar, agenda, notifications, settings) |
| A20 | Mobile Modal Engineer | Modal screens | `apps/mobile/app/(modals)/*` (event/new, event/[id], search) |
| A21 | Mobile Settings Engineer | Mobile settings | `apps/mobile/app/(settings)/*` (6 screens) |
| A22 | Mobile Comp Engineer | Mobile components | `apps/mobile/components/` (9 components) |
| A23 | Mobile Services Engineer | Mobile services | `apps/mobile/services/` (api, offline-sync, fcm) |
| A24 | DevOps Engineer | Docker + deployment | `docker/` (compose, Dockerfiles), `.env.example` |
| A25 | QA & Integration Engineer | Tests + validation | Integration tests, security audit |

---

## 🏃 SPRINT 0 — FOUNDATION

**Parallel batch: 4 agents start simultaneously**
**Output: Root config + Shared package + DB schemas + Docker**

```
┌──────────────────────────────────────────────────────────────┐
│ A01 ─── package.json, tsconfig.json                           │
│ A02 ─── packages/shared/ (constants, types, Zod schemas)      │
│ A03 ─── packages/db/ (schema/*.ts, client.ts, migrations)     │
│ A24 ─── docker/ (compose.yml, Dockerfiles, .env.example)      │
└──────────────────────────────────────────────────────────────┘
```

### Agent A01 — Infra Architect

**Pre-launch requirements:**
- [ ] Read AGENTS.md (merged dir structure, tech stack versions, workspace packages)
- [ ] Read Doc 09 Section 1 (Bun workspaces config, project structure)
- [ ] Know: Bun native, all 6 workspace packages (`shared`, `db`, `auth`, `ui`, `web`, `mobile`, `realtime`, `mcp-server`)

**Deliverables:**
- [ ] `package.json` — Bun workspace root with all 6 packages + 4 apps listed in `workspaces`
- [ ] `tsconfig.json` — Base TS config with strict mode, path aliases (`@novacal/*`)
- [ ] `tsconfig.base.json` — Extended by all packages
- [ ] `.gitignore` — Node, Bun, Next.js, Expo, Docker patterns

**Validation:**
- [ ] `bun install` resolves all workspace packages
- [ ] No duplicate package names across workspaces

---

### Agent A02 — Shared Package Engineer

**Pre-launch requirements:**
- [ ] Read Doc 02 Section 1 (ALL constants: animation, system, theme, roles, WS events)
- [ ] Read Doc 01 Section 4 (types needed by DB: WorkspaceRole enum, Event types)
- [ ] Get: A01 output (root tsconfig) for import path resolution

**Deliverables:**
- [ ] `packages/shared/constants/animation.ts` — SPRING_SWIFT, SPRING_FLUID, SPRING_GENTLE, TRANSITION_STAGGER, TRANSITION_ENTER, TRANSITION_EXIT (exact spring configs from Doc 02)
- [ ] `packages/shared/constants/animation.mobile.ts` — MOBILE_SPRING, MOBILE_SNAP, MOBILE_FADE_DURATION (exact Reanimated configs)
- [ ] `packages/shared/constants/system.ts` — WORKSPACE_ROLES, ROLE_HIERARCHY, DEFAULT_TIMEZONE, SLOT_INCREMENT_MINUTES, MIN_EVENT_DURATION_MINUTES, MAX_EVENT_DURATION_HOURS, DEFAULT_WORKING_HOURS, DEFAULT_START_OF_WEEK, QR_TTL_SECONDS, QR_REFRESH_INTERVAL_MS, RATE_LIMIT_MAX_REQUESTS, SESSION_CACHE_TTL_SECONDS, CALENDAR_VIEWS, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, AGENDA_PAGE_SIZE, WS_EVENTS, SHARE_HASH_BYTES, SHARE_DEFAULT_EXPIRY_DAYS, SHARE_MAX_EXPIRY_DAYS
- [ ] `packages/shared/types/index.ts` — WorkspaceRole type, CalendarView type, Event interface, User interface, ApiError interface, WS_EVENT types, Pagination types
- [ ] `packages/shared/index.ts` — Barrel re-export
- [ ] `packages/shared/tsconfig.json`
- [ ] `packages/shared/package.json`

**Validation:**
- [ ] Every constant exactly matches Doc 02 specs
- [ ] ROLE_HIERARCHY: OWNER=100, ADMIN=80, EDITOR=60, VIEWER=40, FREE_BUSY=20
- [ ] WS_EVENTS has all 7 event types
- [ ] TypeScript strict mode compiles

---

### Agent A03 — Database Architect

**Pre-launch requirements:**
- [ ] Read Doc 01 (100% — all 11 tables, columns, indexes, FTS, sync, constraints)
- [ ] Read AGENTS.md Rule 31-45 (database rules: UTC-only, soft deletes, RLS-ready FKs, composite PKs, GIN index, sync index)
- [ ] Get: A02 output (shared types for role enum)

**Deliverables:**
- [ ] `packages/db/schema/auth.ts` — users (8 cols), sessions (6 cols), qr_challenges (5 cols) — exact column names, types, defaults, FKs from Doc 01
- [ ] `packages/db/schema/workspace.ts` — roleEnum (5 values: OWNER, ADMIN, EDITOR, VIEWER, FREE_BUSY), workspaces (6 cols), workspace_members (4 cols + composite PK)
- [ ] `packages/db/schema/calendar.ts` — calendars (5 cols), events (16 cols INCLUDING search_vector), event_attendees (4 cols + composite PK)
- [ ] `packages/db/schema/developer.ts` — api_keys (6 cols), webhooks (6 cols)
- [ ] `packages/db/schema/sharing.ts` — public_links (7 cols)
- [ ] `packages/db/schema/index.ts` — Re-exports all schemas
- [ ] `packages/db/client.ts` — Drizzle client instance with PostgreSQL connection
- [ ] `packages/db/drizzle.config.ts` — Drizzle Kit config
- [ ] `packages/db/package.json`
- [ ] `packages/db/tsconfig.json`
- [ ] SQL migration files:
  - [ ] `packages/db/migrations/0000_initial.sql` — CREATE TABLE all 11 tables
  - [ ] `packages/db/migrations/0001_indexes.sql` — `idx_events_time_range`, `idx_events_search` (GIN), `idx_events_sync`, `search_vector` generated column ALTER TABLE
  - [ ] `packages/db/migrations/0002_rls.sql` — PostgreSQL RLS policies per table

**Indexes (EXACT specs from Doc 01):**
- [ ] `idx_events_time_range` — `CREATE INDEX ON events (calendar_id, start_time, end_time) WHERE deleted_at IS NULL`
- [ ] `search_vector` — `GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(location, '')), 'B') || setweight(to_tsvector('english', coalesce(description, '')), 'C')) STORED`
- [ ] `idx_events_search` — `CREATE INDEX ON events USING GIN(search_vector)`
- [ ] `idx_events_sync` — `CREATE INDEX ON events (updated_at) WHERE deleted_at IS NOT NULL OR updated_at > NOW() - INTERVAL '30 days'`

**Validation:**
- [ ] All 11 tables present with exact column specs from ERD
- [ ] Composite PKs on workspace_members AND event_attendees
- [ ] FK constraints with correct onDelete (cascade, restrict, set null)
- [ ] `ownerId` on workspaces uses `onDelete: "restrict"`
- [ ] Sessions use text PK (Better Auth convention)
- [ ] `passwordHash` on users is nullable
- [ ] search_vector is a generated column (not application-computed)
- [ ] `bun run db:generate` produces valid SQL

---

### Agent A24 — DevOps Engineer

**Pre-launch requirements:**
- [ ] Read Doc 09 Section 8 (Docker compose spec, 4 containers, networking, env vars, Dokploy ingress, Cloudflare tunnel, health checks)
- [ ] Read AGENTS.md Rule 97 (no managed services — PostgreSQL and Redis are Docker containers)
- [ ] Read AGENTS.md (container architecture: 3000: web, 3001: realtime)

**Deliverables:**
- [ ] `docker/compose.yml` — 4 services: novacal-web (:3000), novacal-realtime (:3001), novacal-db (postgres:16-alpine), novacal-redis (redis:7-alpine). Health checks on DB. Networks: novacal-net. Volumes: pgdata, redisdata.
- [ ] `docker/Dockerfile` — Multi-stage build: base (Bun), deps, build, production runner. Stage 1: `bun install --frozen-lockfile`. Stage 2: `bun run build`. Stage 3: `bun run start` on port 3000.
- [ ] `docker/realtime.Dockerfile` — Separate build for WebSocket server. Stage 1: deps. Stage 2: `bun run start` on port 3001.
- [ ] `.env.example` — ALL env vars from Doc 09: DATABASE_URL, REDIS_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, MCP_PORT, WS_PORT, WS_URL, TRUST_PROXY, NODE_ENV
- [ ] `.dockerignore` — node_modules, .git, .env, apps/mobile (not needed in Docker)

**Validation:**
- [ ] `docker compose config` produces valid output
- [ ] Port mapping: 3000 (web), 3001 (realtime). DB:5432 and Redis:6379 internal only.
- [ ] Dokploy ingress: `calendar.yourdomain.com → web:3000`, `ws.yourdomain.com → realtime:3001`
- [ ] `TRUST_PROXY` toggle for Cloudflare Tunnel compat
- [ ] All 4 services on same `novacal-net` network

---

## 🏃 SPRINT 1 — BACKEND + COMPONENTS

**Parallel batch: 10 agents start simultaneously**
**Output: Auth, API routes, WebSocket, MCP, UI components, mobile components**

```
┌──────────────────────────────────────────────────────────────┐
│ A04 ─── packages/auth/ (Better Auth config)                  │
│ A05 ─── packages/ui/ (17 shadcn components)                  │
│ A06 ─── apps/web/components/ (GridCanvas, EventBlock, etc)   │
│ A07 ─── apps/web/components/ (DynamicQRCode, MarkdownEditor) │
│ A08 ─── apps/web/api/auth/* (7 route files)                  │
│ A09 ─── apps/web/api/events/*, search/*                      │
│ A10 ─── apps/web/api/workspaces/* (5 route files)            │
│ A11 ─── apps/web/api/system/*, share/*                       │
│ A12 ─── apps/realtime/ (WebSocket server)                    │
│ A22 ─── apps/mobile/components/ (9 components)               │
└──────────────────────────────────────────────────────────────┘
```

---

### Agent A04 — Auth Engineer

**Pre-launch requirements:**
- [ ] Read Doc 09 Section 2A (identity management: Better Auth, Redis sessions, no OAuth)
- [ ] Read Doc 01 (auth tables: users, sessions, qr_challenges — exact column specs)
- [ ] Read AGENTS.md Rule 42 (sessions use text PK per Better Auth standard)
- [ ] Read AGENTS.md Rule 56 (QR security: UUID unguessable, 60s TTL, single-use)
- [ ] Get: A03 output (DB client import path) — `@novacal/db`

**Deliverables:**
- [ ] `packages/auth/server.ts` — Better Auth server instance, email/password, Redis-backed sessions, QR challenge verification (60s TTL, PENDING→APPROVED status), session creation on QR approve, bcrypt password hashing, no third-party OAuth
- [ ] `packages/auth/client.ts` — Better Auth client for frontend (login, register, logout, session check)
- [ ] `packages/auth/config.ts` — Auth configuration constants (session TTL, password min length, QR TTL)
- [ ] `packages/auth/package.json` — Dependencies: better-auth, @novacal/db, @novacal/shared
- [ ] `packages/auth/tsconfig.json`

**Validation:**
- [ ] `bun run typecheck` on packages/auth passes
- [ ] Session creation and validation works
- [ ] QR challenge has strict 60s TTL
- [ ] Passwords bcrypt-hashed before storage
- [ ] No OAuth providers configured

---

### Agent A05 — UI Component Engineer

**Pre-launch requirements:**
- [ ] Read Doc 02 Section 2 (ALL 17 shadcn components, exact usage table, styling override specs)
- [ ] Read Doc 06 (CSS variables: --background #000000, --surface #09090B, --surface-elevated #121214, --primary-accent #6366F1, glassmorphism blur, surface depth architecture)
- [ ] Read AGENTS.md Rule 62-64 (shadcn as base, no CSS transitions with Framer Motion, spring physics only)
- [ ] Get: A02 output (`@novacal/shared` for constants)

**Deliverables (17 components):**
- [ ] `packages/ui/button.tsx` — shadcn Button + Framer Motion override (`<motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}`, `transition-none` CSS class)
- [ ] `packages/ui/input.tsx` — Borderless variant for floating label
- [ ] `packages/ui/textarea.tsx` — Base for Markdown editor
- [ ] `packages/ui/dialog.tsx` — Event creation/invite/settings modals, `backdrop-filter: blur(12px)` overrides
- [ ] `packages/ui/popover.tsx` — Date pickers, contextual menus
- [ ] `packages/ui/select.tsx` — Timezone, role, view selectors
- [ ] `packages/ui/dropdown-menu.tsx` — User menu, event quick-actions
- [ ] `packages/ui/avatar.tsx` — Navbar, member directory
- [ ] `packages/ui/badge.tsx` — Role labels (`<Badge variant="outline">Admin</Badge>`)
- [ ] `packages/ui/switch.tsx` — All Day, Dark Mode, Public Link toggles + Framer Motion wrap
- [ ] `packages/ui/table.tsx` — Members, API keys data tables
- [ ] `packages/ui/scroll-area.tsx` — Agenda view, sidebar
- [ ] `packages/ui/skeleton.tsx` — Loading states (NO spinners), shimmer pulse
- [ ] `packages/ui/toast.tsx` — Global notifications (Sonner wrapper) — "Event Created", "QR Scanned"
- [ ] `packages/ui/tooltip.tsx` — Hover states for icons
- [ ] `packages/ui/command.tsx` — Cmd+K search backbone (cmdk)
- [ ] `packages/ui/index.ts` — Barrel export
- [ ] `packages/ui/package.json`
- [ ] `packages/ui/tsconfig.json`

**Every component MUST include:**
- [ ] `transition-none` class on root element
- [ ] CSS variables from Doc 06 (`--background`, `--surface`, `--radius-base`, etc.)
- [ ] Dark mode class support
- [ ] Correct shadcn/ui import pattern

**Validation:**
- [ ] All 17 components compile without errors
- [ ] Components use CSS theme variables (no hardcoded colors beyond what's in theme)
- [ ] No CSS transitions (only Framer Motion)
- [ ] Button has `transition-none` class

---

### Agent A06 — Bespoke Web Component Engineer

**Pre-launch requirements:**
- [ ] Read Doc 02 Section 3A (GridCanvas architecture notes: pixel calc, overlap detection, 15-min snap. EventBlock: layoutId, drag props, left border styling. TimeLineIndicator: 2s opacity pulse. MagneticButton: pointer-tracking glow. FloatingLabelInput: float on focus. GhostSlot: faded dashed border. CodeBlockCopy: copy-to-clipboard, animated icon swap)
- [ ] Read Doc 06 (grid layout: edge-to-edge canvas, event block styling: 2px left border + 15% accent BG, time indicator: 2px neon line + pulsing dot, ghost block: dashed border + low opacity, dragging: scale 1.02 + heavy shadow)
- [ ] Read Doc 07 (Framer Motion specs: EventBlock: drag="x,y", dragElastic=0.1, whileDrag scale 1.02, TimeLineIndicator: 2s opacity pulse, GhostSlot: opacity 0→0.4, MagneticButton: usePointerPosition glow, view switching: slide left/right spring)
- [ ] Get: A05 output (`@novacal/ui` for base components)
- [ ] Get: A02 output (`@novacal/shared` for SPRING_* configs)

**Deliverables (7 components):**
- [ ] `apps/web/components/GridCanvas.tsx` — **Extreme complexity.** Edge-to-edge time grid. Inputs: view (day/3-day/week/month/year), date, events. Computes: total height = hoursVisible * hourHeightPx, maps each event to {top,height,left,width} based on startTime and duration. Overlap detection groups concurrent events, distributes column positions. Renders: fixed grid lines (30/60min), Absolutely positioned EventBlocks, TimeLineIndicator overlay, GhostSlot on hover. View switching: slide left/right with spring.
- [ ] `apps/web/components/EventBlock.tsx` — Colored event rectangle. `motion.div` with `layoutId` for shared element transitions. Drag props: `drag="x,y"`, `dragElastic={0.1}`, `whileDrag={{ scale: 1.02, boxShadow }}`. 15-min snap on `onDragEnd`. Styling: 2px left border in accent color, 15% opacity accent background. Hover reveals quick-action icons (Edit, Delete).
- [ ] `apps/web/components/TimeLineIndicator.tsx` — 2px neon line at current time position. Pulsing dot at left edge. `motion.div` with `animate={{ opacity: [0.5, 1, 0.5] }}`, `transition={{ duration: 2, repeat: Infinity }}`. Uses `useEffect` interval for Y-position recalculation every 60s.
- [ ] `apps/web/components/MagneticButton.tsx` — Button with radial gradient glow tracking mouse position. Uses Framer Motion `usePointerPosition` pattern. Glow center = pointer relative to button bounds. `scale: 1.02` on hover with spring.
- [ ] `apps/web/components/FloatingLabelInput.tsx` — Borderless input. Label floats above on focus. `motion.label` with spring transition. Variants: focused, unfocused, filled states.
- [ ] `apps/web/components/GhostSlot.tsx` — Faded dashed-border block on grid hover. `initial={{ opacity: 0 }}`, `animate={{ opacity: 0.4 }}`. Shows exact position where click creates event. 15-min increment snap.
- [ ] `apps/web/components/CodeBlockCopy.tsx` — Monospace code block with copy button. On click: `animate={{ scale: [1, 1.2, 1] }}` 200ms, icon swaps to checkmark.

**Validation:**
- [ ] GridCanvas calculates pixel positions correctly for all 5 view types
- [ ] Overlap detection distributes concurrent events without overlap
- [ ] EventBlock drags with 15-min snap
- [ ] TimeLineIndicator updates position every 60s
- [ ] MagneticButton glow tracks mouse position
- [ ] GhostSlot renders on empty grid hover
- [ ] All components use spring physics, NOT CSS transitions

---

### Agent A07 — QR/AI Web Component Engineer

**Pre-launch requirements:**
- [ ] Read Doc 02 Section 3A (DynamicQRCode: SVG QR, WebSocket subscription, 60s refresh. MarkdownEditor: borderless textarea, live markdown parsing, AI sparkle button. MiniMonthNavigator: 30-day sidebar calendar, rapid date jumping. RRuleBuilder: high complexity form, "Every 3rd Tuesday" config. AICommandBar: MCP-connected input, skeleton loader. SyncProgressRing: SVG circular stroke)
- [ ] Read Doc 06 (QR flow: sweep line animation, scan-success green glow + circle reveal clip-path, empty states, skeleton shimmer)
- [ ] Read Doc 07 (QR: sweep line `animate={{ y: ["0%", "100%", "0%"] }}` linear 3s loop, on scan scale 0.8 + green + circle reveal spring 280/25. Command palette: AnimatePresence, scale 0.95→1, y -10→0, spring 350/25. Results: layout prop for smooth filtering. Copy pop: [1, 1.2, 1]. Skeleton: shimmer left-to-right)
- [ ] Get: A05 output (`@novacal/ui` for dialog, button, skeleton)
- [ ] Get: A02 output (`@novacal/shared` for spring configs, QR_TTL_SECONDS)

**Deliverables (6 components):**
- [ ] `apps/web/components/DynamicQRCode.tsx` — SVG QR code rendering. WebSocket subscription to auth channel. Auto-refresh every 60s (matches QR_TTL). On scan: shrink to 0.8, turn neon green (#22C55E), intensify glow, circular clip-path reveal to dashboard. Sweep line overlay: `animate={{ y: ["0%", "100%", "0%"] }}` linear 3s loop. Spring scale config: mass=1, stiffness=280, damping=25.
- [ ] `apps/web/components/MarkdownEditor.tsx` — Borderless textarea for event descriptions. Live markdown parsing. AI sparkle button in bottom-right corner (subtle glowing gradient). Styled per Doc 06 design spec.
- [ ] `apps/web/components/MiniMonthNavigator.tsx` — 30-day calendar in sidebar. Month/year selection. Click date → navigates calendar. Current date highlighted. Uses local state, no API calls.
- [ ] `apps/web/components/RRuleBuilder.tsx` — **High complexity.** Custom form component for recurrence rules. Handles: frequency (daily/weekly/monthly/yearly), interval, by-day (MON,TUE,...), by-month-day, end conditions (never, after N occurrences, until date). Outputs RRule string per RFC 5545.
- [ ] `apps/web/components/AICommandBar.tsx` — Sticky input field at bottom. Sends natural language to MCP server. Displays skeleton loader while processing. Uses `<Command>` from shadcn/ui. Keyboard shortcut trigger (Cmd+K).
- [ ] `apps/web/components/SyncProgressRing.tsx` — SVG circular stroke. `strokeDashoffset` animates smoothly from circumference→0. States: syncing (accent color, animating), idle (static green 100%), offline (orange pulse withRepeat 0.5↔1.0).

**Validation:**
- [ ] DynamicQRCode refreshes every 60s exactly
- [ ] QR scan animation: shrink→green→circle reveal
- [ ] MarkdownEditor parses markdown in real-time
- [ ] RRuleBuilder produces valid RFC 5545 strings
- [ ] AICommandBar sends correct JSON-RPC to MCP endpoint
- [ ] SyncProgressRing animates strokeDashoffset correctly

---

### Agent A08 — Auth API Engineer

**Pre-launch requirements:**
- [ ] Read Doc 03 Section 1 (ALL 7 auth endpoints: register, login, qr/init, qr/approve, logout, sessions, sessions/:id — exact request/response JSON schemas, error codes, rate limits 10 req/min)
- [ ] Read Doc 03 Global Config (Authorization header, standard error format, rate limiting, X-Idempotency-Key)
- [ ] Read Doc 01 (auth tables: users, sessions, qr_challenges)
- [ ] Read AGENTS.md Rule 42-43, 55-56 (auth conventions, QR security)
- [ ] Get: A03 output (`@novacal/db` for Drizzle queries)
- [ ] Get: A04 output (`@novacal/auth` for auth validation)

**Deliverables (8 route files):**
- [ ] `apps/web/app/api/auth/register/route.ts` — POST handler. Fields: email, password (min 8), name. Creates user + session. Response 201: `{ user: { id, email, name }, sessionToken }`. Rate limited 10 req/min.
- [ ] `apps/web/app/api/auth/login/route.ts` — POST handler. Fields: email, password. Validates credentials. Response 200: `{ user: { id, email, name, role }, sessionToken, activeWorkspaceId }`.
- [ ] `apps/web/app/api/auth/qr/init/route.ts` — POST handler. Generates challenge UUID, stores in Redis with 60s TTL and status PENDING. Response 201: `{ challengeId, expiresAt, wsChannel }`. Rate limited 10 req/min.
- [ ] `apps/web/app/api/auth/qr/approve/route.ts` — POST handler. Header: Authorization: Bearer <mobile_session>. Body: challengeId. Validates mobile session. Looks up Redis challenge. If not found → 404. If already APPROVED → 409 CONFLICT. Updates to APPROVED. Publishes AUTH_COMPLETE to WS channel. Extends TTL to 10s. Response 200: `{ status: "APPROVED" }`.
- [ ] `apps/web/app/api/auth/logout/route.ts` — POST handler. Invalidates current session. Response 200: `{ status: "logged_out" }`.
- [ ] `apps/web/app/api/auth/sessions/route.ts` — GET handler. Lists all active sessions. Response 200: `[{ id, device, ip, lastActive, createdAt, isCurrent }]`. DELETE handler: "Log out of all devices" — revokes all sessions. Response 200: `{ status: "all_revoked", count }`.
- [ ] `apps/web/app/api/auth/sessions/[id]/route.ts` — DELETE handler. Revoke specific session. Response 200: `{ status: "revoked" }`.
- [ ] `apps/web/app/api/auth/callback/route.ts` — POST handler. Better Auth session callback (invisible redirect handler).

**Standard error format for ALL endpoints:**
- [ ] `{ error: { code: "UNAUTHORIZED"|"VALIDATION_ERROR"|"CONFLICT"|"INTERNAL_ERROR"|"RATE_LIMITED"|"NOT_FOUND", message: "human readable", details: {} } }`

**Every route MUST include:**
- [ ] Rate limiting (10 req/min for auth endpoints, 100 req/min for standard)
- [ ] Standard error format
- [ ] Zod validation on all inputs
- [ ] TypeScript full types (no `any`)

**Validation:**
- [ ] `POST /auth/register` creates user + returns session
- [ ] `POST /auth/login` authenticates valid credentials, rejects invalid
- [ ] `POST /auth/qr/init` creates Redis challenge with 60s TTL
- [ ] `POST /auth/qr/approve` works only once per challenge (409 on second use)
- [ ] `POST /auth/logout` invalidates session
- [ ] `GET /auth/sessions` returns device ledger
- [ ] All error responses follow standard format
- [ ] Rate limiting returns 429 when exceeded

---

### Agent A09 — Events API Engineer

**Pre-launch requirements:**
- [ ] Read Doc 03 Section 3 (ALL event endpoints: GET /events with cursor pagination, POST /events with conflict detection, GET/PATCH/DELETE events/:id, search)
- [ ] Read Doc 01 (events table: startTime/endTime timestamptz, search_vector, deletedAt, rrule, baseEventId, indexes)
- [ ] Read AGENTS.md Rule 31 (UTC-only storage), Rule 32 (soft deletes), Rule 35-37 (GIN/Sync indexes), Rule 49 (idempotency key)
- [ ] Get: A03 output (`@novacal/db` for Drizzle event queries + schema)
- [ ] Get: A04 output (`@novacal/auth` for session validation)

**Deliverables (3 route files):**
- [ ] `apps/web/app/api/events/route.ts`:
  - `GET /events` — Query params: start (ISO-8601 required), end (ISO-8601 required), calendarIds (optional), userId (optional). Cursor-based pagination via Link header (default limit 50, max 200). Response: `[{ id, calendarId, title, start, end, rrule, color, description, location, timezone, attendees, createdBy, isAllDay }]`. Uses `idx_events_time_range` index.
  - `POST /events` — Fields: calendarId, title, startTime, endTime, description, location, timezone, attendees, recurrence, isAllDay. RBAC: EDITOR minimum. Headers: X-Idempotency-Key, X-Workspace-Id. Behavior: validate ISO-8601, check conflicts in time range, insert event, broadcast EVENT_CREATED via WebSocket. Response 201: `{ id, title, start, end, conflicts: [...] }`.
- [ ] `apps/web/app/api/events/[id]/route.ts`:
  - `GET /events/:id` — Single event by ID. Response 200: full event object with createdBy, attendees.
  - `PATCH /events/:id` — Fields: title, startTime, endTime, description, location, singleInstance. RBAC: EDITOR minimum. For recurring: if singleInstance=true, creates overridden child with baseEventId. Broadcasts EVENT_UPDATED.
  - `DELETE /events/:id` — Query param: scope (single|this_and_future|all). Uses soft delete (sets deletedAt). Broadcasts EVENT_DELETED.
- [ ] `apps/web/app/api/search/route.ts` — GET /search. Query param: q (required), limit (default 20, max 50). Uses PostgreSQL tsvector/tsquery with GIN index. Prefix matching for typo tolerance. Response 200: `{ results: [{ id, title, snippet, start, end }], latencyMs, total }`.

**Validation:**
- [ ] `GET /events` returns events filtered by time range
- [ ] `POST /events` detects conflicts correctly
- [ ] `PATCH /events` updates and broadcasts EVENT_UPDATED
- [ ] `DELETE /events` does soft delete (sets deletedAt)
- [ ] `GET /search` returns FTS results with rankings
- [ ] All timestamps stored as UTC (timestamptz)
- [ ] RBAC enforced: VIEWER can't create/update/delete
- [ ] Cursor pagination works when limit exceeded

---

### Agent A10 — Workspace API Engineer

**Pre-launch requirements:**
- [ ] Read Doc 03 Section 2 (ALL workspace endpoints: GET/POST/DELETE workspaces, GET/PATCH/DELETE members, POST invites)
- [ ] Read Doc 01 (workspace tables: roleEnum, workspace_members composite PK)
- [ ] Read AGENTS.md Rule 43 (role hierarchy numeric: OWNER 100, ADMIN 80, EDITOR 60, VIEWER 40, FREE_BUSY 20)
- [ ] Get: A03 output (`@novacal/db`)
- [ ] Get: A04 output (`@novacal/auth`)

**Deliverables (5 route files):**
- [ ] `apps/web/app/api/workspaces/route.ts` — GET: list user's workspaces (with role, memberCount). POST: create workspace. Body: name, timezone. Sets creator as OWNER. Response 201.
- [ ] `apps/web/app/api/workspaces/[id]/route.ts` — PATCH: update workspace name/timezone. Permissions: Owner/Admin. DELETE: Owner only. Response 200/200.
- [ ] `apps/web/app/api/workspaces/[id]/members/route.ts` — GET: list members with roles. Response 200: `[{ userId, name, email, role, joinedAt }]`
- [ ] `apps/web/app/api/workspaces/[id]/members/[userId]/route.ts` — PATCH: update member role. Permissions: Owner/Admin. DELETE: remove member. Response 200.
- [ ] `apps/web/app/api/workspaces/[id]/invites/route.ts` — POST: generate one-time invitation link. Body: role, expiresInDays. Response 201: `{ inviteUrl, expiresAt }`.

**RBAC enforcement:**
- [ ] DELETE workspace → Owner only
- [ ] PATCH workspace → Owner/Admin
- [ ] PATCH/DELETE member → Owner/Admin
- [ ] POST invites → Owner/Admin

**Validation:**
- [ ] Workspace CRUD works correctly
- [ ] Member listing includes roles
- [ ] Role changes respect hierarchy (only Owner/Admin)
- [ ] Invite links are one-time use
- [ ] Owner cannot be removed from workspace
- [ ] `onDelete: "restrict"` prevents deleting workspace owner

---

### Agent A11 — System + Share API Engineer

**Pre-launch requirements:**
- [ ] Read Doc 03 Section 7 (Share endpoints: POST calendar link, DELETE revoke, GET list links, POST verify password, GET /p/[hash], GET /e/[hash])
- [ ] Read Doc 03 Section 8 (System endpoints: GET health, GET metrics)
- [ ] Read Doc 01 (share tables: public_links with hash, entityType, entityId, passwordHash, expiresAt)
- [ ] Read AGENTS.md Rule 57 (public share hashes: crypto.randomBytes(32).toString('hex'), 64 hex chars, stored hashed)
- [ ] Get: A03 output (`@novacal/db`)
- [ ] Get: A04 output (`@novacal/auth`)

**Deliverables (6 route files):**
- [ ] `apps/web/app/api/system/health/route.ts` — GET: no auth required. Returns `{ status: "healthy"|"degraded", postgres: "connected"|"disconnected", redis: "connected"|"disconnected", uptime, version }`. Used by Docker health checks. 503 if dependencies down.
- [ ] `apps/web/app/api/system/metrics/route.ts` — GET: Instance Admin only. Returns `{ totalUsers, totalEvents, totalWorkspaces, activeWsConnections, databaseSizeMb, redisMemoryMb, requestsLastMinute }`.
- [ ] `apps/web/app/api/share/calendar/[id]/route.ts` — POST: generate share link. Body: password (optional), expiresAt (optional, max 365 days). Hash: `crypto.randomBytes(32).toString('hex')`. Response 201: `{ shareUrl, hash, expiresAt, hasPassword }`.
- [ ] `apps/web/app/api/share/[hash]/route.ts` — DELETE: revoke share link. Response 200: `{ status: "revoked" }`.
- [ ] `apps/web/app/api/share/calendar/[id]/links/route.ts` — GET: list active links. Response 200: `[{ hash, createdAt, expiresAt, hasPassword, viewCount }]`.
- [ ] `apps/web/app/api/share/verify/[hash]/route.ts` — POST: verify password. Body: password. Response 200: `{ valid: true, tempToken, expiresIn }`. Response 401: `{ error: { code: "UNAUTHORIZED", message: "Invalid password" } }`.

**Validation:**
- [ ] Health endpoint returns PG+Redis connection status
- [ ] Health endpoint does NOT require auth (used by Docker)
- [ ] Share hashes are 64 hex characters (crypto.randomBytes(32).toString('hex'))
- [ ] Password-protected links reject invalid passwords
- [ ] Expired links return 404
- [ ] Metrics endpoint requires Instance Admin role
- [ ] Polymorphic entityType + entityId pattern works for both calendar and event links

---

### Agent A12 — WebSocket Engineer

**Pre-launch requirements:**
- [ ] Read Doc 03 Section 6 (WebSocket contract: SUBSCRIBE handshake, EVENT_MOVE inbound, 7 outbound events, heartbeat 30s/10s, exponential backoff 1s→30s, max 5 concurrent connections/user, Redis Pub/Sub architecture)
- [ ] Read Doc 09 Section 4A (real-time multi-team editing: WebSocket room per workspace, Redis Pub/Sub for horizontal scaling, optimistic UI with background reconciliation)
- [ ] Read AGENTS.md Rule 51-53 (WebSocket contract, heartbeat, single source — only apps/realtime/ handles WS)
- [ ] Get: A03 output (`@novacal/db` for session validation)
- [ ] Get: A04 output (`@novacal/auth` for token validation)

**Deliverables (7 files):**
- [ ] `apps/realtime/package.json` — Dependencies: ws, ioredis, @novacal/db, @novacal/shared
- [ ] `apps/realtime/tsconfig.json`
- [ ] `apps/realtime/index.ts` — Express/HTTP server. Port 3001. Accepts WebSocket upgrade. Creates Redis client (publisher + subscriber per connection pattern). Heartbeat interval: 30s ping. Timeout: 10s for pong. Exponential backoff reconnect instructions sent to clients.
- [ ] `apps/realtime/handlers/connection.ts` — Connection handler. Validates SUBSCRIBE message with workspaceId+token. Authenticates session via DB. Joins Redis Pub/Sub channel for that workspace. Manages connection registry. Enforces 5 concurrent connections per user limit.
- [ ] `apps/realtime/handlers/events.ts` — Inbound EVENT_MOVE handler: validates payload, updates DB via Drizzle, broadcasts EVENT_UPDATED to room. AUTH_COMPLETE handler: receives from Redis Pub/Sub, forwards to browser WS channel.
- [ ] `apps/realtime/handlers/presence.ts` — USER_ONLINE broadcast on connect, USER_OFFLINE on disconnect. Tracks active users per workspace.
- [ ] `apps/realtime/rooms/index.ts` — Room/channel management. Maps workspaceId → WS client connections. Redis Pub/Sub subscription per room. Broadcasts to all clients in room.

**Outbound events (ALL MUST BE IMPLEMENTED):**
- [ ] `EVENT_CREATED` — Full event object broadcast
- [ ] `EVENT_UPDATED` — `{ eventId, actor, changes }`
- [ ] `EVENT_DELETED` — `{ eventId, actor }`
- [ ] `USER_ONLINE` — `{ userId, name }`
- [ ] `USER_OFFLINE` — `{ userId }`
- [ ] `MEMBER_ADDED` — `{ userId, name, role }`
- [ ] `MEMBER_REMOVED` — `{ userId }`
- [ ] `MEMBER_UPDATED` — `{ userId, newRole }`
- [ ] `AUTH_COMPLETE` — `{ sessionToken, userId }`
- [ ] Heartbeat — Server ping every 30s

**Validation:**
- [ ] WebSocket accepts connection at `wss://...:3001`
- [ ] SUBSCRIBE with valid workspaceId+token joins the room
- [ ] Invalid tokens are rejected
- [ ] EVENT_MOVE broadcasts to all room members
- [ ] Heartbeat pings every 30s, drops after 10s no pong
- [ ] Max 5 concurrent connections per user enforced
- [ ] USER_ONLINE/OFFLINE presence tracking works
- [ ] AUTH_COMPLETE delivered to correct WS channel

---

### Agent A13 — MCP Server Engineer

**Pre-launch requirements:**
- [ ] Read Doc 04 (100% — ALL 8 tool schemas, SSE transport, auth, RBAC, rate limiting, session TTL, audit logging, ListResourcesRequestSchema, progressive discovery)
- [ ] Read AGENTS.md Rule 76-85 (MCP rules: 8 tools only, confirmDestructive, RBAC per tool, Zod schemas, TTL, rate limits, audit trail, RLS backstop, self-documenting)
- [ ] Read Doc 03 Section 5 (MCP endpoints: GET /mcp/sse, POST /mcp/message, standard JSON-RPC format)
- [ ] Get: A03 output (`@novacal/db` for Drizzle event queries)
- [ ] Get: A04 output (`@novacal/auth` for token validation + bcrypt)
- [ ] Get: A12 output (port 3001, WebSocket + MCP coexist)

**Deliverables (13 files):**
- [ ] `apps/mcp-server/package.json` — Dependencies: @modelcontextprotocol/sdk, express, zod, @novacal/db, @novacal/shared, @novacal/auth, ioredis
- [ ] `apps/mcp-server/tsconfig.json`
- [ ] `apps/mcp-server/index.ts` — Express server on port 3001. Two endpoints: GET /mcp/sse (auth before stream, creates SSEServerTransport), POST /mcp/message (rate limit before processing, calls transport.handlePostMessage). MCP Server instance with ListToolsRequestSchema, CallToolRequestSchema, ListResourcesRequestSchema handlers. Connects to transport. Session 5min TTL.
- [ ] `apps/mcp-server/auth.ts` — authenticateRequest: Bearer token from header → bcrypt lookup in api_keys table → check revoked → update lastUsedAt → return AuthResult with userId, activeWorkspaceId, role
- [ ] `apps/mcp-server/rbac.ts` — assertMinimumRole: MINIMUM_ROLE_HIERARCHY map {list_events: VIEWER, create_event: EDITOR, delete_event: EDITOR, ...}. Look up user's workspace membership. Compare role level. Throw if insufficient.
- [ ] `apps/mcp-server/tools/list-events.ts` — Handler for list_events. Zod schema: dateFrom, dateTo, workspaceId?, userId?, query?, limit? (max 200, default 50). Drizzle query with time range + optional filters + optional FTS. Returns JSON string array.
- [ ] `apps/mcp-server/tools/create-event.ts` — Handler for create_event. Zod schema: title, startTime, endTime, description?, location?, timezone?, attendees?, workspaceId?, recurrence?. RBAC: EDITOR minimum. Conflict detection before insert. Broadcast EVENT_CREATED. Returns created event + conflicts.
- [ ] `apps/mcp-server/tools/update-event.ts` — Handler for update_event. Zod schema: eventId, title?, startTime?, endTime?, description?, location?, singleInstance?. RBAC: EDITOR. For recurring + singleInstance: creates child override with baseEventId. Broadcasts EVENT_UPDATED.
- [ ] `apps/mcp-server/tools/delete-event.ts` — Handler for delete_event. Zod schema: eventId (required), confirmDestructive (required, must be true), scope? (single|this_and_future|all, default single). Rejects if confirmDestructive !== true. RBAC: EDITOR. Soft delete. Broadcasts EVENT_DELETED.
- [ ] `apps/mcp-server/tools/find-common-time.ts` — Handler for find_common_time. Zod schema: userIds, dateFrom, dateTo, durationMinutes, workingHoursOnly? (default true). Cross-references events for all specified users. Finds earliest available slot. Returns suggested time + calendar info.
- [ ] `apps/mcp-server/tools/get-availability.ts` — Handler for get_availability. Zod schema: userId, dateFrom, dateTo. RBAC: FREE_BUSY minimum. Returns busy time blocks (no event details for FREE_BUSY users — just "Busy" blocks).
- [ ] `apps/mcp-server/tools/search-events.ts` — Handler for search_events. Zod schema: query, workspaceId?, limit? (default 20). Uses PostgreSQL tsvector/tsquery with GIN index. Returns ranked results with snippets.
- [ ] `apps/mcp-server/tools/get-upcoming-events.ts` — Handler for get_upcoming_events. Zod schema: days? (default 1), workspaceId?. Returns summary of events for next N days. Formats in natural language.

**ListToolsRequestSchema — ALL 8 tools with EXACT JSON Schema:**
- [ ] `list_events` — dateFrom, dateTo required + optional filters
- [ ] `create_event` — title, startTime, endTime required + optional fields
- [ ] `update_event` — eventId required + partial update fields
- [ ] `delete_event` — eventId + confirmDestructive required, scope optional
- [ ] `find_common_time` — userIds, dateFrom, dateTo, durationMinutes required
- [ ] `get_availability` — userId, dateFrom, dateTo required
- [ ] `search_events` — query required + optional filters
- [ ] `get_upcoming_events` — days?, workspaceId? optional

**ListResourcesRequestSchema:**
- [ ] `novacal://workspaces/{id}/members` — Team roster
- [ ] `novacal://workspaces/{id}/availability` — Weekly free/busy
- [ ] `novacal://users/me/profile` — Auth user profile

**Rate limiting:**
- [ ] 100 requests/min per API key (Redis incr + expire 60s)
- [ ] 10 tool calls per 10 seconds burst protection
- [ ] 5 destructive calls per minute per API key
- [ ] Audit logging: apiKeyId, tool, params, timestamp, IP

**Validation:**
- [ ] MCP server connects via SSE transport
- [ ] All 8 tools respond correctly to ListToolsRequestSchema
- [ ] create_event detects conflicts
- [ ] delete_event rejects without confirmDestructive: true
- [ ] RBAC enforced: VIEWER can't call create_event
- [ ] FREE_BUSY sees "Busy" blocks (no titles/details)
- [ ] Rate limit returns 429 when exceeded
- [ ] Session expires after 5 min inactivity

---

### Agent A22 — Mobile Component Engineer

**Pre-launch requirements:**
- [ ] Read Doc 02 Section 3B (ALL 9 mobile components: CameraScanner, SwipeableGrid, BottomSheetDateSelector, EventChip, SyncProgressRing, TargetingReticle, ApprovalBottomSheet, StatusDot, SyncStatusIndicator — complexity levels, key libraries)
- [ ] Read Doc 06 Section 3B (mobile design: bottom sheet navigation, QR scanner layout with glowing brackets, haptic feedback map: drag=light, view change=light, create=double-pulse, QR approve=double-pulse)
- [ ] Read Doc 07 Section 2 (ALL Reanimated specs: StatusDot withSpring state machine, reticle withRepeat scale breathe, EventChip withSpring shared element transition, SyncProgressRing Skia strokeDashoffset, theme switch circular clip-path, scroll parallax 0.3 factor, native thread via useAnimatedScrollHandler)
- [ ] Get: A02 output (`@novacal/shared` for mobile animation constants)

**Deliverables (9 components):**
- [ ] `apps/mobile/components/CameraScanner.tsx` — **High complexity.** Wraps expo-camera. Custom SVG overlay for TargetingReticle with Reanimated scaling breathe. On QR detect: neon bounding box snaps to code location (spring), box turns green, calls onDetected callback.
- [ ] `apps/mobile/components/SwipeableGrid.tsx` — **Extreme complexity.** Mobile calendar view. react-native-gesture-handler for left/right swiping between weeks/months. Reanimated native-thread animations. Month view default, tap day transitions to day view. Pull-to-refresh.
- [ ] `apps/mobile/components/BottomSheetDateSelector.tsx` — Custom action sheet sliding up. Native scroll wheels with haptic feedback on every tick. withDecay for momentum scrolling + snap to 15-min intervals.
- [ ] `apps/mobile/components/EventChip.tsx` — Mobile event indicator. Shared element transition (Reanimated). Tap: chip scales 1.05, lifts out of grid, morphs into full-screen event view. Swipe down reverses transition.
- [ ] `apps/mobile/components/SyncProgressRing.tsx` — Skia circular SVG. strokeDashoffset animates from circumference→0. Syncing: accent color, animating proportional to queue. Idle: full ring green. Offline: orange pulse withRepeat 1.5s.
- [ ] `apps/mobile/components/TargetingReticle.tsx` — Viewfinder corner brackets. Constant breathe animation: `withRepeat(withSpring(1.02), -1, true)`. Darkened overlay (`rgba(0,0,0,0.7)` scanning area). Uses react-native-svg.
- [ ] `apps/mobile/components/ApprovalBottomSheet.tsx` — Slides up from bottom on QR detection. withSpring from bottom edge. Camera view blurs behind (expo-blur). Drag handle at top. Swipe down to dismiss. "Approve Login" button.
- [ ] `apps/mobile/components/StatusDot.tsx` — Connection state machine: grey (disconnected) → orange (pinging) → green (connected). withSpring transitions. Error state: red shake (translateX oscillation with decay). Subtle pulse when offline.
- [ ] `apps/mobile/components/SyncStatusIndicator.tsx` — Compact status badge in settings. Shows: "Synced" (green), "Syncing..." (accent + pulse), "Offline" (orange), "Error" (red + shake). Uses Reanimated.

**Validation:**
- [ ] All components compile with Expo/Reanimated
- [ ] StatusDot transitions through grey→orange→green correctly
- [ ] TargetingReticle breathes at correct speed
- [ ] SwipeableGrid handles horizontal swipe gestures
- [ ] EventChip shared element transition works
- [ ] SyncProgressRing animates strokeDashoffset
- [ ] All animations run on UI thread (useAnimatedStyle, useSharedValue)
- [ ] Haptic feedback triggers on correct interactions

---

## 🏃 SPRINT 2 — WEB APPLICATION

**Parallel batch: 5 agents:**
```
┌──────────────────────────────────────────────────────────────┐
│ A13 ─── apps/mcp-server/ (index, auth, rbac, 8 tools)        │
│ A14 ─── apps/web/(auth)/ (setup, login, QR, callback)        │
│ A15 ─── apps/web/(dashboard)/middleware/layout/globals.css   │
│ A16 ─── apps/web/(settings)/(admin)/(workspace)/(developer)  │
│ A17 ─── apps/web/(public)/ + not-found.tsx + error.tsx       │
└──────────────────────────────────────────────────────────────┘
```

**Note:** A13 included here because it needs A12 (WebSocket) for session management integration — runs parallel with web pages.

---

### Agent A14 — Auth Page Engineer

**Pre-launch requirements:**
- [ ] Read Doc 05 Section 1 (auth routes: / → Login/QR or redirect, /setup first-run wizard, /login email/password, /login/qr WebSocket QR, /auth/callback Better Auth handler)
- [ ] Read Doc 06 Section 2A (auth layout: minimal centered card, no sidebar, staggered form fields, borderless inputs, magnetic glow buttons)
- [ ] Read Doc 07 Section 1 (AuthLayout: stagger children 0.05s, opacity 0→1 y 10→0. QR: sweep line linear y-loop 3s, scan success: scale 0.8 + green + circle reveal clip-path. MagneticButton: usePointerPosition glow. Form: fields stagger in via parent staggerChildren)
- [ ] Read AGENTS.md Rule 61 (dark mode first: OLED #000000 background)
- [ ] Get: A05 output (`@novacal/ui` for Button, Input, Dialog, Command, Skeleton)
- [ ] Get: A06 output (MagneticButton, FloatingLabelInput components)
- [ ] Get: A07 output (DynamicQRCode component)
- [ ] Get: A08 output (API route imports)
- [ ] Get: A12 output (WebSocket endpoint URL for QR)

**Deliverables (5 files):**
- [ ] `apps/web/app/(auth)/layout.tsx` — Minimal centered card layout. No sidebar, no navigation. <motion.div> with stagger children 0.05s, initial opacity 0 y 10, animate opacity 1 y 0. Background: #000000 (OLED black).
- [ ] `apps/web/app/(auth)/setup/page.tsx` — First-run wizard. Triggers only once (checks if any admin user exists). Instance Admin creation form: email, password, name. Creates first user with OWNER role. Styled per Doc 06 spec.
- [ ] `apps/web/app/(auth)/login/page.tsx` — Email/password fallback login. Uses FloatingLabelInput for fields. MagneticButton for submit. Form stagger animation. Links to /login/qr. Error state handling.
- [ ] `apps/web/app/(auth)/login/qr/page.tsx` — Dynamic QR code page. Uses DynamicQRCode component. WebSocket subscription to auth channel. Shows "Awaiting Mobile Connection…". On scan: QR shrinks to green, circle reveal to dashboard. 60s refresh with connecting indicator.
- [ ] `apps/web/app/(auth)/auth/callback/page.tsx` — Better Auth session callback handler. Invisible redirect — purely functional. Receives session token, redirects to /calendar.

**Validation:**
- [ ] / renders login/QR for unauthenticated users
- [ ] /setup renders only when no admin exists
- [ ] /login submits email/password correctly
- [ ] /login/qr displays QR and handles scan approval
- [ ] Layout uses stagger animation on mount
- [ ] All inputs are borderless with floating labels

---

### Agent A15 — Dashboard Engineer

**Pre-launch requirements:**
- [ ] Read Doc 05 Section 2 (dashboard: sidebar+edge-to-edge canvas, calendar/agenda/search routes, default landing after auth, day/week/month views via query params, infinite scroll agenda, full-page FTS search)
- [ ] Read Doc 06 Section 2 (edge-to-edge grid, sidebar 240-280px collapsible, cmd+K command palette, ghost blocks, glowing time indicator, event blocks with 2px left border, no spinners — only skeletons)
- [ ] Read Doc 07 Section 2 (view switching: slide left/right spring stiffness 200 damping 30, ~250ms. CommandPalette: AnimatePresence scale 0.95→1 spring 350/25. Results: layout prop for smooth filtering. EventBlock: drag="x,y", layoutId for shared element transitions)
- [ ] Read AGENTS.md Rule 25 (error boundaries everywhere), 27 (prefer server components), 66 (no spinners — skeletons only), 67 (beautiful empty states), 70 (glassmorphism blur(12px))
- [ ] Get: A05 output (`@novacal/ui` for layout components: Button, Command, ScrollArea, Skeleton, Toast)
- [ ] Get: A06 output (GridCanvas, EventBlock, TimeLineIndicator, GhostSlot components)
- [ ] Get: A07 output (MarkdownEditor, MiniMonthNavigator, AICommandBar, SyncProgressRing)
- [ ] Get: A09 output (API route imports for events/search)

**Deliverables (9 files):**
- [ ] `apps/web/app/globals.css` — ALL CSS variables from Doc 06: --background #000000, --surface #09090B, --surface-elevated #121214, --surface-hover #18181B, --primary-accent #6366F1, --border-subtle rgba(255,255,255,0.1), --border-elevated rgba(255,255,255,0.05), --ghost-hover rgba(255,255,255,0.05), --text-primary #FFFFFF, --text-secondary #A1A1AA, --text-muted #52525B, --destructive #EF4444, --success #22C55E, --warning #F59E0B, --font-sans Inter, --font-mono JetBrains Mono, --radius-base 8px, --radius-lg 12px, --radius-full 9999px, --shadow-elevated, --shadow-modal. Custom thin scrollbar. Global transition-none on shadcn elements. Dark mode default (no media query).
- [ ] `apps/web/middleware.ts` — Session token check. Redirects / → /calendar if authenticated, renders auth UI if not. Protects all authenticated route groups. X-Workspace-Id header forwarding.
- [ ] `apps/web/app/layout.tsx` — Root layout. Imports globals.css. Inter font. Providers: ThemeProvider, ToastProvider, AuthProvider. Metadata config.
- [ ] `apps/web/app/(dashboard)/layout.tsx` — Sidebar + edge-to-edge canvas. Translucent sidebar (240-280px, collapsible). Calendar toggles with hover-reveal eye icon. MiniMonthNavigator. User avatar + menu. Bottom: Cmd+K trigger indicator.
- [ ] `apps/web/app/(dashboard)/calendar/page.tsx` — Main calendar grid. Renders GridCanvas with current view. View switcher (day/week/month). Query param routing for date. Auth required. Empty state: "Your day is clear. Breathe." Skeleton shimmer while loading.
- [ ] `apps/web/app/(dashboard)/calendar/day/page.tsx` — Day-specific view with GridCanvas view="day". URL carries date query param.
- [ ] `apps/web/app/(dashboard)/calendar/week/page.tsx` — Week-specific view with GridCanvas view="week".
- [ ] `apps/web/app/(dashboard)/agenda/page.tsx` — Infinite scroll list. Sticky date headers. Event cards with time, title, location, color dot. ScrollArea for smooth scrolling. fetchMore on scroll to bottom.
- [ ] `apps/web/app/(dashboard)/search/page.tsx` — Full-page search. Input autofocuses. Results stream as user types. PostgreSQL FTS via search API. Skeleton shimmer while loading. Keyboard navigation: ↑↓ to select, Enter to open. AnimatePresence for result transitions.

**Validation:**
- [ ] globals.css has ALL Doc 06 CSS variables
- [ ] Middleware correctly redirects auth/unauthenticated
- [ ] Dashboard layout renders sidebar + grid
- [ ] Calendar page renders GridCanvas for all view types
- [ ] View switching animates correctly (slide spring)
- [ ] Agenda scrolls infinitely with sticky date headers
- [ ] Search autofocuses and returns FTS results
- [ ] Empty states show "Your day is clear. Breathe."
- [ ] No spinners anywhere — only skeleton shimmer
- [ ] Glassmorphism blur(12px) on modals/dropdowns
- [ ] Ghost slots appear on empty grid hover

---

### Agent A16 — Settings/Admin/Workspace/Developer Engineer

**Pre-launch requirements:**
- [ ] Read Doc 05 Sections 3-6 (Developer: MCP config, API keys, webhooks. Workspace: settings, members. Admin: dashboard, users, system. Settings: profile, security, sessions, preferences)
- [ ] Read Doc 06 (settings layout: left nav tabs, active pill sliding with LayoutGroup. Developer: denser UI, monospace for keys, copy buttons. Admin: dashboard cards, charts)
- [ ] Read Doc 07 (member rows: motion.tr layout for glide reorder. Switch: motion.div layout with spring 200ms. Sidebar active pill: LayoutGroup. Copy button pop: [1, 1.2, 1]. Code block hover: gradient sweep)
- [ ] Get: A05 output (`@novacal/ui`)
- [ ] Get: A06 output (CodeBlockCopy, MagneticButton)
- [ ] Get: A08 output (auth API routes for sessions/security)
- [ ] Get: A09 output (events API for admin stats)
- [ ] Get: A10 output (workspace API for member management)
- [ ] Get: A11 output (system API for admin metrics)

**Deliverables (16 files):**
- [ ] `apps/web/app/(settings)/layout.tsx` — Settings sidebar with left nav: Profile, Security, Sessions, Preferences. LayoutGroup for active pill sliding animation.
- [ ] `apps/web/app/(settings)/profile/page.tsx` — Name, avatar upload, personal timezone selector (IANA list from `Intl.supportedValuesOf('timeZone')`).
- [ ] `apps/web/app/(settings)/security/page.tsx` — Change password (current + new), 2FA setup (TOTP QR code display).
- [ ] `apps/web/app/(settings)/sessions/page.tsx` — Device ledger table. Columns: Device, IP, Last Active, Created. "Revoke" button per row. "Log out of all devices" panic button (red, confirmation dialog).
- [ ] `apps/web/app/(settings)/preferences/page.tsx` — SwitchToggle: dark/light/system, start of week (Mon/Sun), default calendar view, time format (12h/24h).
- [ ] `apps/web/app/(admin)/layout.tsx` — Admin sidebar with dashboard-style cards navigation. Instance Admin only.
- [ ] `apps/web/app/(admin)/dashboard/page.tsx` — Global metrics: total users, events, workspaces, active WS connections, DB size, Redis memory, requests/min. Card layout with metric display.
- [ ] `apps/web/app/(admin)/users/page.tsx` — User management table. Columns: Name, Email, Status, Created, Last Login. Actions: force reset password, ban/unban. Search + filter.
- [ ] `apps/web/app/(admin)/system/page.tsx` — Redis cache memory + connection health. PG connection pool status. Uptime, version. Logs viewer (last 100 lines).
- [ ] `apps/web/app/(workspace)/w/[id]/layout.tsx` — Settings-style layout with left nav tabs: Settings | Members.
- [ ] `apps/web/app/(workspace)/w/[id]/settings/page.tsx` — Name, custom branding, default timezone. Danger Zone: delete workspace (Owner only, red dialog confirmation).
- [ ] `apps/web/app/(workspace)/w/[id]/members/page.tsx` — Member table. Columns: Name, Email, Role, Joined, Actions. Role dropdown per user. "Invite Member" button → generates one-time link modal. motion.tr layout for add/remove glide.
- [ ] `apps/web/app/(developer)/layout.tsx` — Developer-oriented layout: slightly denser UI, monospace fonts for keys and payloads.
- [ ] `apps/web/app/(developer)/mcp/page.tsx` — AI Agent configuration hub. Displays mcp.json payload for Cursor/Claude. Shows connection string. Copy Config button (CodeBlockCopy). Self-documenting MCP config from /api/mcp/config.
- [ ] `apps/web/app/(developer)/api-keys/page.tsx` — Key table: name, prefix, created date, last used. "Create Key" button → reveals full key once with copy button. Revoke per key.
- [ ] `apps/web/app/(developer)/webhooks/page.tsx` — Event triggers (event.created, updated, deleted). Target URL input + secret token. Delivery log table (status, timestamp, response code).

**Validation:**
- [ ] Settings tab navigation works with LayoutGroup active pill
- [ ] Sessions page lists devices and revokes correctly
- [ ] Admin dashboard shows real metrics from API
- [ ] Admin users page lists all users
- [ ] Workspace members page shows role dropdown
- [ ] Member rows animate on add/remove (motion.tr layout)
- [ ] MCP config page shows correct mcp.json
- [ ] API keys can be generated and revoked
- [ ] Webhooks page shows delivery logs
- [ ] SwitchToggle uses motion.div layout spring
- [ ] Danger Zone delete requires confirmation

---

### Agent A17 — Public Pages Engineer

**Pre-launch requirements:**
- [ ] Read Doc 05 Section 7-8 (public routes: /p/[hash] read-only calendar, /e/[hash] single event landing, 404/500 error pages)
- [ ] Read Doc 06 (public pages: minimal, no sidebar, no nav, clean centered rendering. 404: minimalist typography. 500: stack trace dump)
- [ ] Get: A09 output (events API for fetching event by ID/hash)
- [ ] Get: A11 output (share API for hash lookup + public endpoints)

**Deliverables (4 files):**
- [ ] `apps/web/app/(public)/p/[hash]/page.tsx` — Read-only public calendar view. Cryptographically secure hash from URL params. No auth. Optional password challenge screen (if link has password). Clean minimal calendar rendering. Respects share expiration.
- [ ] `apps/web/app/(public)/e/[hash]/page.tsx` — Single event landing page. Shows: title, time, description, location. "Add to Calendar" button → .ics download. Standalone shareable URL.
- [ ] `apps/web/app/not-found.tsx` — Minimalist 404. "This page doesn't exist." Link back to /calendar. Clean typography, no illustrations.
- [ ] `apps/web/app/error.tsx` — Global error boundary. "Something broke. Here's what happened:" Stack trace dump (collapsible). "Reload" button. Red accent for destructive theme.

**Validation:**
- [ ] /p/[hash] renders without auth
- [ ] Password-protected links show password challenge
- [ ] Expired links return 404 or "link expired" message
- [ ] /e/[hash] shows single event details
- [ ] .ics download button generates correct file
- [ ] 404 renders cleanly without nav/sidebar
- [ ] 500 shows collapsible error details + reload button

---

## 🏃 SPRINT 3 — MOBILE APPLICATION

**Parallel batch: 5 agents:**
```
┌──────────────────────────────────────────────────────────────┐
│ A18 ─── apps/mobile/(auth)/ + _layout.tsx                    │
│ A19 ─── apps/mobile/(tabs)/ (4 tabs + tab bar)               │
│ A20 ─── apps/mobile/(modals)/ (event create, view, search)   │
│ A21 ─── apps/mobile/(settings)/ (6 settings screens)         │
│ A23 ─── apps/mobile/services/ (api, offline-sync, fcm)       │
└──────────────────────────────────────────────────────────────┘
```

---

### Agent A18 — Mobile Auth Engineer

**Pre-launch requirements:**
- [ ] Read Doc 05 Mobile Section 1 (auth stack: connect, login, scanner. Connect: single input "Instance URL", persist in secure storage. Login: email/password POST. Scanner: camera viewfinder, QR detection, approval)
- [ ] Read Doc 06 Mobile (haptic feedback map, QR scanner flow: dark overlay + glowing brackets, neon bounding box snap, approval bottom sheet)
- [ ] Read Doc 07 Mobile (StatusDot: withSpring grey→orange→green. Reticle: withRepeat scale [0.98,1.02] breathe. ApprovalBottomSheet: withSpring slide-up + blur. Search bar: withSpring from top.)
- [ ] Get: A22 output (CameraScanner, TargetingReticle, ApprovalBottomSheet, StatusDot components)

**Deliverables (6 files):**
- [ ] `apps/mobile/app/_layout.tsx` — Root layout. SQLite provider (initializes local DB on mount). Global toast container. Network status listener. Deep link handler. Expo Router config.
- [ ] `apps/mobile/app/+not-found.tsx` — Fallback for broken deep links. "Screen not found." "Go Home" button → tabs root.
- [ ] `apps/mobile/app/(auth)/_layout.tsx` — Auth stack layout (not in tab navigator). No bottom tabs. Full-screen stack. Shown only when no valid session exists.
- [ ] `apps/mobile/app/(auth)/connect.tsx` — First screen. Single input: "Instance URL" (e.g., `https://cal.yourdomain.com`). "Connect" button validates reachability via `/api/health`. StatusDot shows grey→orange→green transition. Persists URL in secure storage. Navigates to /login on success.
- [ ] `apps/mobile/app/(auth)/login.tsx` — Email/password form. POSTs to {instanceUrl}/api/auth/login. Stores session token in secure storage. Navigates to tabs on success. Error state display for invalid credentials.
- [ ] `apps/mobile/app/(auth)/scanner.tsx` — QR bridge. Camera viewfinder with TargetingReticle overlay. On QR detect: neon bounding box snap + green confirmation. ApprovalBottomSheet slides up with "Approve Login for this browser?" On approve: POST to {instanceUrl}/api/auth/qr/approve. Navigates to tabs.

**Validation:**
- [ ] App starts with connect screen (no hardcoded instance URL)
- [ ] Instance URL validation pings /api/health
- [ ] Login sends POST to correct endpoint
- [ ] Scanner opens camera with reticle overlay
- [ ] QR detection shows approval sheet
- [ ] Successful auth navigates to tabs
- [ ] Session token persisted in secure storage

---

### Agent A19 — Mobile Tab Engineer

**Pre-launch requirements:**
- [ ] Read Doc 05 Mobile Section 2 (4 tabs: calendar, agenda, notifications, settings. Month view default with swipe. Sticky date headers. Notification cards with accept/decline. Settings hub with navigation rows)
- [ ] Read Doc 06 Mobile (bottom tab bar design, bottom sheet for event details)
- [ ] Read Doc 07 Mobile (SwipeableGrid: useAnimatedScrollHandler + parallax 0.3. EventChip: withSpring shared element transition. Agenda: fade-up on scroll enter, useSharedValue native thread. Sticky date header push)
- [ ] Get: A22 output (SwipeableGrid, EventChip components)

**Deliverables (5 files):**
- [ ] `apps/mobile/app/(tabs)/_layout.tsx` — Bottom tab bar with 4 tabs: Calendar (📅), Agenda (📋), Notifications (🔔), Settings (⚙️). Auth required.
- [ ] `apps/mobile/app/(tabs)/calendar.tsx` — SwipeableGrid month view. Swipe left/right for next/prev month. Tap day → transitions to day view (parallax scroll). Pull to refresh. Empty state illustration. EventChip events on dates.
- [ ] `apps/mobile/app/(tabs)/agenda.tsx` — Vertical scrolling chronological list. Sticky date headers. Event cards: time, title, location, color dot. useAnimatedScrollHandler for native-thread performance. Fade-up on scroll enter.
- [ ] `apps/mobile/app/(tabs)/notifications.tsx` — Feed of team invites and AI scheduling confirmations. Notification cards: type icon, message, timestamp. Tap invite → accept/decline sheet. Tap AI confirmation → opens created event.
- [ ] `apps/mobile/app/(tabs)/settings.tsx` — Main settings hub. Navigation rows: Profile, Workspaces, Notifications, Appearance, Database Sync, Server Info. Tap → push navigation to settings detail screens.

**Validation:**
- [ ] Bottom tab bar renders 4 tabs
- [ ] Calendar tab shows month grid with swipe
- [ ] Day view available with parallax scroll
- [ ] Agenda lists events chronologically
- [ ] Notifications show invite feed with accept/decline
- [ ] Settings hub navigates to detail screens
- [ ] All animations run on UI thread (native)

---

### Agent A20 — Mobile Modal Engineer

**Pre-launch requirements:**
- [ ] Read Doc 05 Mobile Section 3 (modals: event/new form, event/[id] read-only, event/[id]/edit, search overlay)
- [ ] Read Doc 06 Mobile (bottom sheet: Apple Maps style, drag handle, swipe-to-dismiss, blur backdrop. Search: autofocus, local SQLite FTS first, server fallback)
- [ ] Read Doc 07 Mobile (search bar: withSpring from top edge spring 300. SkeletonRow: withRepeat withTiming 0.3↔1.0 800ms. Custom time wheel: withDecay + snap + haptics. Bottom sheet: withSpring slide-up)
- [ ] Get: A22 output (BottomSheetDateSelector, EventChip)

**Deliverables (3 files):**
- [ ] `apps/mobile/app/(modals)/event/new.tsx` — Event creation form. Slide-up presentation. Fields: title, date/time with BottomSheetDateSelector, duration, location, markdown description. Workspace selector. "Save" → optimistically updates local SQLite, queues sync. Haptic double-pulse on success.
- [ ] `apps/mobile/app/(modals)/event/[id].tsx` — Event detail view. Read-only display: title, time, date, location, description markdown, attendees. Bottom action bar: "Edit", "Delete", "Add to Calendar" (.ics download). Slide-up presentation.
- [ ] `apps/mobile/app/(modals)/search.tsx` — Full-screen search overlay. Autofocus on mount (keyboard visible). Results stream in as user types: local SQLite FTS first (instant), then server PG FTS fallback. Skeleton shimmer while loading. Tap result → opens /event/[id]. withSpring from top on mount.

**Validation:**
- [ ] Event creation form slides up from bottom
- [ ] Form saves to local SQLite optimistically
- [ ] Event detail shows all fields
- [ ] Search streams results from local + server
- [ ] Search autofocuses keyboard on mount
- [ ] Custom time wheel snaps to 15-min intervals
- [ ] Haptic feedback on creation

---

### Agent A21 — Mobile Settings Engineer

**Pre-launch requirements:**
- [ ] Read Doc 05 Mobile Section 4 (6 settings screens: profile, workspaces, notifications, appearance, database-sync, server-info)
- [ ] Read Doc 06 (theme switch: circular reveal animation from tap point)
- [ ] Read Doc 07 (SyncProgressRing: Skia strokeDashoffset. Offline: orange pulse withRepeat 0.5↔1.0 1.5s. Theme switch: circular clip-path from tap withSpring ~400ms)
- [ ] Get: A22 output (SyncProgressRing, SyncStatusIndicator)

**Deliverables (6 files):**
- [ ] `apps/mobile/app/(settings)/profile.tsx` — Edit display name. Save to API.
- [ ] `apps/mobile/app/(settings)/workspaces.tsx` — List of workspaces user belongs to. Current workspace highlighted. Tap → sets active context, goes back.
- [ ] `apps/mobile/app/(settings)/notifications.tsx` — Push notification toggles: Event reminders, Team invites, AI scheduling confirmations. Reminder timing: 10min, 30min, 1hr, 1day selectors.
- [ ] `apps/mobile/app/(settings)/appearance.tsx` — Dark/Light/System theme toggle. Circular reveal animation from tap point on switch. withSpring ~400ms clip-path.
- [ ] `apps/mobile/app/(settings)/database-sync.tsx` — SQLite file size. Pending sync count. Last sync timestamp. SyncProgressRing showing current status. "Force Push" button (immediately syncs all queued mutations). "Pull Latest" button (fetches remote changes).
- [ ] `apps/mobile/app/(settings)/server-info.tsx` — Instance URL (read-only). Ping latency in ms (live, updated every tap). Server version.

**Validation:**
- [ ] Profile saves name changes
- [ ] Workspace switching changes active context
- [ ] Notification toggles persist preferences
- [ ] Appearance theme switch has circular reveal animation
- [ ] Database sync screen shows SQLite stats
- [ ] Force Push and Pull Latest buttons work
- [ ] Server info shows ping latency

---

### Agent A23 — Mobile Services Engineer

**Pre-launch requirements:**
- [ ] Read Doc 09 Section 7 (offline sync: expo-sqlite, PENDING_SYNC queue, push on reconnect, pull remote changes, last-write-wins reconciliation, FCM push notifications)
- [ ] Read Doc 03 (REST API contract: base URL, headers, endpoints)
- [ ] Get: A09 output (events API contract)
- [ ] Get: A10 output (workspaces API contract)
- [ ] Get: A08 output (auth API contract)

**Deliverables (4 files):**
- [ ] `apps/mobile/services/api.ts` — Typed HTTP client. Base URL from secure storage. Auth token injection. All endpoints: auth (register, login, logout, sessions), events (list, create, update, delete, search), workspaces (list, members, invites), share (create, revoke). Standard error handling. TypeScript response types.
- [ ] `apps/mobile/services/offline-sync.ts` — Sync engine. On event create/update/delete while offline: store in local SQLite with status "PENDING_SYNC", add to sync queue. On network reconnect: push queued mutations to server (POST/PATCH/DELETE), pull changes since last sync timestamp (GET /api/sync), merge + reconcile (last-write-wins with conflict notification), update local SQLite.
- [ ] `apps/mobile/services/fcm.ts` — Firebase Cloud Messaging config. Push notification handlers for: event reminders (10min, 30min, 1hr, 1day before), team invites, AI scheduling confirmations. Token registration with server.
- [ ] `apps/mobile/services/index.ts` — Barrel export for all services.

**Validation:**
- [ ] API client correctly resolves all REST endpoints
- [ ] Auth token automatically attached to requests
- [ ] Offline mutations queued with status PENDING_SYNC
- [ ] Sync engine pushes queued items on reconnect
- [ ] Conflict notification on write-write conflict
- [ ] FCM token registered with server

---

## 🏃 SPRINT 4 — QA + INTEGRATION

**Sequential: 2 agents (test → security + full build)**

### Agent A25a — Test Engineer

**Pre-launch requirements:**
- [ ] Read ALL 9 docs (comprehensive understanding of every feature to test)
- [ ] Read AGENTS.md Rule 29 (co-locate tests, integration tests in __tests__/)
- [ ] Read AGENTS.md Rule 15 (stop on errors, report, don't auto-fix)
- [ ] Get: All agent outputs from Sprints 0-3

**Deliverables:**

**Authentication Tests:**
- [ ] POST /auth/register — valid input creates user returns session
- [ ] POST /auth/register — invalid email returns VALIDATION_ERROR
- [ ] POST /auth/login — valid credentials return session
- [ ] POST /auth/login — invalid password returns UNAUTHORIZED
- [ ] POST /auth/qr/init — creates Redis challenge with 60s TTL
- [ ] POST /auth/qr/approve — valid challenge returns APPROVED
- [ ] POST /auth/qr/approve — already approved returns 409
- [ ] POST /auth/qr/approve — expired challenge returns 404
- [ ] POST /auth/logout — invalidates session
- [ ] GET /auth/sessions — returns device ledger
- [ ] DELETE /auth/sessions/:id — revokes specific session
- [ ] DELETE /auth/sessions — revokes all sessions
- [ ] Rate limiting — 11th auth request returns 429

**Workspace Tests:**
- [ ] GET /workspaces — lists user's workspaces
- [ ] POST /workspaces — creates workspace with creator as OWNER
- [ ] DELETE /workspaces — Owner only (non-Owner gets 403)
- [ ] PATCH /workspaces/:id/members/:userId — Owner/Admin can change roles
- [ ] PATCH /workspaces/:id/members/:userId — VIEWER gets 403
- [ ] DELETE /workspaces/:id/members/:userId — removes member
- [ ] POST /workspaces/:id/invites — generates one-time link

**Events Tests:**
- [ ] GET /events — returns events in time range
- [ ] GET /events — cursor pagination when > limit
- [ ] POST /events — creates event with conflict detection
- [ ] POST /events — EDITOR can create, VIEWER gets 403
- [ ] POST /events — duplicate idempotency key returns same result
- [ ] PATCH /events/:id — updates event
- [ ] PATCH /events/:id — singleInstance for recurring edits
- [ ] DELETE /events/:id — soft delete (sets deletedAt, not hard delete)
- [ ] DELETE /events/:id — scope=single vs this_and_future vs all
- [ ] GET /search — FTS returns ranked results
- [ ] GET /search — typo tolerance via prefix matching

**WebSocket Tests:**
- [ ] Connect with valid token → receives endpoint event
- [ ] SUBSCRIBE with valid workspaceId+token → joins room
- [ ] SUBSCRIBE with invalid token → connection rejected
- [ ] Heartbeat ping received every 30s
- [ ] EVENT_CREATED broadcast to room after event creation
- [ ] EVENT_UPDATED broadcast after patch
- [ ] EVENT_DELETED broadcast after delete
- [ ] USER_ONLINE/OFFLINE presence tracking
- [ ] User disconnected → USER_OFFLINE broadcast
- [ ] Max 5 concurrent connections enforced

**MCP Tests:**
- [ ] GET /mcp/sse with valid Bearer token → SSE stream established
- [ ] GET /mcp/sse without token → 401
- [ ] ListToolsRequestSchema returns all 8 tools
- [ ] create_event with valid params → event created
- [ ] delete_event without confirmDestructive → rejected
- [ ] delete_event with confirmDestructive: true → deleted
- [ ] find_common_time returns available slots
- [ ] search_events returns FTS results
- [ ] FREE_BUSY role sees "Busy" blocks (no titles)
- [ ] Rate limit (100 req/min) → 429 after exceeded

**Share Tests:**
- [ ] POST /share/calendar/:id → generates 64-char hex hash
- [ ] DELETE /share/:hash → revokes link
- [ ] GET /p/:hash → public calendar view (no auth)
- [ ] GET /e/:hash → single event landing page
- [ ] POST /share/verify/:hash → correct password returns valid
- [ ] POST /share/verify/:hash → wrong password returns 401

**System Tests:**
- [ ] GET /health returns { status, postgres, redis, uptime, version }
- [ ] GET /health without auth → succeeds
- [ ] GET /system/metrics requires Instance Admin

**Mobile Offline Tests:**
- [ ] Event created while offline → stored in local SQLite
- [ ] Sync queue contains PENDING_SYNC items
- [ ] On network restoration → queued items pushed
- [ ] Server changes pulled since last sync
- [ ] Conflict notification on write-write collision

**Validation:**
- [ ] All test files co-located with source files (*.test.ts)
- [ ] All tests pass
- [ ] Test coverage report generated

---

### Agent A25b — Security Auditor

**Pre-launch requirements:**
- [ ] Read AGENTS.md Rules 42-45 (auth: text PKs, restrict-delete, key hashing), 45-60 (API: bearer tokens, rate limiting), 55-56 (QR: 60s TTL, single-use, UUID unguessable), 78-83 (MCP: confirmDestructive, RBAC, RLS)
- [ ] Read Doc 04 Section 1.3 (MCP security model: Bearer auth, bcrypt, RBAC, RLS, audit trail)
- [ ] Get: All agent outputs from Sprints 0-3

**Deliverables (1 report):**
- [ ] `docs/security-audit-report.md`

**Security Checks:**
- [ ] ALL API keys stored as bcrypt hashes (never plaintext)
- [ ] QR challenges single-use (PENDING→APPROVED, never reused)
- [ ] QR challenge 60s hard TTL (Redis TTL set on creation)
- [ ] WebSocket channels use unguessable UUIDs (no sequential IDs)
- [ ] Sessions use text PKs per Better Auth convention
- [ ] `ownerId` on workspaces uses `onDelete: "restrict"` (can't delete workspace owner)
- [ ] RLS policies exist on all user-scoped tables
- [ ] Rate limits enforced: auth 10/min, standard 100/min, MCP 100/min, search 30/min, destructive 5/min
- [ ] MCP `delete_event` requires `confirmDestructive: true`
- [ ] No hardcoded secrets or credentials in any file
- [ ] CORS headers restrictive (not `Access-Control-Allow-Origin: *`)
- [ ] X-Content-Type-Options: nosniff
- [ ] X-Frame-Options: DENY
- [ ] All user input validated via Zod schemas
- [ ] No eval() or dynamic code execution
- [ ] Binary file uploads rejected at API level (Doc 01 Rule 39)
- [ ] .env not committed (in .gitignore)
- [ ] Database connection strings not exposed in client-side code

---

## ✅ MASTER CHECKLIST — ALL 17 QUALITY CHECKS

| # | Check | Verification | Applies To |
|---|-------|-------------|-----------|
| [ ] | 1. TypeScript compiles — zero `any`, zero type errors | `bun run typecheck` | ALL agents |
| [ ] | 2. Zod validation on every input | Code review API routes + MCP tools | A08-A11, A13 |
| [ ] | 3. RBAC enforced — every mutation checks role hierarchy | Code review PATCH/DELETE/DELETE handlers | A08-A11, A13 |
| [ ] | 4. Standard error format — `{ error: { code, message, details } }` | Test every error response | A08-A11, A13 |
| [ ] | 5. UTC-only storage — `timestamptz`, never local time | Code review Drizzle schema + insert logic | A03, A09 |
| [ ] | 6. Soft deletes — `deleted_at`, never hard DELETE | Test DELETE /events/:id | A03, A09 |
| [ ] | 7. Spring physics only — no CSS transitions, no linear | Code review all components | A05, A06, A07, A14-A17, A22 |
| [ ] | 8. Dark mode first — OLED `#000000`, CSS variables | Check globals.css + component themes | A05, A14-A17 |
| [ ] | 9. Surface depth architecture — 4 levels | Check CSS: --background, --surface, etc. | A05, A14-A17 |
| [ ] | 10. No spinners — skeletons with shimmer | Code review loading states | A06, A07, A14-A17, A22 |
| [ ] | 11. Error boundaries — `error.tsx` in each route group | Check directory structure | A14-A17 |
| [ ] | 12. Glassmorphism — blur(12px) on modals/dropdowns | Code review dialog/popover/select | A05, A06, A14-A17 |
| [ ] | 13. Haptic feedback — correct impacts per gesture | Test mobile interactions | A18-A21, A22 |
| [ ] | 14. Offline-first mobile — SQLite, sync queue, StatusDot | Test offline create + reconnect sync | A23, A21 |
| [ ] | 15. MCP tools complete — all 8 with exact schemas | ListToolsRequestSchema response check | A13 |
| [ ] | 16. WebSocket contract — all 7 events + heartbeat | WS event log test | A12 |
| [ ] | 17. Docker health checks — `/api/health` with PG+Redis | `docker compose up` + curl health | A11, A24 |

---

## 🏁 FINAL BUILD VALIDATION

After ALL 5 sprints and QA pass:

```
1.  bun install                          # Fresh install
2.  bun run typecheck --workspaces        # Full compilation
3.  bun run lint                          # ESLint check
4.  bun vitest run                        # All tests pass
5.  bun run build                         # Next.js build
6.  cd apps/mobile && npx expo export     # Expo build
7.  cd docker && docker compose up -d     # All 4 containers start
8.  curl localhost:3000/api/health        # Returns healthy
9.  curl localhost:3001 (WebSocket)       # Accepts connection
10. curl localhost:3001/mcp/sse (MCP)     # SSE stream opens
```

---

## EXECUTION SUMMARY

| Sprint | Agents | Files | Parallelism | Est. Tool Calls |
|--------|--------|-------|-------------|----------------|
| 0 — Foundation | 4 | ~25 | 4× parallel | ~80 |
| 1 — Backend + Components | 10 | ~75 | 10× parallel | ~300 |
| 2 — Web Application | 5 | ~35 | 5× parallel | ~140 |
| 3 — Mobile Application | 5 | ~24 | 5× parallel | ~100 |
| 4 — QA + Integration | 2 | ~20 | 2× sequential | ~80 |
| **Total** | **25** | **~180** | — | **~700** |

---

## KEY DESIGN PRINCIPLES

1. **Context isolation** — Each agent gets ONLY the doc sections relevant to their domain. No agent carries the full spec.
2. **No file conflicts** — File ownership is strictly partitioned. No two agents in the same sprint write to the same file.
3. **Quality gates between sprints** — Every sprint output is typechecked and validated before next sprint starts.
4. **Failure isolation** — If one agent fails, only that agent is retried (not the entire sprint).
5. **Deferred compilation** — TypeScript compilation happens at sprint gates, not during agent execution.
6. **Doc-driven** — Every agent's context bundle contains exact doc references. No guessing, no hallucinations.
7. **Final grade only** — All 17 quality checks must pass. No stubs, no TODOs, no v1.
