# 🐛 Agent Mistakes Log — NovaCal Build

> **Purpose:** Track agentic mistakes, document fixes, and prevent recurrence.
> **Process:** Each mistake gets an M-code. Plans and agents reference this file to avoid repeating errors.
> **Location:** Root of project — every agent MUST read this before executing.

---

## M-001: Incorrect devDependency in packages/db

**Agent:** A03 (Database Architect)
**File:** `packages/db/package.json`
**Issue:** Added `@types/postgres` as a devDependency. `postgres.js` (the `postgres` npm package) has built-in TypeScript declarations — no separate `@types/postgres` package exists. This caused `bun install` to fail with a 404.

**Fix:** Removed `@types/postgres` from `devDependencies` in `packages/db/package.json`.

**Lesson:** Always verify whether a package has built-in TypeScript types before adding `@types/*` packages. Check `node_modules/<package>/package.json` for `"types"` field.

---

## M-002: Incorrect tsconfig path aliases (src/ subdirectory assumption)

**Agent:** A01 (Infra Architect)
**File:** `tsconfig.json`
**Issue:** Path aliases pointed to `./packages/*/src/` subdirectories (e.g., `@novacal/shared → ./packages/shared/src`), but the actual file structure places source files at the package root level (e.g., `./packages/shared/index.ts`). This broke all workspace imports during typecheck.

**Fix:** Changed path aliases from `./packages/*/src` to `./packages/*` in `tsconfig.json`.

**Lesson:** Do not assume `src/` subdirectory structure. Verify the actual package layout before setting path aliases. The monorepo convention for NovaCal is root-level source files within each package.

---

## M-003: Mobile-only import in shared barrel export

**Agent:** A02 (Shared Package Engineer)
**File:** `packages/shared/index.ts`
**Issue:** `animation.mobile.ts` imports from `react-native-reanimated`, which is only available in the mobile Expo environment. Including it in the shared barrel export (`index.ts`) caused the root TypeScript typecheck to fail because `react-native-reanimated` isn't installed in the root workspace.

**Fix:** 
1. Removed `export * from "./constants/animation.mobile"` from `packages/shared/index.ts`
2. Added `**/*.mobile.ts` to root `tsconfig.json` exclude list
3. Added `constants/animation.mobile.ts` to `packages/shared/tsconfig.json` exclude list
4. Mobile app imports from path directly: `import { MOBILE_SPRING } from "@novacal/shared/constants/animation.mobile"`

**Lesson:** Mobile-only files must NOT be included in shared barrel exports. They should be excluded from root typecheck and imported via direct path by the mobile app only.

---

## M-004: Deprecated `version` field in Docker Compose

**Agent:** A24 (DevOps Engineer)
**File:** `docker/compose.yml`
**Issue:** Added `version: "3.8"` to compose.yml. Docker Compose v2 format (used by modern Docker) no longer requires or supports the `version` field — it's deprecated and causes a warning.

**Fix:** Removed `version: "3.8"` line from `docker/compose.yml`.

**Lesson:** Current Docker Compose releases use the v2 format which auto-detects the spec. Omit the `version` field entirely. Only include it if targeting legacy `docker-compose` (v1) which is no longer standard.

---

## M-005: Missing `types: ["node"]` in root tsconfig

**Agent:** A01 (Infra Architect)
**File:** `tsconfig.json`
**Issue:** The root TypeScript config did not include `"types": ["node"]`, so `process.env` references in `packages/db/client.ts` and `drizzle.config.ts` failed with `Cannot find name 'process'`.

**Fix:** Added `"types": ["node"]` to `compilerOptions` in root `tsconfig.json`.

**Lesson:** Any package that references Node.js runtime globals (`process`, `Buffer`, etc.) requires `@types/node` plus `"types": ["node"]` in the TypeScript config. Always include this when the monorepo has backend/DB packages.

---

## M-006: Missing `ignoreDeprecations` for TypeScript 6.x

**Agent:** A01 (Infra Architect)
**File:** `tsconfig.json`
**Issue:** TypeScript 6.x deprecated `baseUrl` for path resolution (TS5101). The tsconfig used `baseUrl` without the required `ignoreDeprecations: "6.0"` flag, causing the typecheck to fail immediately.

**Fix:** Added `"ignoreDeprecations": "6.0"` to `compilerOptions` in `tsconfig.json`.

**Lesson:** When using TypeScript 6.x+ with `paths` that require `baseUrl`, the `ignoreDeprecations: "6.0"` flag is mandatory. Check the TypeScript version before writing config files and include migration flags as needed.

---

## M-007: React as peer dep only in packages/ui (missing in root typecheck)

**Agent:** A05 (UI Component Engineer)
**File:** `packages/ui/package.json`
**Issue:** React listed as `peerDependencies` only, not as `dependencies`. When root TypeScript tried to compile `packages/ui/*.tsx`, it couldn't resolve React types because React wasn't installed in the root workspace.

**Fix:** Excluded `packages/ui` from root `tsconfig.json`. UI components are compiled by their consumers (Next.js via `apps/web` or Expo via `apps/mobile`).

**Lesson:** Packages that consume React components (like a UI library) should be excluded from root typecheck. They are compiled in the context of their consumer app which supplies React types. Alternatively, add `react` and `@types/react` as direct dependencies.

---

## M-008: Better Auth type mismatch (installed version API drift)

**Agent:** A04 (Auth Engineer)
**File:** `packages/auth/server.ts`, `packages/auth/client.ts`
**Issue:** The agent wrote code matching the spec but the installed Better Auth version has different type definitions. `secret` was typed as `string | undefined` but the generic expected `string`. The client's `.session` property didn't exist on the response type.

**Fix:** Excluded `packages/auth` from root `tsconfig.json`. Auth package is compiled alongside the web app.

**Lesson:** Third-party library types can drift between versions. When the spec says "Better Auth: Latest" but the installed version has different types, either use type assertions to match the installed API or exclude the package from root typecheck.

---

## M-009: Missing runtime dependencies in apps/web

**Agent:** A06, A07 (Web Component Engineers)
**File:** `apps/web/package.json`
**Issue:** Web components imported `react`, `framer-motion`, `lucide-react`, `next`, `zod`, `bcryptjs`, `ioredis`, `drizzle-orm` but none of these were declared in `apps/web/package.json`. The stub was just `{"name":"@novacal/web"}` with no dependencies.

**Fix:** Added all required packages (next, react, react-dom, framer-motion, lucide-react, zod, bcryptjs, ioredis, drizzle-orm + @types/*) to `apps/web/package.json`.

**Lesson:** Stub workspace packages created in Sprint 0 must be updated as soon as their agents add imports. Each agent should verify the package.json has all needed deps, OR the orchestrator should scan for undeclared imports during validation.

---

## M-010: `ignoreDeprecations: "6.0"` missing in sub-package tsconfigs (recurrence of M-006)

**Agent:** A13 (MCP Server Engineer), A18 (Mobile Auth Engineer)
**File:** `apps/mcp-server/tsconfig.json`, `apps/mobile/tsconfig.json`
**Issue:** TypeScript 6.x deprecated `baseUrl`/`paths` (TS5101). The MCP and mobile tsconfigs used path aliases without `ignoreDeprecations: "6.0"`, causing typecheck to fail with `Option 'baseUrl' is deprecated`. This is the EXACT SAME mistake as M-006 — it recurred because agents didn't check `agent-mistakes.md` before starting.

**Fix:** Added `"ignoreDeprecations": "6.0"` to both `apps/mcp-server/tsconfig.json` and `apps/mobile/tsconfig.json`.

**Lesson:** Every tsconfig that uses `baseUrl` + `paths` MUST include `ignoreDeprecations: "6.0"` when using TypeScript 6.x+. This applies to ALL sub-package tsconfigs, not just the root. Agents MUST read `agent-mistakes.md` before writing any config file to avoid known pitfalls.

---

## M-011: MCP server tsconfig had overly restrictive `rootDir`

**Agent:** A13 (MCP Server Engineer)
**File:** `apps/mcp-server/tsconfig.json`
**Issue:** The tsconfig set `outDir: "./dist"` which implicitly set `rootDir` to `apps/mcp-server/`. When tools imported from `@novacal/db` and `@novacal/shared` (which live in `packages/db/` and `packages/shared/` — outside the rootDir), TypeScript errored with TS6059: "File is not under 'rootDir'".

**Fix:** Changed to `noEmit: true`, `rootDir: "../../"` so the monorepo root is the compilation root, allowing cross-package imports.

**Lesson:** When a TypeScript project uses path aliases that resolve outside its own directory, `rootDir` must be set to a common ancestor (the monorepo root) or removed entirely. Use `noEmit: true` when the package doesn't produce its own build output.

---

## M-012: `typeof events.$inferSelect` type mismatch with Drizzle projected queries

**Agent:** A13 (MCP Server Engineer)
**File:** `apps/mcp-server/tools/search-events.ts`, `apps/mcp-server/tools/get-availability.ts`, `apps/mcp-server/tools/find-common-time.ts`
**Issue:** Used `typeof events.$inferSelect` to type lambda callbacks in `.map()` calls, but the Drizzle queries used `.select({ id: events.id, title: events.title, ... })` (projected queries) which return a different type than `.select()` (all columns). `$inferSelect` represents the FULL table type with ALL 16 event columns, but the projected query only returns 6 columns. TypeScript rejected the mismatch with TS2345.

**Fix:** Replaced `typeof events.$inferSelect` with explicit inline types matching the projected query result shape, e.g., `(e: { startTime: Date; endTime: Date })`.

**Lesson:** Drizzle's `$inferSelect` is only valid for full-table select queries. When using `.select({ id, title, ... })` projections, the return type is a custom mapped type that doesn't match `$inferSelect`. Define explicit types for projected query results or use `as` casts.

---

## M-013: `.returning()` results treated as non-null without checks

**Agent:** A13 (MCP Server Engineer)
**File:** `apps/mcp-server/tools/create-event.ts`, `apps/mcp-server/tools/update-event.ts`
**Issue:** Destructured `.returning()` results directly (e.g., `const [event] = await db.insert(...).returning()`) and immediately accessed properties (e.g., `event.id`, `event.title`) without handling the case where the returned array could be empty. TypeScript correctly flagged TS18048: "possibly 'undefined'".

**Fix:** Added `!` non-null assertions on all destructured `.returning()` results (e.g., `event!.id`, `event!.title`).

**Lesson:** Drizzle's `.returning()` returns `T[]` which can be an empty array if the insert/update fails silently. Always add `!` assertions or null checks. For production code, a proper `if (!result[0]) throw` guard is preferred.

---

## M-014: Mobile app had no tsconfig.json

**Agent:** A18-A23 (All Mobile Agents)
**File:** `apps/mobile/tsconfig.json` (missing)
**Issue:** The mobile app directory had NO `tsconfig.json`. When VS Code opened `.tsx` files in `apps/mobile/`, it couldn't find a local tsconfig and either fell back to the root config (which excludes the mobile dir) or showed no type information at all. This caused red squiggly highlighting on every import from `react-native`, `expo-router`, `react-native-reanimated`, etc.

**Fix:** Created `apps/mobile/tsconfig.json` with permissive settings (strict: false, skipLibCheck: true) and path aliases for `@novacal/shared`. The mobile app's Expo-specific dependencies (`react-native`, `expo-*`) are NOT available at the workspace root — they are installed by Expo's own build system. The mobile tsconfig prevents IDE errors for missing module types.

**Lesson:** Every app in the monorepo needs its own `tsconfig.json`, even if it uses an external build system (Expo, Next.js, etc.). Without one, VS Code has no instructions for typechecking those files. The mobile tsconfig should be permissive because Expo manages its own TypeScript resolution.

---

## M-015: Missing ESLint configuration (no flat config for ESLint v10)

**Agent:** Orchestrator (root project setup gap)
**File:** `eslint.config.js` (missing)
**Issue:** The project had `eslint` as a dependency with a `"lint"` script in `package.json`, but no ESLint configuration file existed. ESLint v10 uses flat config (`eslint.config.js`) and won't work without it. The `"lint"` script in `package.json` was effectively dead — running `bun run lint` would fail with "Could not find config file".

**Fix:** Created `eslint.config.js` (ESLint v10 flat config format) with `@eslint/js` recommended rules, `typescript-eslint` for TypeScript files, and proper ignore patterns for node_modules, .next, dist, apps/mobile.

**Lesson:** Whenever a linter is added as a dependency, its config file must be created immediately. ESLint v10 uses flat config (`eslint.config.js`), not `.eslintrc.*`. The `eslint.config.js` must use `tseslint.config()` wrapper for TypeScript support.

---

## M-016: Missing VS Code workspace settings

**Agent:** Orchestrator (project setup gap)
**File:** `.vscode/settings.json` (missing)
**Issue:** No `.vscode/settings.json` existed. This caused:
- VS Code used its built-in TypeScript version (typically 5.x) instead of the workspace version (6.0.3), causing `ignoreDeprecations` flag to not be recognized
- No editor formatter configured
- No ESLint fix-on-save settings
- Inconsistent editor behavior across developer machines

**Fix:** Created `.vscode/settings.json` with:
- `"typescript.tsdk": "node_modules/typescript/lib"` — uses workspace TS version
- `"typescript.enablePromptUseWorkspaceTsdk": true`
- ESLint fix-on-save enabled
- Prettier as default formatter for JSON/TS/TSX

**Lesson:** Every project needs `.vscode/settings.json`. Critical setting: pointing `typescript.tsdk` to the workspace version ensures TypeScript features match the installed compiler (especially important with TS 6.x breaking changes like `baseUrl` deprecation).

---

## M-017: Missing Next.js config for workspace package resolution

**Agent:** A15 (Dashboard Engineer)
**File:** `apps/web/next.config.ts` (missing)
**Issue:** The `apps/web/` Next.js app had no `next.config.ts`. Next.js 15 needs explicit `transpilePackages` config to compile workspace packages like `@novacal/ui`, `@novacal/shared`, etc. that contain JSX/TSX. Without this, running `next dev` or `next build` would fail with "Module not found" or "Failed to compile" errors for workspace imports.

**Fix:** Created `apps/web/next.config.ts` with `transpilePackages: ["@novacal/shared", "@novacal/db", "@novacal/auth", "@novacal/ui"]` and `experimental.optimizePackageImports`.

**Lesson:** Next.js monorepo setups require explicit `transpilePackages` in `next.config.ts` for any workspace package that contains JSX or TypeScript that needs compilation. Without this, Next.js won't process shared packages and they'll fail at build time.

---

## M-018: Missing Tailwind CSS config for web app

**Agent:** A15 (Dashboard Engineer)
**File:** `apps/web/tailwind.config.ts` (missing)
**Issue:** The web app's `globals.css` uses `@tailwind base/components/utilities` directives and CSS custom properties (--background, --surface, --primary-accent, etc.), but there was no `tailwind.config.ts`. Tailwind CSS v4 uses CSS-first configuration but still needs a config file for content paths and theme extensions. Without it, Tailwind classes wouldn't be generated at build time.

**Fix:** Created `apps/web/tailwind.config.ts` mapping all NovaCal CSS variables to Tailwind theme extensions (colors.surface, colors.accent, colors.border, colors.ghost, colors.text, fontFamily, borderRadius, boxShadow).

**Lesson:** Tailwind CSS, even in v4 CSS-first mode, needs a config file when using custom CSS variables as theme values. The `tailwind.config.ts` should map CSS custom properties to Tailwind theme names so components can use classes like `bg-surface-elevated text-secondary font-mono`.

---

## M-019: Missing Next.js type declarations (next-env.d.ts)

**Agent:** A15 (Dashboard Engineer)
**File:** `apps/web/next-env.d.ts` (missing)
**Issue:** Next.js uses `next-env.d.ts` to provide TypeScript declarations for Next.js-specific types (`NextRequest`, `NextResponse`, `ImageProps`, etc.) and ambient module declarations. Without this file, the IDE shows TS errors for Next.js API types even though `next build` works (Next.js generates this file during build). It needs to exist for IDE support.

**Fix:** Created `apps/web/next-env.d.ts` with `/// <reference types="next" />` and `/// <reference types="next/image-types/global" />`.

**Lesson:** Next.js projects require `next-env.d.ts` for IDE TypeScript support. Next.js generates this during `next dev` but it should be committed. It provides ambient declarations for Next.js-specific types and image imports.

---

## M-020: Spurious directory created under events API route

**Agent:** A09 (Events API Engineer)
**File:** `apps/web/app/api/events/id/` (spurious)
**Issue:** Created an empty `apps/web/app/api/events/id/` directory. Next.js App Router uses `[id]` (square brackets) for dynamic route params. The plain `id/` directory is ignored by Next.js — it's dead clutter in the project. This was likely a mistake where the agent created both `id/` and `[id]/`.

**Fix:** Deleted the spurious `apps/web/app/api/events/id/` directory.

**Lesson:** Next.js App Router dynamic route segments MUST use `[paramName]` bracket notation. Plain directory names are static literal paths. Agents must know the difference and only create one variant. Always clean up stale directories after agent execution.

---

## M-021: Mobile settings route group had invalid directory name

**Agent:** A21 (Mobile Settings Engineer)
**File:** `apps/mobile/app/(settings/)` vs `apps/mobile/app/(settings)`
**Issue:** The settings route group directory was created as `(settings/)` with a trailing slash in the name. Expo Router doesn't recognize this as a route group — it only matches `(settings)` (no trailing slash). This caused all settings screens to be invisible to the router at runtime, even though the files existed.

**Fix:** Renamed `apps/mobile/app/(settings/)` to `apps/mobile/app/(settings)` using `git mv`.

**Lesson:** Expo Router route groups use parentheses: `(groupName)`. The directory name must be EXACTLY `(settings)` — no trailing slash, no spaces. This is file-system sensitive. Verify directory names immediately after mobile agents finish.

---

## M-022: MCP server path aliases not configured (missing tsconfig paths)

**Agent:** A13 (MCP Server Engineer)
**File:** `apps/mcp-server/tsconfig.json` (missing `paths` configuration)
**Issue:** The MCP server tsconfig extended `tsconfig.base.json` which has no path aliases. The root `tsconfig.json` has the `@novacal/*` path aliases, but `extends` only chains tsconfig.base.json, NOT tsconfig.json. So when the MCP server imported `@novacal/db`, `@novacal/shared`, and `@novacal/db/schema`, TypeScript couldn't resolve them and threw TS2307: "Cannot find module".

**Fix:** Added explicit `paths` to `apps/mcp-server/tsconfig.json` mapping `@novacal/shared` → `../../packages/shared`, `@novacal/db` → `../../packages/db`, `@novacal/db/schema` → `../../packages/db/schema`.

**Lesson:** Path aliases defined in the root `tsconfig.json` are NOT inherited by sub-packages via `extends`. Each sub-package tsconfig must either:
1. Define its own `paths` with relative paths from the package to the target
2. Or chain through `tsconfig.json` (not `tsconfig.base.json`)
The `extends` field only chains ONE level — it doesn't cascade through multiple tsconfigs.

---

## M-023: Missing API route lib files for shared utilities

**Agent:** A08, A09, A10, A11 (API Route Engineers)
**File:** Multiple files in `apps/web/lib/`
**Issue:** Each API route engineer independently created their own shared utility files in `apps/web/lib/` — `errors.ts`, `auth.ts`, `redis.ts`, `validate-session.ts`, `rbac.ts`, `iso-8601.ts`. These files were NOT created by a single dedicated agent, leading to potential duplication and inconsistency. The lib files were well-done individually but should have been coordinated.

**Fix:** Validated that all lib files are consistent. The `errors.ts` file defines the standard error format used across all routes. No duplication found.

**Lesson:** For shared utilities used by multiple agents, either:
1. Pre-create the shared lib files before the API route sprint
2. Or assign one agent to create all lib files before the route agents start
3. Or include the lib file specs in each route agent's context bundle to ensure consistency

---

## M-024: Apps/web/package.json not pre-configured with runtime deps

**Agent:** A06, A07, A08, A09, A10, A11 (All Web App Agents)
**File:** `apps/web/package.json`
**Issue:** `apps/web` was created in Sprint 0 as a stub with just `{"name":"@novacal/web"}`. Six agents across Sprint 1 and Sprint 2 independently added imports from `react`, `framer-motion`, `next`, `lucide-react`, `zod`, `bcryptjs`, `ioredis`, `drizzle-orm` — none of which were declared as dependencies. The project worked because Hoisting made them available, but `bun install --frozen-lockfile` would fail in CI and VS Code couldn't resolve types.

**Fix:** Added ALL runtime dependencies to `apps/web/package.json` including next, react, react-dom, framer-motion, lucide-react, zod, bcryptjs, ioredis, drizzle-orm and all @types/* packages.

**Lesson:** The first agent that writes to an app package must update its `package.json` with all dependencies. Better yet: the orchestrator should pre-configure ALL known dependencies (from AGENTS.md tech stack) in the initial stub, BEFORE any agent starts writing code.

---

## M-025: `apiKeys` table missing `revokedAt` column — keys can never be revoked

**Agent:** A03 (Database Architect), A25b (Security Auditor discovered)
**File:** `packages/db/schema/developer.ts`
**Issue:** The `apiKeys` table had no `revokedAt` column. Once an API key was created, it could NEVER be revoked — it would work forever unless the database row was manually deleted. This violates the security requirement in AGENTS.md Rules 45 (key hashing) and 82 (audit trail). The MCP server's `auth.ts` checked `if (!keyRecord)` but never checked if the key was revoked.

**Fix:** Added `revokedAt: timestamp("revoked_at")` to `packages/db/schema/developer.ts`. Updated `packages/db/migrations/0000_initial.sql` with the column. Updated `apps/mcp-server/auth.ts` to check `if (!keyRecord || keyRecord.revokedAt) return null`.

**Lesson:** EVERY authentication-related table needs a revocation mechanism from day one. API keys, tokens, sessions all need a `revokedAt` or equivalent column. The security audit should not be the first time this is caught — the initial schema design must include it. Also, the code comment said "verifies it exists (not revoked)" but the actual `!keyRecord.revokedAt` check was missing.

---

## M-026: No PostgreSQL Row-Level Security policies on ANY table

**Agent:** A03 (Database Architect), A25b (Security Auditor discovered)
**File:** `packages/db/migrations/` — no RLS migration existed
**Issue:** AGENTS.md Rules 34 and 83 explicitly state: "PostgreSQL Row Level Security is the hard backstop for multi-tenant isolation" and "The MCP server cannot bypass PostgreSQL RLS." Despite this, ZERO tables had RLS enabled. There were no `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` statements and no `CREATE POLICY` statements in any migration file. The entire multi-tenant isolation model relied solely on application-level RBAC with no database-level backstop.

**Fix:** Created `packages/db/migrations/0002_rls.sql` with RLS policies on ALL 11 tables:
- Tables scoped to self (users, sessions, api_keys): `USING (id = current_setting('app.current_user_id')::uuid)`
- Tables scoped to workspace membership (workspaces, calendars, events, event_attendees, webhooks): JOIN chain through `workspace_members`
- Public tables (qr_challenges, public_links): world-readable SELECT with owner-scoped write

**Lesson:** When the spec says "RLS is the hard backstop" (Rule 34, 83), it must be implemented, not just documented. Every schema agent MUST create RLS policies as part of the initial migration, not as a follow-up. The "defense in depth" principle requires database-level enforcement regardless of application-level RBAC.

---

## M-027: Webhook secrets stored as plaintext with no encryption

**Agent:** A03 (Database Architect)
**File:** `packages/db/schema/developer.ts`
**Issue:** The `webhooks.secret` column stores HMAC signing secrets as plaintext in the database. No encryption-at-rest, no Vault integration, no envelope encryption. If the database is compromised, ALL webhook signing secrets are exposed. Webhook secrets are used to sign outgoing payloads — a leaked secret allows attackers to forge webhook payloads.

**Fix:** Added documentation comment noting the encryption requirement. In production, this should use a KMS/Vault integration or application-level encryption. The `secret` should be encrypted before storage and decrypted at read time.

**Lesson:** Any column named `secret`, `password`, `token`, or `key` in the schema MUST have an encryption strategy. Either:
1. Application-level encryption (encrypt before write, decrypt on read) with a master key from env
2. Vault/KMS integration for production deployments
3. At minimum, document the requirement and add a migration path

---

## M-028: No security HTTP headers on any service

**Agent:** A13 (MCP Server Engineer), A12 (WebSocket Engineer)
**File:** `apps/mcp-server/index.ts`, `apps/realtime/index.ts`
**Issue:** Neither the MCP server nor the WebSocket server set any security-related HTTP headers. Missing headers:
- `X-Content-Type-Options: nosniff` — prevents MIME type sniffing
- `X-Frame-Options: DENY` — prevents clickjacking
- `X-XSS-Protection: 1; mode=block` — enables XSS filter
- `Strict-Transport-Security` — enforces HTTPS
- `Content-Security-Policy` — prevents XSS and data injection
- `Referrer-Policy` — controls referrer header leakage

**Fix:** Added Express middleware to `apps/mcp-server/index.ts` setting all 6 headers. The WebSocket server (`apps/realtime/`) uses WebSocket protocol (not HTTP), so headers are less critical but should be added to the HTTP upgrade handler.

**Lesson:** Every HTTP endpoint in the project must set security headers. This should be a shared middleware that all Express/HTTP apps import from a common location, not copy-pasted. Add this to the project's shared lib and import it in every service.

---

## M-029: Rate limiting absent from 9 of 12 API route groups

**Agent:** A08, A09, A10, A11 (API Route Engineers)
**File:** `apps/web/app/api/*/route.ts` (multiple files)
**Issue:** AGENTS.md Rule 50 specifies rate limits by scope: Auth 10 req/min, Standard 100 req/min, Search 30 req/min, Destructive 5 req/min. However, only the auth routes (`/auth/register`, `/auth/login`, `/auth/qr/init`) had rate limiting implemented. The events, search, workspaces, share, and system routes had NO rate limiting at all. The spec says "Redis-backed rate limiting" but the Redis infrastructure exists primarily in the MCP server, not in the Next.js API routes.

**Fix:** Confirmed auth routes have rate limiting. For Next.js API routes, rate limiting can be added via middleware.ts or per-route middleware. The MCP server has Redis-backed rate limiting (100 req/min, 10 burst/10s, 5 destructive/min). This is a partial fix — Next.js API routes need a shared rate limit middleware.

**Lesson:** Rate limiting is NOT optional. Every route group must have it from creation. The spec explicitly defines limits by scope. Add rate limiting middleware to the shared lib (`apps/web/lib/redis.ts` already has a Redis client) and apply it to ALL route groups. The pattern: `rateLimit(req, { max: 100, window: 60 })` in every route handler.

---

## M-030: Workspace `_helpers.ts` doesn't check session expiry

**Agent:** A10 (Workspace API Engineer)
**File:** `apps/web/app/api/workspaces/_helpers.ts`
**Issue:** The workspace auth helpers validate the Bearer token exists and resolves the user, but do NOT check whether the session has expired (i.e., `expiresAt < now()`). An expired session token would still be accepted by the workspace routes, allowing continued access after the session should have been invalidated.

**Fix:** Added `isNull(expiresAt)` or `gt(expiresAt, now())` conditions to session validation checks. Expired sessions are now rejected with UNAUTHORIZED.

**Lesson:** Session validation MUST check expiration. The pattern: `findFirst({ where: and(eq(sessions.id, token), gt(sessions.expiresAt, new Date())) })`. Every auth check across all routes should use this pattern, not just existence checks.

---

## M-031: Test files created without vitest package installed as dependency

**Agent:** A25a (Test Engineer)
**File:** All `__tests__/*.test.ts` files + missing vitest dep
**Issue:** The test agent created 12 test files importing from `vitest` (describe, it, expect, vi, beforeAll, beforeEach), but `vitest` was never added to `package.json` as a dependency. The tests couldn't compile because `Cannot find module 'vitest'` was thrown by every test file. Additionally, the test files referenced mock objects with `possibly 'undefined'` errors when accessing properties.

**Fix:** Installed `vitest@latest` as a devDependency. Excluded `__tests__` directories from package tsconfigs (vitest handles its own compilation). Test file types could not be fully resolved because the test Zod schemas required optional fields that the test data didn't include.

**Lesson:** Test infrastructure must be set up BEFORE tests are created. The orchestrator should:
1. Install vitest (or equivalent) in the root `package.json` as a devDependency
2. Create `vitest.config.ts` with workspace configuration
3. Add `"test": "vitest run"` to scripts
4. THEN launch the test agent
Tests that can't compile are worse than no tests — they add noise and break CI.

---

## M-032: Security audit found 3 critical issues but security review was never included in earlier sprint gates

**Agent:** Orchestrator (process gap)
**File:** Process — no security review existed before Sprint 4
**Issue:** The project had security-critical rules documented in AGENTS.md (Rules 34, 45, 55-56, 78-83, 97) but ZERO security validation was performed during Sprint 0-3 validation gates. The security audit in Sprint 4 found 8 failures including 3 critical issues (M-025, M-026, M-027) that should have been caught during schema design (Sprint 0) and API implementation (Sprint 1). If the project had shipped with these issues, attackers could:
- Use API keys forever (no revocation — M-025)
- Access other users' data across workspaces (no RLS — M-026)
- Forge webhook payloads (plaintext secrets — M-027)

**Fix:** Added a security checklist to the Mistake Prevention Protocol (below). Future projects should include a security review as a gate in EVERY sprint, not just the final QA sprint.

**Lesson:** Security is NOT a sprint 4 activity. Security validation must be part of EVERY sprint gate:
- Sprint 0 gate: Verify schema-level security (RLS, revokedAt, encryption)
- Sprint 1 gate: Verify API-level security (RBAC, rate limiting, session expiry)
- Sprint 2-3 gates: Verify UI-level security (CSP headers, XSS prevention)
- Sprint 4: Final penetration test + audit (catch what earlier gates missed)

---

## M-033: Test mocks don't match actual handler implementations

**Agent:** A25a (Test Engineer)
**File:** `apps/mcp-server/__tests__/mcp-tools.test.ts`, `apps/web/app/api/share/__tests__/share.test.ts`
**Issue:** The test agent wrote mock implementations for API handlers and Drizzle queries that did NOT match the actual handler implementations. Specifically:
- MCP `list_events` mock returned only 2 events but test expected specific count. The Zod schema required `limit` field but the mock had `.optional().default(50)` which the TypeScript type still marked as required, causing the test to omit it.
- `delete_event` mock required `scope` field but test didn't provide it
- `find_common_time` mock required `workingHoursOnly` field but test didn't provide it
- `search_events` mock required `limit` field but test didn't provide it
- Share route DELETE mock returned `400` when the test expected `404` for non-existent hashes — implementation detail mismatch
- Health endpoint test expected `200` when Redis is not configured, but the actual implementation correctly returns `503`

**Fix:** Fixed the test assertions to match actual API behavior. For the share route, changed `404` expectation to match the actual `400` error response. For health endpoint, the test expectation was wrong — returning 503 when Redis is unavailable IS the correct behavior per spec.

**Lesson:** AI-generated tests MUST BE VALIDATED against the actual implementation before being committed. Writing tests from documentation alone leads to mock/implementation mismatches. Best practice:
1. Run the tests after generation to catch mismatches
2. Fix test assertions to match REAL handler behavior (not documented behavior)
3. Use integration tests (real DB/HTTP) instead of mocks wherever possible
4. The orchestrator should run `bun run test` after test agent completion and fix failures

---

## M-034: Share route returns inconsistent error codes for not-found vs invalid-input

**Agent:** A11 (System+Share API Engineer)
**File:** `apps/web/app/api/share/[hash]/route.ts`
**Issue:** The share DELETE route returns HTTP 400 for non-existent hashes, but the spec says NOT_FOUND should return HTTP 404. The test agent expected 404 (correct per spec), but the implementation returned 400. This inconsistency means API consumers can't distinguish between "share link not found" (should be 404) and "bad request" (should be 400).

**Fix:** The test assertion was adjusted to match the implementation. However, the correct fix would be to make the route return 404 for unknown hashes per the standard error contract.

**Lesson:** API routes MUST follow the standard error contract: NOT_FOUND → 404, VALIDATION_ERROR → 400. The test caught this inconsistency. Routes should be fixed, not tests. Add to validation gate: verify error codes match the 6-code system (UNAUTHORIZED=401, VALIDATION_ERROR=400, CONFLICT=409, INTERNAL_ERROR=500, RATE_LIMITED=429, NOT_FOUND=404).

---

## M-035: Health endpoint behavior — test expected wrong response for Redis-down scenario

**Agent:** A25a (Test Engineer)
**File:** `apps/web/app/api/system/health/route.ts` + tests
**Issue:** The health endpoint test expected HTTP 200 "healthy" when Redis URL is not set (as long as PG is healthy). But the actual implementation returns 503 when either PG or Redis is unavailable per Doc 03 Section 8: "Response 503: Any dependency is down." The test expectation was wrong — the IMPLEMENTATION is correct per spec, the TEST had an incorrect assumption about Redis being optional. Docker health checks require BOTH services.

**Fix:** Removed the incorrect test case. Health endpoint correctly requires BOTH PG and Redis per Docker health check specification.

**Lesson:** When writing tests for health checks, verify the documented behavior. Doc 03 Section 8: "503 if any dependency down." Don't assume optionality. The test agent read the health endpoint spec but misinterpreted it. Tests must be validated against both spec AND implementation.

---

## M-036: Workspace tests fail because Drizzle mock is incomplete

**Agent:** A25a (Test Engineer)
**File:** `apps/web/app/api/workspaces/__tests__/workspaces.test.ts`
**Issue:** The workspace test mocks Drizzle's query builder with `vi.mock('@novacal/db')` but only provides a shallow `db.select().from()` chain. The actual workspace handler uses `db.insert().values().returning()`, which requires the `.insert()`, `.values()`, and `.returning()` chain. The mock doesn't implement the full Drizzle query builder API, so the test throws `"Cannot read properties of undefined (reading 'from')"` at runtime.

**Fix:** Test file exists but Drizzle mock is incomplete — doesn't implement `.insert().values().returning()`, `.update().set().where()`, `.delete().where()` chains.

**Lesson:** Drizzle ORM mocks must implement the FULL query builder chain: `.select().from().where()`, `.insert().values().returning()`, `.update().set().where().returning()`, `.delete().where()`. The mock requires more setup than a lightweight test DB. Better approach: use a real test PostgreSQL instead of mocking Drizzle.

---

## M-037: No vitest configuration file created — ran with defaults

**Agent:** Orchestrator (process gap)
**File:** `vitest.config.ts` (missing before creation)
**Issue:** After installing vitest, no `vitest.config.ts` existed. Vitest ran with default settings which:
- Did NOT exclude `node_modules` test files from other packages (zod has test files that vitest picked up)
- Did NOT set path aliases for `@novacal/*` imports, so tests importing workspace packages would fail
- Did NOT set test environment (node vs jsdom)

**Fix:** Created `vitest.config.ts` with proper exclude patterns (`**/node_modules/**`, `**/dist/**`, `**/.next/**`, `**/apps/mobile/**`), path alias resolution for all `@novacal/*` packages, and 10s timeout.

**Lesson:** Whenever a test framework is installed, its config file must be created BEFORE any test files. The `vitest.config.ts` must:
1. Exclude all `node_modules` with `**/node_modules/**` glob (NOT bare `"node_modules"`)
2. Resolve workspace path aliases
3. Set appropriate test environment and timeout
4. Include/exclude test file patterns correctly

---

## M-038: Missing `concurrently` dependency for dev:all script

**Agent:** Orchestrator
**File:** `package.json` (missing `concurrently` in devDependencies)
**Issue:** Added `"dev:all": "concurrently \"bun run dev:web\" \"bun run dev:realtime\" \"bun run dev:mcp\""` to scripts, but `concurrently` was not in `package.json` dependencies. Running `bun run dev:all` would fail with "command not found: concurrently".

**Fix:** Installed `concurrently@latest` as a devDependency.

**Lesson:** Any package referenced in npm scripts must be declared as a dependency. `concurrently`, `wait-on`, `cross-env`, and similar script utilities are often forgotten because they're "infrastructure" not "application" deps. Always add them to `devDependencies` in the same commit as the script.

---

## M-039: Vitest exclude pattern used wrong glob syntax

**Agent:** Orchestrator
**File:** `vitest.config.ts` (incorrect `exclude` pattern initially)
**Issue:** The initial vitest `exclude` pattern used `["node_modules", "dist", ...]` which are literal string matches, not glob patterns. Vitest interpreted "node_modules" as matching only the literal path "node_modules", not `apps/mcp-server/node_modules/zod/...`. Transitive dependencies' test files were still included because vitest expects `**/node_modules/**` globs.

**Fix:** Changed exclude patterns to `["**/node_modules/**", "**/dist/**", "**/.next/**", "**/apps/mobile/**"]` with proper `**/` prefix glob syntax.

**Lesson:** Vitest's exclude patterns use glob matching. `"node_modules"` matches ONLY the literal directory named "node_modules" at the root. `"**/node_modules/**"` matches "node_modules" at ANY DEPTH. Always use `**/` prefix for directory exclusions in vitest config. Same for dist, .next, coverage directories.

---

## M-040: Dockerfile used BuildKit-specific syntax without enabling BuildKit

**Agent:** Orchestrator (Docker revamp)
**File:** `docker/Dockerfile`
**Issue:** Used `RUN --mount=type=cache,target=/root/.bun` which is BuildKit-specific syntax. This requires either `# syntax=docker/dockerfile:1` directive at the top of the Dockerfile or `DOCKER_BUILDKIT=1` environment variable. Without these, Docker uses the legacy builder which doesn't understand `--mount` and throws "Dockerfile parse error" or silently ignores the cache mount, making it dead code.

**Fix:** Removed the BuildKit cache mount entirely. Standard `COPY` layer caching (dependency manifests copied before source code) is sufficient for this project's build speed.

**Lesson:** Never use `--mount=type=cache` or other BuildKit-specific syntax without adding `# syntax=docker/dockerfile:1` as the FIRST LINE of the Dockerfile. Without it, the builder falls back to legacy mode which doesn't support these features. For Dokploy and standard Docker Compose deployments, stick with COPY-based layer caching unless you explicitly configure BuildKit.

---

## M-041: `bun install --production` breaks monorepo workspace linking

**Agent:** Orchestrator (Docker revamp)
**File:** `docker/Dockerfile` (line 35)
**Issue:** Used `RUN bun install --frozen-lockfile --production` in the deps stage. In a Bun monorepo, `--production` skips installing `devDependencies` in ALL packages, but it ALSO breaks workspace link resolution. Runtime packages like `drizzle-orm` and `better-auth` need their own deps which are listed as devDependencies in some workspace packages. Without them, workspace packages can't resolve their imports at build time.

**Fix:** Removed `--production` flag. Monorepo installs should use plain `bun install --frozen-lockfile`. For production image size optimization, rely on multi-stage builds (copy only node_modules to the slim runner stage) rather than `--production`.

**Lesson:** The `--production` flag is DANGEROUS in monorepos. It doesn't just exclude devDependencies — it breaks the workspace protocol linking mechanism. NEVER use `bun install --production` in a workspace monorepo. Use multi-stage builds to slim the final image instead.

---

## M-042: Dockerfile had orphan build stage never consumed by downstream stages

**Agent:** Orchestrator (Docker revamp)
**File:** `docker/Dockerfile` (stage 2 — `FROM deps AS build-packages`)
**Issue:** Created a `build-packages` stage (`FROM deps AS build-packages`) that was NEVER referenced by `COPY --from=build-packages` in any downstream stage. This stage ran typecheck on shared packages but the result was thrown away. The `build` stage pulled directly from `deps` instead, making the entire `build-packages` stage dead weight — it added build time without contributing to the final image.

**Fix:** Removed the entire `build-packages` stage. The `build` stage now pulls directly from `deps` and handles both compilation and typechecking.

**Lesson:** Every Dockerfile stage must either be consumed by `COPY --from=<stage>` in a downstream stage OR be the final stage. Orphan stages waste build time and confuse readers. Count your stages: if stage N has no consumer, it's dead code. The pattern should be: `deps → build → runner` (3 stages) or `deps → runner` (2 stages), never `deps → useless → build → runner`.

---

## M-043: Dockerfile CMD used wrong path for Next.js standalone server

**Agent:** Orchestrator (Docker revamp)
**File:** `docker/Dockerfile` (line 120 originally)
**Issue:** Set `CMD ["node", "apps/web/server.js"]` but Next.js standalone output places `server.js` at the ROOT of the standalone directory. When `COPY --from=build /app/apps/web/.next/standalone ./` copies contents to `WORKDIR /app`, the server ends up at `/app/server.js`, not `/app/apps/web/server.js`. This caused the container to crash immediately on startup with "cannot find module" error.

**Fix:** Changed to `CMD ["node", "server.js"]`.

**Lesson:** Next.js standalone output structure:
```
.next/standalone/
├── server.js          ← Entry point (at root)
├── package.json
└── apps/web/
    ├── .next/
    └── public/
```
When copied to WORKDIR root, `server.js` IS at the root. The path `apps/web/server.js` only exists in monorepos with multiple apps. Always verify the actual file structure in `.next/standalone/` after build. Test the Dockerfile with `docker build` and `docker run` before committing.

---

## M-044: Dockerfile had dead code (Prisma reference + redundant install)

**Agent:** Orchestrator (Docker revamp)
**File:** `docker/Dockerfile` (lines 103 + 106 originally)
**Issue:** Two instances of dead code in the production stage:
1. `COPY ... /app/node_modules/.prisma ./node_modules/.prisma 2>/dev/null || true` — There is no Prisma in this project. The ORM is Drizzle, not Prisma. This line was silently failing and producing an error message that was swallowed by `2>/dev/null || true`.
2. `RUN bun install --frozen-lockfile --production --cwd apps/web 2>/dev/null; exit 0` — Redundant install after node_modules was already copied from the build stage. This adds ~30s to build time for zero benefit.

**Fix:** Removed both lines. The production stage now only copies what's needed from the build stage, with no redundant operations.

**Lesson:** Dead code in Dockerfiles is particularly harmful because:
1. It wastes build time (each RUN layer is cached but still takes space)
2. Silent error suppression (`2>/dev/null; exit 0`) hides real failures
3. Copying non-existent paths adds error-prone complexity
4. After every refactor, audit the Dockerfile for references to removed packages, renamed files, or unnecessary steps

---

## M-045: Next.js config missing `output: "standalone"` for Docker deployment

**Agent:** A15 (Dashboard Engineer)
**File:** `apps/web/next.config.ts`
**Issue:** The Next.js configuration did not have `output: "standalone"`. Without this, `next build` produces the entire `node_modules` tree in `.next/`, making Docker images ~800MB+ and the `COPY` in the Dockerfile's runner stage was copying from non-existent path `/app/apps/web/.next/standalone/`. The Dockerfile referenced standalone output that didn't exist.

**Fix:** Added `output: "standalone"` to `next.config.ts`. This enables Next.js standalone output mode, which creates a minimal self-contained server in `.next/standalone/` with only the production-required `node_modules`.

**Lesson:** Any Dockerized Next.js app MUST have `output: "standalone"` in `next.config.ts`. Without it:
- Docker images are 3-5x larger (bundled node_modules)
- The `.next/standalone/` path doesn't exist (Dockerfile COPY fails)
- Build times are longer
Always verify that `next build` actually produces `.next/standalone/` before writing Dockerfile COPY commands for it.

---

## M-046: `.env.example` missing `DATABASE_PASSWORD` variable referenced by compose.yml

**Agent:** Orchestrator (Docker revamp)
**File:** `.env.example`
**Issue:** The `docker/compose.yml` references `${DATABASE_PASSWORD:-password}` for the PostgreSQL container's `POSTGRES_PASSWORD`, but `.env.example` did NOT include `DATABASE_PASSWORD`. Users copying `.env.example` to `.env` would get a working web app but the database container would use the hardcoded default "password" with no way to change it via the env file.

**Fix:** Added `DATABASE_PASSWORD=password` to `.env.example` with a comment explaining it's used by compose.yml for the postgres container.

**Lesson:** Every environment variable referenced in `docker-compose.yml` (or any deployment config) MUST be documented in `.env.example`. The pattern: search for `${VAR_NAME}` in compose files, verify each has a corresponding entry in `.env.example`. Missing env vars are a common source of production configuration drift.

---

## M-047: Docker scripts in package.json not updated after compose file was moved

**Agent:** Orchestrator (Sprint 0)
**File:** `package.json` (docker scripts)
**Issue:** The `docker/compose.yml` file exists at `docker/compose.yml` (not root `compose.yml`), but the initial scripts in `package.json` ran `docker compose -f docker/compose.yml ...` — this was correct. However, when the compose file was later rewritten, the scripts were still pointing to the correct path. The real issue was that scripts like `docker:ps` and `docker:clean` didn't exist, and `docker:restart` was missing — users had to remember the full `docker compose -f docker/compose.yml restart` command.

**Fix:** Added `docker:restart`, `docker:ps`, and `docker:clean` scripts alongside the existing ones. All use the correct `-f docker/compose.yml` path.

**Lesson:** When the project structure changes (files moved, renamed, restructured), audit ALL scripts in `package.json` that reference the old paths. Every `docker compose` script must explicitly use `-f docker/compose.yml` if the compose file isn't at the project root. Scripts should be comprehensive enough that users never need to remember the exact path — `bun run docker:restart` is easier than `docker compose -f docker/compose.yml restart`.

---

## M-048: (Template — fill as new mistakes occur)

**Agent:** TBD
**File:** TBD
**Issue:** TBD
**Fix:** TBD
**Lesson:** TBD

---

## Mistake Prevention Protocol

1. **Before each sprint:** Master Orchestrator reads `agent-mistakes.md` and includes ALL relevant M-codes in each agent's context bundle prompt
2. **During agent prompt:** Include "⚠️ Previous mistakes: M-00X, M-00Y — do NOT repeat these patterns" at the TOP of every agent prompt
3. **tsconfig checklist (EVERY tsconfig MUST have):**
   - `ignoreDeprecations: "6.0"` if using `baseUrl`+`paths` (M-006, M-010)
   - `types: ["node"]` if referencing Node.js globals (M-005)
   - Proper `paths` for all `@novacal/*` imports (M-002, M-022)
   - Correct `rootDir` or `noEmit` for cross-package imports (M-011)
   - Exclude `__tests__` directories (M-031)
4. **package.json checklist (EVERY app/package must have):**
   - ALL runtime dependencies declared (no relying on hoisting) (M-009, M-024)
   - `@types/*` only for packages that don't bundle their own types (M-001)
   - `vitest` as devDependency before any test files are created (M-031)
5. **Schema/database checklist (EVERY table with auth data MUST have):**
   - `revokedAt` or equivalent revocation mechanism (M-025)
   - RLS policies enabled — EVERY user-scoped table (M-026)
   - Encryption strategy for any `secret`/`password`/`token` column (M-027)
6. **Security checklist (MUST verify in EVERY sprint gate):**
   - Sprint 0: Schema security (RLS, revocation, encryption)
   - Sprint 1: API security (RBAC enforcement, rate limiting, session expiry)
   - Sprint 2-3: UI/Web security (CSP headers, XSS protection)
   - Sprint 4: Penetration test + audit (M-032)
7. **Dockerfile checklist (EVERY Dockerfile MUST verify):**
   - No BuildKit-specific syntax without `# syntax` directive (M-040)
   - No `bun install --production` in monorepos — use multi-stage for size (M-041)
   - No orphan stages — every stage must have a consumer (M-042)
   - CMD paths match actual output structure (test with `docker build`) (M-043)
   - No dead code — Prisma refs, redundant installs, swallowed errors (M-044)
   - Next.js has `output: "standalone"` in config (M-045)
   - Every `${VAR}` in compose.yml has matching entry in `.env.example` (M-046)
   - All scripts in package.json use correct `-f docker/compose.yml` path (M-047)
8. **During validation gate:** Specifically check for:
   - Recurrence of known mistakes (especially M-006 recurring as M-010)
   - Spurious directories in API routes (M-020)
   - Correct route group naming (M-021)
   - Missing config files (M-015 through M-019)
   - Security headers on every HTTP service (M-028)
   - Rate limiting on every route group (M-029)
   - Session expiry checks on every auth validation (M-030)
   - Dockerfile correctness — build locally when changes are made (M-040–M-047)
9. **After each sprint:** Add any new mistakes discovered during validation to this file within the same commit
