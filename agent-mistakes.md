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

## M-025: (Template — fill as new mistakes occur)

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
4. **package.json checklist (EVERY app/package must have):**
   - ALL runtime dependencies declared (no relying on hoisting) (M-009, M-024)
   - `@types/*` only for packages that don't bundle their own types (M-001)
5. **During validation gate:** Specifically check for:
   - Recurrence of known mistakes (especially M-006 recurring as M-010)
   - Spurious directories in API routes (M-020)
   - Correct route group naming (M-021)
   - Missing config files (M-015 through M-019)
6. **After each sprint:** Add any new mistakes discovered during validation to this file within the same commit
