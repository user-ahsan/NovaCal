# 🔒 NovaCal Security Audit Report

**Auditor:** Agent A25b (Security Auditor)
**Date:** 2026-05-10
**Scope:** Full codebase audit — schema definitions, API routes, MCP server, realtime server, Web UI components, migrations, config files

---

## Executive Summary

| Status | Count |
|--------|-------|
| **PASS** | 8 |
| **FAIL** | 8 |
| **NOT_FOUND** | 2 (N/A) |
| **Total Items** | 18 |

**Risk Distribution:**
| Severity | Count |
|----------|-------|
| CRITICAL | 3 |
| HIGH | 4 |
| MEDIUM | 3 |
| LOW | 2 |

**Overall Assessment:** The codebase has strong architectural security intent documented in AGENTS.md, but several critical controls are **not implemented** in code. Most notably: PostgreSQL Row Level Security (RLS) is entirely absent despite being named the "hard backstop" (Rule 83), API key revocation is broken due to a missing database column, security headers are absent from all services, and rate limiting is inconsistently applied. These need to be addressed before production deployment.

---

## Detailed Findings

### 1. [CRITICAL] API Keys Table Missing `revokedAt` Column

**Status:** FAIL
**Evidence:**
- `packages/db/schema/developer.ts:12-15` — Schema defines: `id`, `userId`, `name`, `keyHash`, `lastUsedAt`, `createdAt` — **NO `revokedAt` field**
- `packages/db/migrations/0000_initial.sql:114-121` — Migration creates `api_keys` table with same columns — **NO `revokedAt`**
- `apps/mcp-server/auth.ts:54-55` — Auth code does NOT check for revocation (cannot — column doesn't exist)
- `docs/04-mcp-server-implementation.md:418` — Doc references `apiKey.revokedAt` that does not exist in schema or migration
- `apps/web/app/\(developer\)/api-keys/page.tsx:99-108` — UI has revoke functionality with `handleRevoke` but no backend `/api/v1/api-keys/:id` DELETE endpoint exists to actually revoke keys in the database

**Impact:** API keys can NEVER be revoked. Once created, they remain valid forever. If a key is leaked, there is no way to invalidate it.

**Recommended Fix:** 
1. Add `revokedAt: timestamp("revoked_at")` column to `apiKeys` table schema in `packages/db/schema/developer.ts`
2. Create migration: `ALTER TABLE api_keys ADD COLUMN revoked_at timestamptz;`
3. Add revocation check in `apps/mcp-server/auth.ts` after the `keyRecord` fetch:
   ```typescript
   if (keyRecord.revokedAt) {
     return null;
   }
   ```
4. Create `/api/v1/api-keys/:id` DELETE endpoint that sets `revokedAt` instead of deleting

---

### 2. [CRITICAL] No PostgreSQL Row Level Security (RLS) Policies

**Status:** FAIL
**Evidence:**
- `packages/db/migrations/0000_initial.sql:1-143` — Creates all 11 tables with foreign keys but **NO `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`** statements
- `packages/db/migrations/0001_indexes.sql:1-34` — Index-only migration, no RLS
- `AGENTS.md Rule 34`: "RLS-ready foreign keys. PostgreSQL Row Level Security is the hard backstop for multi-tenant isolation."
- `AGENTS.md Rule 83`: "The MCP server cannot bypass PostgreSQL RLS. All queries go through the authenticated user's context. RLS is the hard backstop."
- `docs/04-mcp-server-implementation.md:483`: "The MCP server cannot bypass PostgreSQL Row Level Security (RLS). All queries go through the authenticated user's context, and RLS policies apply at the database level as a hard backstop."

**Impact:** Application-level RBAC is the ONLY access control. There is no database-level defense. A compromised API key or SQL injection vulnerability could access ANY user's data across all workspaces. The "hard backstop" referenced in rules does not exist.

**Recommended Fix:**
Create a migration `0002_rls.sql` with:
```sql
-- Enable RLS on all user-scoped tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_links ENABLE ROW LEVEL SECURITY;

-- Users can only see their own record
CREATE POLICY user_isolation ON users
  USING (id = current_setting('app.current_user_id')::uuid);

-- Events visible only if user is in the workspace
CREATE POLICY event_workspace_isolation ON events
  USING (
    calendar_id IN (
      SELECT id FROM calendars WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = current_setting('app.current_user_id')::uuid
      )
    )
  );

-- ... additional policies for each table
```

---

### 3. [CRITICAL] Webhook Secrets Stored as Plaintext

**Status:** FAIL
**Evidence:**
- `packages/db/schema/developer.ts:23-24`: `secret: text("secret").notNull(), // HMAC signing secret` — Stored as plain text, no hashing or encryption
- `packages/db/migrations/0000_initial.sql:127`: `secret text NOT NULL, -- HMAC signing secret`

**Impact:** If the database is compromised, all webhook HMAC signing secrets are exposed in plaintext. Attackers could forge webhook payloads to external services (n8n, Zapier, etc.) or impersonate NovaCal to downstream systems.

**Recommended Fix:**
1. Encrypt webhook secrets at rest using an application-level encryption key (e.g., AES-256-GCM with a key derived from an env var `WEBHOOK_ENCRYPTION_KEY`)
2. Decrypt at runtime when computing HMAC signatures
3. Or use a separate hashed field for verification (though HMAC requires the plaintext secret)

---

### 4. [HIGH] No Security Headers on Any Service

**Status:** FAIL
**Evidence:**
- **MCP Server** (`apps/mcp-server/index.ts:207-208`): Only sets `express.json()`, no helmet, no CORS, no security headers
- **Realtime Server** (`apps/realtime/index.ts:28-31`): HTTP health check has no security headers
- **Web App** (`apps/web/app/layout.tsx:61-83`): Root layout has no `<meta>` or headers for security
- **Next.js API routes**: No middleware setting security headers
- Grep for `Access-Control-Allow-Origin`, `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy` — all returned **zero results** across the entire codebase

**Impact:** Missing security headers expose the application to:
- Clickjacking attacks (no X-Frame-Options: DENY)
- MIME-type sniffing vulnerabilities (no X-Content-Type-Options: nosniff)
- XSS via inline scripts/styles (no Content-Security-Policy)
- Cross-origin data leakage (no CORS configuration)

**Recommended Fix:**
1. **MCP/Realtime Server:** Add helmet middleware:
   ```typescript
   import helmet from "helmet";
   app.use(helmet());
   ```
2. **Next.js:** Create a `middleware.ts` in `apps/web/`:
   ```typescript
   import { NextResponse } from "next/server";
   export function middleware() {
     const response = NextResponse.next();
     response.headers.set("X-Content-Type-Options", "nosniff");
     response.headers.set("X-Frame-Options", "DENY");
     response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
     response.headers.set("X-XSS-Protection", "0"); // Deprecated but defense in depth
     return response;
   }
   ```

---

### 5. [HIGH] Inconsistent Rate Limiting — Most API Routes Unprotected

**Status:** FAIL
**Evidence:**
| Route | Rate Limited? | Method | File |
|-------|--------------|--------|------|
| `POST /api/auth/login` | ✅ 10/min per IP | Redis `checkRateLimit(ip, 10, 60)` | `apps/web/app/api/auth/login/route.ts:28` |
| `POST /api/auth/register` | ✅ 10/min per IP | Redis `checkRateLimit(ip, 10, 60)` | `apps/web/app/api/auth/register/route.ts:29` |
| `POST /api/auth/qr/init` | ✅ 10/min per IP | Redis `checkRateLimit(ip, 10, 60)` | `apps/web/app/api/auth/qr/init/route.ts:27` |
| `POST /api/auth/qr/approve` | ❌ No rate limit | — | `apps/web/app/api/auth/qr/approve/route.ts` |
| `POST /api/auth/logout` | ❌ No rate limit | — | `apps/web/app/api/auth/logout/route.ts` |
| `GET/POST /api/events` | ❌ No rate limit | — | `apps/web/app/api/events/route.ts` |
| `GET/PATCH/DELETE /api/events/:id` | ❌ No rate limit | — | `apps/web/app/api/events/[id]/route.ts` |
| `GET /api/search` | ❌ No rate limit | — | `apps/web/app/api/search/route.ts` |
| `GET/POST /api/workspaces` | ❌ No rate limit | — | `apps/web/app/api/workspaces/route.ts` |
| `POST /api/share/**` | ❌ No rate limit | — | `apps/web/app/api/share/**` |
| `POST /api/mcp/message` | ✅ 100/min, 10 burst, 5 destr. | Redis in `index.ts` | `apps/mcp-server/index.ts:106-158` |
| `GET /api/system/metrics` | ❌ No rate limit | — | `apps/web/app/api/system/metrics/route.ts` |

AGENTS.md Rule 50 requires: "Standard API: 100 req/min. Auth endpoints: 10 req/min. Search: 30 req/min. Destructive ops: 5 req/min."

**Impact:** Brute force attacks on QR approve endpoint, event creation, search, and all other unprotected endpoints. Potential for resource exhaustion and abuse.

**Recommended Fix:**
1. Create a reusable rate limiting middleware in `apps/web/lib/rate-limit.ts`:
   ```typescript
   export async function checkApiRateLimit(
     key: string,
     limit: number,
     windowSeconds: number = 60
   ): Promise<{ allowed: boolean; remaining: number }> {
     // ... same pattern as lib/auth.ts checkRateLimit but keyed differently
   }
   ```
2. Apply to all routes:
   - Events: 100 req/min per user/session
   - Search: 30 req/min per user/session  
   - Auth QR approve: 10 req/min per IP
   - Workspaces: 100 req/min
   - Share: 30 req/min

---

### 6. [HIGH] Workspace `authenticateRequest` Helper Does Not Check Session Expiry

**Status:** FAIL
**Evidence:**
- `apps/web/app/api/workspaces/_helpers.ts:28-40`:
  ```typescript
  export async function authenticateRequest(request: NextRequest): Promise<string | null> {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return null;
    const token = authHeader.slice(7);
    const [session] = await db
      .select({ userId: sessions.userId })
      .from(sessions)
      .where(eq(sessions.id, token))  // ⚠️ NO expiry check!
      .limit(1);
    return session?.userId ?? null;
  }
  ```
- Compare with `apps/web/lib/validate-session.ts:37-51` which correctly checks:
  ```typescript
  .where(and(eq(sessions.id, token), gt(sessions.expiresAt, new Date())))
  ```

**Impact:** Expired session tokens are accepted as valid by all workspace API routes (`GET /workspaces`, `POST /workspaces`, and nested routes). This allows continued access after the 7-day session expiry.

**Recommended Fix:**
Add the expiry filter:
```typescript
import { gt } from "drizzle-orm";
// ...
.where(and(eq(sessions.id, token), gt(sessions.expiresAt, new Date())))
```

---

### 7. [HIGH] Inconsistent Input Validation — Many Routes Skip Zod

**Status:** FAIL
**Evidence:**
| Route | Uses Zod? | Manual Validation Notes |
|-------|-----------|----------------------|
| `POST /api/auth/login` | ✅ Zod | Safe |
| `POST /api/auth/register` | ✅ Zod | Safe |
| `POST /api/auth/qr/init` | ✅ Zod | Safe |
| `POST /api/auth/qr/approve` | ✅ Zod | Safe |
| `POST /api/events` | ❌ Manual | Uses `typeof` checks, no Zod schema — misses nested validation |
| `PATCH /api/events/:id` | ❌ Manual | Uses `typeof` checks on `body as Record<string, unknown>` |
| `DELETE /api/events/:id` | ❌ Manual | Only validates `scope` query param enumeration |
| `GET /api/search` | ❌ Manual | String length/format checks only |
| `POST /api/workspaces` | ❌ Manual | `typeof body.name !== "string"` |
| `POST /api/share/calendar/:id` | ❌ Manual | `body as { password?: string; expiresAt?: string }` |
| `POST /api/share/verify/:hash` | ❌ Manual | `body as { password?: string }` |

AGENTS.md Rule 10: "Every API input, MCP tool argument, and form submission must be validated with Zod schemas."

**Impact:** Manual validation is error-prone and misses edge cases (e.g., empty strings, special characters, type coercion). Inconsistent validation leads to potential injection vectors and data corruption.

**Recommended Fix:**
Add Zod schemas to ALL API route handlers. Example for events POST:
```typescript
const CreateEventSchema = z.object({
  calendarId: z.string().uuid(),
  title: z.string().min(1).max(255),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  description: z.string().optional(),
  location: z.string().optional(),
  timezone: z.string().optional(),
  attendees: z.array(z.string().email()).optional(),
  recurrence: z.string().optional(),
  isAllDay: z.boolean().optional(),
});
```

---

### 8. [MEDIUM] API Key Hashing Uses SHA-256, Not bcrypt (Doc/Schema Mismatch)

**Status:** FAIL (documented as bcrypt, implemented as SHA-256)
**Evidence:**
- `packages/db/schema/developer.ts:12`: Comment says `// bcrypt hash — never store raw`
- `packages/db/migrations/0000_initial.sql:118`: Comment says `-- bcrypt hash — never store raw`
- `apps/mcp-server/auth.ts:26-31`: Implementation uses SHA-256 with comment: `// This is NOT bcrypt — the apiKeys.keyHash has a UNIQUE constraint, so the hash must be deterministic for direct equality lookups.`
- AGENTS.md Rule 45: "API keys are bcrypt-hashed in the database"

**Analysis:** SHA-256 is the **correct** choice here because the `key_hash` column has a UNIQUE constraint and is used for direct equality lookups. bcrypt would not work because it produces different output on each call (random salt). The schema comments and AGENTS.md are inaccurate.

**Impact:** Low — the implementation is actually correct for the use case. But the documentation is misleading. Future maintainers might attempt to switch to bcrypt and break the lookup mechanism.

**Recommended Fix:**
1. Update `packages/db/schema/developer.ts:12` comment to: `// SHA-256 hash (deterministic for UNIQUE lookups)`
2. Update `packages/db/migrations/0000_initial.sql:118` comment similarly
3. Update `AGENTS.md Rule 45` to clarify that API keys use deterministic SHA-256 for UNIQUE constraint lookups, not bcrypt

---

### 9. [MEDIUM] Public Share Hash Verification Generates Tokens Without Proper Auth

**Status:** FAIL
**Evidence:**
- `apps/web/app/api/share/verify/[hash]/route.ts:68-70`: Generates `tempToken = crypto.randomBytes(32).toString("hex")` when password verification succeeds, but there is **no mechanism** to associate this token with the share link or validate it on subsequent requests
- The `public_links` table has no `temp_token` or `token_expires_at` columns

**Impact:** The temporary access token is generated but cannot be validated on subsequent requests (e.g., when fetching the actual shared calendar/event data). This means either: (a) the password is re-requested on every access, or (b) the share URL itself serves as the sole access control without password re-verification.

**Recommended Fix:**
Either implement proper token validation:
1. Add `accessToken` and `accessTokenExpiresAt` columns to `public_links` table
2. Store the generated token when password is verified
3. Accept the token as a query parameter on subsequent requests to the share endpoint
4. Validate the token against the stored value and expiry

Or remove the token generation entirely if passwords are verified on every access.

---

### 10. [MEDIUM] WebSocket Auth Channel Subscription Uses Generic Channel Name in Client Component

**Status:** FAIL
**Evidence:**
- `apps/web/components/DynamicQRCode.tsx:186`: WebSocket sends `{ type: "SUBSCRIBE", channel: "auth" }` — a generic channel name
- `apps/realtime/rooms/index.ts:35`: Redis subscribes to `auth:*` pattern
- `apps/web/app/api/auth/qr/init/route.ts:53`: Channel generated as `auth_${challengeId}` (UUID-based)
- The client WebSocket subscription doesn't match the challenge-specific channel

**Impact:** The QR auth flow appears broken. The client subscribes to a generic `auth` channel, but the server publishes to `auth_{challengeId}`. The WebSocket connection may never receive `AUTH_COMPLETE` events. While this is more of a functionality bug, it means the QR authentication feature is **non-functional**, which impacts the security model (users cannot use the presumably more secure QR auth path).

**Recommended Fix:**
Update the DynamicQRCode component to subscribe to the challenge-specific channel:
```typescript
// The client should receive the challengeId from the init endpoint
// and subscribe to the specific auth channel
ws.send(JSON.stringify({ type: "SUBSCRIBE_AUTH", payload: { channelId: `auth_${challengeId}` } }));
```

---

### 11. [LOW] No CORS Configuration on Any Service

**Status:** NOT_FOUND (no CORS headers anywhere)
**Evidence:**
- MCP Express server (`apps/mcp-server/index.ts:207-208`): No CORS middleware
- Realtime HTTP server (`apps/realtime/index.ts:28-31`): No CORS headers
- Next.js app: No CORS configuration or middleware

**Impact:** Low for a self-hosted app where frontend and backend are served from the same origin. However, the MCP SSE endpoint serves AI agents (Cursor, Claude) that connect from different origins. The realtime WebSocket server may also need to handle cross-origin connections from the mobile app. No CORS could break these integrations.

**Recommended Fix:**
Add CORS to the MCP Express server:
```typescript
import cors from "cors";
app.use(cors({
  origin: process.env.CORS_ORIGIN || "https://calendar.yourdomain.com",
  methods: ["GET", "POST"],
  allowedHeaders: ["Authorization", "Content-Type"],
  credentials: true,
}));
```

---

### 12. [LOW] Health Check Does Not Actually Verify Redis

**Status:** FAIL
**Evidence:**
- `apps/web/app/api/system/health/route.ts:26-31`:
  ```typescript
  try {
    if (process.env.REDIS_URL) {
      // In production: await redis.ping()
      redis = "connected";  // ⚠️ Always reports "connected" if env var is set
    }
  } catch {
    redis = "disconnected";
  }
  ```
This code never actually connects to Redis. It just checks if the environment variable exists, then always returns "connected". The `await redis.ping()` call is commented out.

**Impact:** Health checks will report Redis as "connected" even when Redis is down. Docker/Dokploy health checks cannot detect Redis outages, potentially routing traffic to a degraded instance.

**Recommended Fix:**
Replace with actual Redis ping:
```typescript
import redis from "@/lib/redis";
try {
  await redis.ping(); // Or implement ping on the RedisClient interface
  redis = "connected";
} catch {
  redis = "disconnected";
}
```

---

### 13. [LOW] Metrics Endpoint Lacks Admin Role Check

**Status:** FAIL
**Evidence:**
- `apps/web/app/api/system/metrics/route.ts:14`: Only calls `await requireAuth(request)` — checks **any** authenticated session, does not verify the user has `ADMIN` role
- `docs/05-route-map-web-mobile.md`: Metrics is under `(admin)/` route group, implying admin-only access
- Rule 47: Standard error format is used, but no admin role enforcement

**Impact:** Any authenticated user can access system-wide metrics (total users, events, workspaces, database size). Low severity since this is informational data.

**Recommended Fix:**
Add admin role check:
```typescript
import { requireRole } from "@/lib/rbac";
// After auth:
const sessionUser = await requireAuth(request);
// Verify admin role — requires admin check per-user
// (may need a users.role field or admin membership check)
```

---

### 14. [INFO] No Rate Limiting When Redis Is Unavailable (Graceful Degradation)

**Status:** INFO (architectural decision)
**Evidence:**
- `apps/mcp-server/index.ts:110-111`: Rate limiting silently allows all requests when Redis is down: `if (!redis) { return { allowed: true }; }`
- `apps/web/lib/redis.ts:98-100`: Rate limiting throws `new Error("Redis not available")` when Redis is down

**Impact:** During Redis outages, the MCP server has no rate limiting (all requests pass), while the web API rate limiting throws errors (all requests fail). This is an inconsistency in failure mode.

**Recommended Fix:**
Consider a consistent fallback strategy:
- Option A: Deny all requests when rate limiting cannot be enforced (fail secure)
- Option B: Use in-memory rate limiting as fallback (less accurate but functional)
- Match the behavior across both MCP and web API

---

## Checklist Summary

| # | Item | Status | Severity | File Reference |
|---|------|--------|----------|----------------|
| 1 | API keys stored as bcrypt hashes | **FAIL** | MEDIUM | `schema/developer.ts:12`, `mcp-server/auth.ts:26-31` |
| 2 | QR challenges single-use (PENDING→APPROVED) | **PASS** | — | `api/auth/qr/approve/route.ts:59-63` |
| 3 | QR challenge 60s TTL (Redis expire) | **PASS** | — | `api/auth/qr/init/route.ts:21,65` |
| 4 | WebSocket channels use unguessable UUIDs | **PASS** | — | `api/auth/qr/init/route.ts:49,53` |
| 5 | Sessions use text PKs per Better Auth | **PASS** | — | `schema/auth.ts:18-19` |
| 6 | ownerId on workspaces uses onDelete: "restrict" | **PASS** | — | `schema/workspace.ts:27`, migration line 53 |
| 7 | RLS policies exist on user-scoped tables | **FAIL** | CRITICAL | `migrations/0000_initial.sql` (none found) |
| 8 | Rate limits enforced by scope | **FAIL** | HIGH | Multiple files (see §5) |
| 9 | MCP delete_event requires confirmDestructive: true | **PASS** | — | `mcp-server/tools/delete-event.ts:36-45` |
| 10 | No hardcoded secrets in any file | **PASS** | — | Full codebase grep |
| 11 | CORS headers not wildcard | **NOT_FOUND** | LOW | No CORS headers exist anywhere |
| 12 | X-Content-Type-Options: nosniff | **FAIL** | HIGH | No security headers on any service |
| 13 | X-Frame-Options: DENY | **FAIL** | HIGH | No security headers on any service |
| 14 | All user input validated via Zod | **FAIL** | HIGH | Many routes skip Zod (see §7) |
| 15 | No eval() or dynamic code execution | **PASS** | — | Full codebase grep |
| 16 | Binary file uploads rejected | **PASS** | — | Schema has no file/binary fields |
| 17 | .env in .gitignore | **PASS** | — | `.gitignore` line 4 |
| 18 | No credentials in client-side code | **PASS** | — | Components checked |

---

## Recommended Fix Priority

### Immediate (Pre-Production)
1. **Add `revokedAt` column** to `api_keys` table and implement revocation endpoint
2. **Implement RLS policies** across all user-scoped tables
3. **Add security headers** (helmet middleware + Next.js middleware)
4. **Fix session expiry check** in `apps/web/app/api/workspaces/_helpers.ts`

### Short-Term (Next Sprint)
5. **Apply rate limiting** to all unprotected routes
6. **Add Zod validation** to all API route handlers
7. **Encrypt webhook secrets** at rest
8. **Fix QR WebSocket channel subscription** in DynamicQRCode component

### Medium-Term (Backlog)
9. **Document accurate hashing** (SHA-256, not bcrypt for API keys)
10. **Implement proper temp token validation** for shared link password flow
11. **Add CORS configuration** to MCP and realtime servers
12. **Fix Redis health check** to actually verify connectivity
13. **Add admin role check** to metrics endpoint
14. **Standardize rate-limiting fallback** behavior when Redis is down

---

## Appendix: Key Files Reviewed

| File | Description |
|------|-------------|
| `packages/db/schema/developer.ts` | API keys & webhooks schema |
| `packages/db/schema/auth.ts` | Users, sessions, QR challenges schema |
| `packages/db/schema/workspace.ts` | Workspaces & members schema |
| `packages/db/schema/calendar.ts` | Calendars & events schema |
| `packages/db/schema/sharing.ts` | Public sharing schema |
| `packages/db/migrations/0000_initial.sql` | Initial migration (all tables) |
| `packages/db/migrations/0001_indexes.sql` | Index migration |
| `apps/mcp-server/auth.ts` | MCP token authentication |
| `apps/mcp-server/rbac.ts` | MCP role-based access control |
| `apps/mcp-server/index.ts` | MCP server (SSE, rate limiting, dispatch) |
| `apps/mcp-server/tools/delete-event.ts` | MCP delete handler |
| `apps/realtime/index.ts` | WebSocket server |
| `apps/realtime/handlers/connection.ts` | WS auth & subscription handler |
| `apps/realtime/rooms/index.ts` | Room/channel management & Redis Pub/Sub |
| `apps/web/lib/auth.ts` | Auth utilities (rate limiting, IP, tokens) |
| `apps/web/lib/validate-session.ts` | Session validation (correct expiry check) |
| `apps/web/lib/errors.ts` | Standardized error responses |
| `apps/web/lib/rbac.ts` | Workspace RBAC |
| `apps/web/lib/redis.ts` | Redis client & Pub/Sub for WebSocket |
| `apps/web/app/api/auth/*/route.ts` | All auth API routes (login, register, QR, sessions, logout) |
| `apps/web/app/api/events/*/route.ts` | Events CRUD API routes |
| `apps/web/app/api/search/route.ts` | Full-text search API |
| `apps/web/app/api/workspaces/*` | Workspace API routes & helpers |
| `apps/web/app/api/share/*` | Public sharing API routes |
| `apps/web/app/api/system/*` | System health & metrics |
| `apps/web/components/DynamicQRCode.tsx` | QR auth WebSocket client |
| `.gitignore` | Git ignore rules |
| `.env.example` | Environment variable template |

---

*Report generated by Agent A25b (Security Auditor) — Full codebase scan completed 2026-05-10*
