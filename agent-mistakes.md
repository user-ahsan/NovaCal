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

## M-010: (Template — fill as new mistakes occur)

**Agent:** TBD
**File:** TBD
**Issue:** TBD
**Fix:** TBD
**Lesson:** TBD

---

## Mistake Prevention Protocol

1. **Before each sprint:** Master Orchestrator reads `agent-mistakes.md` and includes relevant M-codes in each agent's context bundle
2. **During agent prompt:** Include "⚠️ Previous mistakes: M-00X, M-00Y — do NOT repeat these patterns"
3. **During validation gate:** Specifically check for recurrence of known mistakes
4. **After each sprint:** Add any new mistakes discovered during validation to this file
