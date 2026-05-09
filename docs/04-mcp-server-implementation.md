# 🤖 🤖 MCP Server Implementation & Integration Docs

# 🤖 NovaCal — MCP Server Implementation & Integration Docs

> **Protocol:** Model Context Protocol (MCP) — SSE Transport **Stack:** Node.js + `@modelcontextprotocol/sdk` **Security:** Bearer token auth + User-scoped RBAC + Redis rate limiting **Compliance:** Latest MCP SDK specification


---

## Part 1 — Technical Implementation Requirements


---

### 1.1 The SSE Transport Bridge

The MCP server must expose two endpoints to comply with the latest MCP SDK SSE transport specification:

```typescript
// apps/mcp-server/index.ts

import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

const app = express();
let transport: SSEServerTransport | null = null;

// ─── Endpoint 1: Establish SSE Stream ───
app.get("/mcp/sse", async (req, res) => {
  // 1. Authenticate before establishing stream
  const authResult = await authenticateRequest(req);
  if (!authResult.authenticated) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // 2. Create SSE transport (returns unique session POST endpoint)
  transport = new SSEServerTransport("/mcp/message", res);
  
  // 3. Store auth context on the transport for downstream handlers
  (transport as any).userContext = authResult.user;
  (transport as any).workspaceContext = authResult.workspace;

  // 4. Connect the MCP server to this transport
  await server.connect(transport);
});

// ─── Endpoint 2: Receive JSON-RPC Messages ───
app.post("/mcp/message", async (req, res) => {
  if (!transport) {
    res.status(500).json({ error: "No active SSE session" });
    return;
  }
  
  // Rate limit check before processing
  const rateResult = await checkRateLimit(req);
  if (!rateResult.allowed) {
    res.status(429).json({ error: "Rate limit exceeded", retryAfter: rateResult.retryAfter });
    return;
  }

  await transport.handlePostMessage(req, res);
});
```

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/mcp/sse` | GET    | Establishes SSE stream. Returns a unique session ID and POST endpoint for the agent to send JSON-RPC payloads. |
| `/mcp/message` | POST   | Receives JSON-RPC payloads from the AI agent. Validates, rate-limits, and routes to the appropriate handler. |

**Session lifecycle:**


1. Agent connects to `GET /mcp/sse` → receives `session_id` in the initial event
2. Agent sends JSON-RPC messages to `POST /mcp/message?sessionId={id}` with `Content-Type: application/json`
3. Server responds over the open SSE stream
4. Session expires after 5 minutes of inactivity (configurable via `MCP_SESSION_TTL`)


---

### 1.2 Capability Declarations

The server must implement these core MCP SDK request schemas:

#### ListToolsRequestSchema

```typescript
import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_events",
        description: "Query calendar events within a date range. Supports filtering by workspace, team member, and event status.",
        inputSchema: {
          type: "object",
          properties: {
            dateFrom: { type: "string", description: "ISO-8601 start date (required)" },
            dateTo: { type: "string", description: "ISO-8601 end date (required)" },
            workspaceId: { type: "string", description: "Filter by workspace ID" },
            userId: { type: "string", description: "Filter by specific user's events" },
            query: { type: "string", description: "FTS search term for title/description/location" },
            limit: { type: "number", description: "Max results (default: 50, max: 200)" },
          },
          required: ["dateFrom", "dateTo"],
        },
      },
      {
        name: "create_event",
        description: "Create a new calendar event. Accepts natural language description OR structured fields. Automatically detects conflicts.",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "Event title (required)" },
            startTime: { type: "string", description: "ISO-8601 start datetime (required)" },
            endTime: { type: "string", description: "ISO-8601 end datetime (required)" },
            description: { type: "string", description: "Markdown description (optional)" },
            location: { type: "string", description: "Physical location or meeting link (optional)" },
            timezone: { type: "string", description: "IANA timezone for display (optional, defaults to user preference)" },
            attendees: { type: "array", items: { type: "string" }, description: "Array of user emails to invite (optional)" },
            workspaceId: { type: "string", description: "Workspace to create in (optional, defaults to active workspace)" },
            recurrence: { type: "string", description: "RRule string for recurring events (optional)" },
          },
          required: ["title", "startTime", "endTime"],
        },
      },
      {
        name: "find_common_time",
        description: "Cross-reference multiple team members to find the earliest available meeting slot within a date range.",
        inputSchema: {
          type: "object",
          properties: {
            userIds: { type: "array", items: { type: "string" }, description: "Array of user IDs to check (required)" },
            dateFrom: { type: "string", description: "ISO-8601 start date (required)" },
            dateTo: { type: "string", description: "ISO-8601 end date (required)" },
            durationMinutes: { type: "number", description: "Desired meeting duration (required)" },
            workingHoursOnly: { type: "boolean", description: "Only consider 9-5 weekday slots (default: true)" },
          },
          required: ["userIds", "dateFrom", "dateTo", "durationMinutes"],
        },
      },
      {
        name: "update_event",
        description: "Modify an existing event. For recurring events, specify singleInstance: true to edit only one occurrence.",
        inputSchema: {
          type: "object",
          properties: {
            eventId: { type: "string", description: "Event ID to update (required)" },
            title: { type: "string", description: "New title" },
            startTime: { type: "string", description: "New ISO-8601 start datetime" },
            endTime: { type: "string", description: "New ISO-8601 end datetime" },
            description: { type: "string", description: "New description" },
            location: { type: "string", description: "New location" },
            singleInstance: { type: "boolean", description: "Modify only this occurrence of a recurring event" },
          },
          required: ["eventId"],
        },
      },
      {
        name: "delete_event",
        description: "Delete an event. Requires explicit confirmation flag for destructive operations. For recurring events, specify scope.",
        inputSchema: {
          type: "object",
          properties: {
            eventId: { type: "string", description: "Event ID to delete (required)" },
            confirmDestructive: { type: "boolean", description: "Must be true to execute deletion (required)" },
            scope: { type: "string", enum: ["single", "this_and_future", "all"], description: "Recurrence scope (default: single)" },
          },
          required: ["eventId", "confirmDestructive"],
        },
      },
      {
        name: "get_availability",
        description: "Get a user's availability (free/busy) blocks for a given time range. Returns time blocks, not event details.",
        inputSchema: {
          type: "object",
          properties: {
            userId: { type: "string", description: "User ID (required)" },
            dateFrom: { type: "string", description: "ISO-8601 start date (required)" },
            dateTo: { type: "string", description: "ISO-8601 end date (required)" },
          },
          required: ["userId", "dateFrom", "dateTo"],
        },
      },
      {
        name: "search_events",
        description: "Full-text search across event titles, descriptions, and locations using PostgreSQL FTS. Supports typo-tolerant partial matching.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search term (required)" },
            workspaceId: { type: "string", description: "Filter by workspace" },
            limit: { type: "number", description: "Max results (default: 20)" },
          },
          required: ["query"],
        },
      },
      {
        name: "get_upcoming_events",
        description: "Quick summary of upcoming events for the current or next N days. Useful for 'What's on my calendar today?' queries.",
        inputSchema: {
          type: "object",
          properties: {
            days: { type: "number", description: "Number of days to look ahead (default: 1)" },
            workspaceId: { type: "string", description: "Filter by workspace" },
          },
        },
      },
    ],
  };
});
```

#### CallToolRequestSchema

```typescript
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { db } from "@novacal/db";
import { events } from "@novacal/db/schema";
import { and, gte, lte, eq, or, sql } from "drizzle-orm";

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // The user context is stored on the transport during SSE setup
  const userContext = (transport as any)?.userContext;
  if (!userContext) {
    throw new Error("No authenticated user context");
  }

  switch (name) {
    case "list_events": {
      const schema = z.object({
        dateFrom: z.string(),
        dateTo: z.string(),
        workspaceId: z.string().optional(),
        userId: z.string().optional(),
        query: z.string().optional(),
        limit: z.number().max(200).optional().default(50),
      });
      const params = schema.parse(args);

      const conditions = [
        gte(events.startTime, new Date(params.dateFrom)),
        lte(events.endTime, new Date(params.dateTo)),
      ];

      if (params.workspaceId) conditions.push(eq(events.workspaceId, params.workspaceId));
      if (params.userId) conditions.push(eq(events.createdBy, params.userId));
      if (params.query) {
        conditions.push(
          sql`to_tsvector('english', coalesce(${events.title}, '') || ' ' || coalesce(${events.description}, '')) @@ to_tsquery('english', ${params.query})`
        );
      }

      const results = await db.select().from(events).where(and(...conditions)).limit(params.limit);

      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    }

    case "create_event": {
      const schema = z.object({
        title: z.string().min(1),
        startTime: z.string(),
        endTime: z.string(),
        description: z.string().optional(),
        location: z.string().optional(),
        timezone: z.string().optional(),
        attendees: z.array(z.string()).optional(),
        workspaceId: z.string().optional(),
        recurrence: z.string().optional(),
      });
      const params = schema.parse(args);

      // RBAC check — only users with EDITOR role or above can create
      await assertMinimumRole(userContext.userId, params.workspaceId, "EDITOR");

      // Conflict detection
      const conflicts = await db
        .select()
        .from(events)
        .where(
          and(
            gte(events.endTime, new Date(params.startTime)),
            lte(events.startTime, new Date(params.endTime)),
            params.workspaceId ? eq(events.workspaceId, params.workspaceId) : undefined,
          )
        );

      const [event] = await db.insert(events).values({
        title: params.title,
        startTime: new Date(params.startTime),
        endTime: new Date(params.endTime),
        description: params.description,
        location: params.location,
        timezone: params.timezone,
        workspaceId: params.workspaceId || userContext.activeWorkspaceId,
        createdBy: userContext.userId,
        recurrence: params.recurrence ? JSON.parse(params.recurrence) : null,
      }).returning();

      return {
        content: [
          { type: "text", text: `✅ Event created: "${event.title}" (${event.startTime} — ${event.endTime})` },
          ...(conflicts.length > 0
            ? [{ type: "text", text: `⚠️ Conflict detected with ${conflicts.length} existing event(s): ${conflicts.map(c => c.title).join(", ")}` }]
            : []),
        ],
      };
    }

    case "delete_event": {
      const schema = z.object({
        eventId: z.string(),
        confirmDestructive: z.boolean(),
        scope: z.enum(["single", "this_and_future", "all"]).optional().default("single"),
      });
      const params = schema.parse(args);

      if (!params.confirmDestructive) {
        return {
          content: [{ type: "text", text: "❌ Deletion requires confirmDestructive: true. This is a destructive operation." }],
        };
      }

      await assertMinimumRole(userContext.userId, undefined, "EDITOR");
      await db.delete(events).where(eq(events.id, params.eventId));

      return {
        content: [{ type: "text", text: `✅ Event ${params.eventId} deleted.` }],
      };
    }

    // Additional handlers: find_common_time, update_event, get_availability, search_events, get_upcoming_events
    // ... (follow same pattern with Zod validation + RBAC + DB operations)

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});
```

#### ListResourcesRequestSchema (Optional — Read-Only Context)

Expose read-only context URIs that the AI agent can pull from:

| URI Scheme | Description | Example |
|------------|-------------|---------|
| `novacal://workspaces/{id}/members` | Team roster with roles | `novacal://workspace_abc123/members` |
| `novacal://workspaces/{id}/availability` | Free/busy for the upcoming week | `novacal://workspace_abc123/availability` |
| `novacal://users/me/profile` | The authenticated user's profile | `novacal://users/me/profile` |

```typescript
import { ListResourcesRequestSchema } from "@modelcontextprotocol/sdk/types.js";

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: `novacal://workspaces/${userContext.activeWorkspaceId}/members`,
        name: "Team Roster",
        description: "List of team members with roles in the active workspace",
        mimeType: "application/json",
      },
      {
        uri: `novacal://workspaces/${userContext.activeWorkspaceId}/availability`,
        name: "Weekly Availability",
        description: "Free/busy blocks for all team members this week",
        mimeType: "application/json",
      },
      {
        uri: `novacal://users/me/profile`,
        name: "My Profile",
        description: "Authenticated user's profile and preferences",
        mimeType: "application/json",
      },
    ],
  };
});
```


---

### 1.3 Security & Authorization

#### Bearer Token Validation

```typescript
// apps/mcp-server/auth.ts

interface AuthResult {
  authenticated: boolean;
  user: { userId: string; activeWorkspaceId: string; role: string };
  workspace: { id: string; name: string };
}

async function authenticateRequest(req: express.Request): Promise<AuthResult> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { authenticated: false, user: null, workspace: null };
  }

  const token = authHeader.slice(7); // Strip "Bearer "

  // Look up API key in DB (hashed)
  const apiKey = await db.query.apiKeys.findFirst({
    where: eq(apiKeys.keyHash, hashToken(token)),
    with: { user: true, workspace: true },
  });

  if (!apiKey || apiKey.revokedAt) {
    return { authenticated: false, user: null, workspace: null };
  }

  // Update last used timestamp
  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, apiKey.id));

  return {
    authenticated: true,
    user: { userId: apiKey.user.id, activeWorkspaceId: apiKey.workspace.id, role: apiKey.user.role },
    workspace: { id: apiKey.workspace.id, name: apiKey.workspace.name },
  };
}
```

| Flow Step | Detail |
|-----------|--------|
| **1. Token extraction** | `Authorization: Bearer ncp_key_...` from HTTP header |
| **2. Hash lookup** | Token stored hashed (bcrypt) in DB. Plaintext shown once on creation. |
| **3. Revocation check** | `revokedAt` field — if set, reject immediately |
| **4. Last used** | `lastUsedAt` timestamp updated on every successful auth |
| **5. User context** | User ID + active workspace ID attached to the SSE session |

#### Contextual RBAC

Every tool handler must check the user's role before executing:

```typescript
// apps/mcp-server/rbac.ts

const MINIMUM_ROLE_HIERARCHY = {
  list_events: "VIEWER",
  get_availability: "FREE_BUSY",
  search_events: "VIEWER",
  get_upcoming_events: "VIEWER",
  create_event: "EDITOR",
  update_event: "EDITOR",
  delete_event: "EDITOR",
  find_common_time: "VIEWER",
};

async function assertMinimumRole(
  userId: string,
  workspaceId: string | undefined,
  minimumRole: string
): Promise<void> {
  // Look up user's role in the workspace
  const membership = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.userId, userId),
      workspaceId ? eq(workspaceMembers.workspaceId, workspaceId) : undefined,
    ),
  });

  if (!membership) throw new Error("User is not a member of this workspace");

  const roleLevel = ROLE_HIERARCHY[membership.role];
  const requiredLevel = ROLE_HIERARCHY[minimumRole];

  if (roleLevel < requiredLevel) {
    throw new Error(`Insufficient permissions. Required: ${minimumRole}, has: ${membership.role}`);
  }
}
```

**Important:** The MCP server cannot bypass PostgreSQL Row Level Security (RLS). All queries go through the authenticated user's context, and RLS policies apply at the database level as a hard backstop.


---

### 1.4 Schema Strictness & Progressive Discovery

#### Strict Typing

* Every tool input schema uses `zod` for runtime validation
* No `any` types. No loose strings. Every field has explicit `type`, `description`, and where applicable, `enum` or `format`
* Descriptions are critical — the LLM relies entirely on them to know when to trigger a tool

#### Progressive Discovery (Search Tools)

If the tool registry grows beyond 15–20 tools, implement a `search_tools` meta-tool so the LLM doesn't load the entire registry into context:

```typescript
server.setRequestHandler(ListToolsRequestSchema, async (request) => {
  // If the LLM sends a search_tools query, filter the registry
  const searchQuery = request.params?.cursor; // Optional cursor for pagination/search
  
  const allTools = getFullToolRegistry();
  
  if (searchQuery) {
    const filtered = allTools.filter(t => 
      t.name.includes(searchQuery) || 
      t.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return { tools: filtered };
  }
  
  // Return first N tools + cursor for pagination
  return {
    tools: allTools.slice(0, 10),
    nextCursor: allTools.length > 10 ? "page_2" : undefined,
  };
});
```


---

### 1.5 Rate Limiting & Abuse Prevention

```typescript
// apps/mcp-server/middleware/rateLimit.ts

import { redis } from "@novacal/db/redis";

interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

async function checkRateLimit(req: express.Request): Promise<RateLimitResult> {
  const apiKey = req.headers.authorization?.slice(7) || "anonymous";
  const key = `ratelimit:mcp:${hashToken(apiKey)}`;
  
  const current = await redis.incr(key);
  
  // First request — set expiry
  if (current === 1) {
    await redis.expire(key, 60); // 60-second window
  }
  
  if (current > 100) {
    // 100 requests per minute per API key
    const ttl = await redis.ttl(key);
    return { allowed: false, retryAfter: ttl };
  }
  
  return { allowed: true };
}
```

| Limit | Duration | Scope |
|-------|----------|-------|
| 100 requests | Per 60 seconds | Per API key |
| 10 tool calls | Per 10 seconds | Per session (burst protection) |
| 5 destructive calls | Per 60 seconds | Per API key (delete_event, bulk operations) |


---

## Part 2 — The RTDocs (Documentation Requirements)

These docs must live at `apps/web/app/(developer)/docs/mcp/*.md` (rendered pages) and/or `docs/mcp/*.md` (source files).


---

### 2.1 User / Client Integration Docs

#### `connecting-claude-desktop.md`

```markdown
# Connecting Claude Desktop to NovaCal

Since Claude Desktop natively expects a local `stdio` transport, you need to bridge it to NovaCal's remote SSE endpoint.

## Option 1: Use the MCP Client SSE Bridge (Recommended)

1. Install the bridge:
   ```bash
   npm install -g @modelcontextprotocol/client-sse
```


2. Add to your `claude_desktop_config.json`:

   ```json
   {
     "mcpServers": {
       "novacal": {
         "command": "npx",
         "args": [
           "@modelcontextprotocol/client-sse",
           "https://cal.yourdomain.com/mcp/sse"
         ],
         "env": {
           "MCP_API_KEY": "ncp_key_your_generated_key_here"
         }
       }
     }
   }
   ```
3. Restart Claude Desktop.

## Option 2: Use a Wrapper Script (Alternative)

Create a file `novacal-mcp.sh`:

```bash
#!/bin/bash
MCP_API_KEY="ncp_key_..." npx @modelcontextprotocol/client-sse https://cal.yourdomain.com/mcp/sse
```

Then in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "novacal": {
      "command": "bash",
      "args": ["/path/to/novacal-mcp.sh"]
    }
  }
}
```

## Verification

Ask Claude: "What's on my calendar today?" If connected, NovaCal will return your upcoming events.

```

#### `connecting-cursor.md`

```markdown
# Connecting Cursor to NovaCal

1. Open Cursor Settings → Features → MCP Servers
2. Click "Add New MCP Server"
3. Configure:
   - **Name:** NovaCal
   - **Type:** SSE (Server-Sent Events)
   - **URL:** `https://cal.yourdomain.com/mcp/sse`
   - **Headers:** `{ "Authorization": "Bearer ncp_key_your_generated_key" }`
4. Click "Connect"
5. Verify: The status indicator turns green.
6. Test: Ask Cursor's AI to "Schedule a meeting with the design team tomorrow at 2 PM."
```

#### `generating-api-keys.md`

```markdown
# Generating MCP API Keys

1. Navigate to **Settings → Developer → MCP API Keys**
2. Click **"Generate New Key"**
3. Optionally set a label (e.g., "Cursor Agent", "Claude Desktop")
4. Copy the key immediately — it is shown **once** and then hashed
5. The key format is: `ncp_key_<random_64_hex>`

## Scoping Keys

By default, keys inherit your workspace role permissions. You can optionally scope a key to:
- **Read-only:** Can only query events and availability (FREE_BUSY level)
- **Standard:** Can create and edit events (EDITOR level)
- **Full:** All operations including destructive ones (requires explicit `confirmDestructive` flag)

## Revoking Keys

1. Go to **Settings → Developer → MCP API Keys**
2. Find the key in the table
3. Click **"Revoke"** — the key is immediately invalidated
4. Any active SSE sessions using this key will be disconnected within 60 seconds
```


---

### 2.2 Tool & Resource Catalog

#### `available-tools.md`

```markdown
# NovaCal MCP Tools

| Tool | Description | Auth Required | Destructive |
|------|-------------|---------------|-------------|
| `list_events` | Query events by date range with optional FTS | VIEWER | No |
| `create_event` | Create event with conflict detection | EDITOR | No |
| `update_event` | Modify existing event, supports single-instance recurrence | EDITOR | No |
| `delete_event` | Delete event — requires `confirmDestructive: true` | EDITOR | Yes |
| `find_common_time` | Find earliest available slot across team members | VIEWER | No |
| `get_availability` | Get free/busy blocks for a user | FREE_BUSY | No |
| `search_events` | Full-text search with typo tolerance | VIEWER | No |
| `get_upcoming_events` | Summary of next N days | VIEWER | No |

## Tool: `create_event`

**Required parameters:**
- `title` (string) — Event title
- `startTime` (string) — ISO-8601 start datetime (e.g., `2026-05-10T14:00:00Z`)
- `endTime` (string) — ISO-8601 end datetime

**Optional parameters:**
- `description` (string) — Markdown-rich description
- `location` (string) — Physical or virtual location
- `timezone` (string) — IANA timezone (defaults to user preference)
- `attendees` (string[]) — Array of user emails to invite
- `workspaceId` (string) — Target workspace (defaults to active)
- `recurrence` (string) — RRule string

**Behavior:**
1. Validates all timestamps are ISO-8601 compliant
2. Checks for conflicts in the target time range
3. Returns created event + any detected conflicts

**Example:**
```

User: "Schedule a code review tomorrow 2-3 PM" → create_event({ title: "Code Review", startTime: "2026-05-11T14:00:00", endTime: "2026-05-11T15:00:00" })

```

## Destructive Tool Safety

Tools marked as **Destructive** require:
1. `confirmDestructive: true` in the parameters
2. Minimum `EDITOR` role in the workspace
3. Subject to stricter rate limits (5 per 60 seconds)
```

#### `available-resources.md`

```markdown
# NovaCal MCP Resources (Read-Only URIs)

| URI | Returns | Access Level |
|-----|---------|-------------|
| `novacal://workspaces/{id}/members` | Team roster with roles | VIEWER |
| `novacal://workspaces/{id}/availability` | Free/busy for upcoming week | FREE_BUSY |
| `novacal://users/me/profile` | Authenticated user profile | VIEWER |

## Example: Read Team Availability

The AI agent can read `novacal://workspace_abc123/availability` to see:
```json
{
  "workspace": "Engineering",
  "weekOf": "2026-05-10",
  "members": [
    {
      "name": "Alice",
      "availability": [
        { "date": "2026-05-10", "busy": ["09:00-10:00", "14:00-15:00"] },
        { "date": "2026-05-11", "busy": [] }
      ]
    }
  ]
}
```

Free-Busy viewers see only time blocks — no titles, descriptions, or attendee details.

```

---

### 2.3 Enterprise Security & Administration Docs

#### `mcp-security-model.md`

```markdown
# NovaCal MCP Security Model

## Authentication
- All MCP requests require a `Bearer` token in the HTTP `Authorization` header
- API keys are hashed (bcrypt) in the database
- Keys can be revoked instantly from the dashboard

## Authorization (RBAC)
- Each API key is tied to a specific User ID
- The MCP server queries the database acting **as that user**
- Tool execution respects the user's workspace role:
  - `FREE_BUSY` → Can only read availability blocks
  - `VIEWER` → Can read events, search, list
  - `EDITOR` → Can create, update, delete events
  - `ADMIN` → Can manage workspace settings
  - `OWNER` → Full control

## Defense in Depth
1. **Application layer:** MCP RBAC checks before every tool execution
2. **Database layer:** PostgreSQL Row Level Security (RLS) policies apply to all queries as a hard backstop
3. **Network layer:** CORS, rate limiting, and optional IP allowlisting

## Boundaries
- The MCP server **cannot** access user passwords
- The MCP server **cannot** read other users' private events (RLS enforced)
- The MCP server **cannot** bypass workspace isolation
- Binary file uploads are rejected at the protocol level
```

#### `human-in-the-loop.md`

```markdown
# Human-in-the-Loop (HITL)

NovaCal implements HITL for destructive operations to prevent AI agents from making irreversible changes without user awareness.

## Destructive Operations

| Operation | HITL Mechanism |
|-----------|---------------|
| `delete_event` | Requires `confirmDestructive: true` parameter |
| `bulk_reschedule` | Requires explicit user confirmation via UI notification |
| `delete_workspace` | Not exposed to MCP — dashboard only |

## How It Works

1. The AI agent sends a request with `confirmDestructive: true`
2. The server logs the operation to an audit trail
3. The UI shows a toast notification: "AI Agent deleted event 'Sprint Review'"
4. User can undo from the notification within 30 seconds

## Audit Trail

All MCP operations are logged:
| Field | Value |
|-------|-------|
| `apiKeyId` | Which key made the request |
| `tool` | Which tool was called |
| `params` | Full parameter payload |
| `timestamp` | When it happened |
| `ip` | Originating IP |
```

#### `rate-limiting-and-abuse.md`

```markdown
# Rate Limiting & Abuse Prevention

To prevent AI agents from accidentally DDOSing your self-hosted VPS, NovaCal implements Redis-backed rate limiting.

## Limits

| Scope | Limit | Window | Exceeded Response |
|-------|-------|--------|-------------------|
| Per API key | 100 requests | 60 seconds | `429 Too Many Requests` |
| Per session | 10 tool calls | 10 seconds | `429 - burst limit` |
| Destructive ops | 5 calls | 60 seconds | `429 - destructive limit` |
| Concurrent SSE | 5 sessions | Per key | New connection rejected |

## What Happens When Rate Limited

```json
HTTP 429 Too Many Requests
Retry-After: 45
{
  "error": "rate_limit_exceeded",
  "message": "Too many MCP requests. Try again in 45 seconds.",
  "retryAfter": 45
}
```

## Best Practices for AI Agent Developers


1. Implement exponential backoff when receiving 429 responses
2. Batch requests where possible (e.g., create multiple events in sequence)
3. Avoid polling loops — use `get_upcoming_events` for summaries instead of repeated `list_events` calls
4. Set appropriate `maxTokens` and `temperature` to prevent runaway agent loops

## Monitoring

View rate limit metrics at `/admin/system`. The dashboard shows:

* Requests per minute per key
* Top tool usage
* Rate limit hit frequency
* Active SSE connections

```

---

## ✅ MCP Implementation Checklist

### Technical Requirements
- [ ] `GET /mcp/sse` endpoint with authentication before stream establishment
- [ ] `POST /mcp/message` endpoint with rate limiting before processing
- [ ] `ListToolsRequestSchema` — all 8 tools with strict JSON Schema
- [ ] `CallToolRequestSchema` — each handler with Zod validation + RBAC + DB operations
- [ ] `ListResourcesRequestSchema` — read-only workspace member/availability URIs
- [ ] Bearer token validation on every request
- [ ] User-scoped RBAC per tool (hierarchy: FREE_BUSY → VIEWER → EDITOR → ADMIN → OWNER)
- [ ] Redis rate limiting (100 req/min, 10 burst, 5 destructive)
- [ ] Session TTL (5 min inactivity timeout)
- [ ] Progressive discovery (search_tools / cursor-based pagination for 15+ tools)
- [ ] Audit logging for all MCP operations

### Documentation (RTDocs)
- [ ] `connecting-claude-desktop.md` — SSE bridge via `@modelcontextprotocol/client-sse`
- [ ] `connecting-cursor.md` — Cursor MCP panel configuration
- [ ] `generating-api-keys.md` — Key lifecycle (create, scope, revoke)
- [ ] `available-tools.md` — All 8 tools with schemas, examples, destructive flags
- [ ] `available-resources.md` — Read-only URI schemes (team roster, availability, profile)
- [ ] `mcp-security-model.md` — Auth, RBAC, defense in depth, boundaries
- [ ] `human-in-the-loop.md` — Destructive operation safety, audit trail, undo
- [ ] `rate-limiting-and-abuse.md` — Limits, retry behavior, monitoring
```
