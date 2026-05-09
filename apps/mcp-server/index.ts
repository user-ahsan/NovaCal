// ─── NovaCal MCP Server ───
// Model Context Protocol SSE server for AI agent integration (Cursor, Claude, OpenCode).
//
// Port: process.env.MCP_PORT || 3001
// Endpoints:
//   GET  /mcp/sse     — Establish SSE stream (auth before connect)
//   POST /mcp/message — Receive JSON-RPC (rate limit before process)
//
// Implements:
//   - 8 MCP tools (ListToolsRequestSchema)
//   - 3 read-only resources (ListResourcesRequestSchema)
//   - Bearer token auth (api_keys table, SHA-256 hashed)
//   - Per-tool RBAC (FREE_BUSY → VIEWER → EDITOR)
//   - Redis-backed rate limiting (100/min, 10 burst/10s, 5 destructive/min)
//   - Session TTL (5 min inactivity)
//   - Audit logging (structured JSON to stdout)

import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import Redis from "ioredis";
import { authenticateRequest, hashToken } from "./auth.js";
import { assertMinimumRole, MINIMUM_ROLE_HIERARCHY } from "./rbac.js";
import type { AuthResult } from "./auth.js";

// ─── Tool Imports ───
import { ListEventsSchema, handleListEvents } from "./tools/list-events.js";
import {
  CreateEventSchema,
  handleCreateEvent,
} from "./tools/create-event.js";
import {
  UpdateEventSchema,
  handleUpdateEvent,
} from "./tools/update-event.js";
import {
  DeleteEventSchema,
  handleDeleteEvent,
} from "./tools/delete-event.js";
import {
  FindCommonTimeSchema,
  handleFindCommonTime,
} from "./tools/find-common-time.js";
import {
  GetAvailabilitySchema,
  handleGetAvailability,
} from "./tools/get-availability.js";
import {
  SearchEventsSchema,
  handleSearchEvents,
} from "./tools/search-events.js";
import {
  GetUpcomingEventsSchema,
  handleGetUpcomingEvents,
} from "./tools/get-upcoming-events.js";

// ─── Configuration ───
const PORT = parseInt(process.env.MCP_PORT || "3001", 10);
const REDIS_URL = process.env.REDIS_URL || "redis://novacal-redis:6379";
const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes inactivity timeout

// ─── Redis (for rate limiting) ───
let redis: Redis | null = null;
try {
  redis = new Redis(REDIS_URL, {
    retryStrategy: (times) => Math.min(times * 100, 3000),
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
  });
  redis.on("error", (err) => {
    console.error("[MCP] Redis connection error:", err.message);
  });
} catch {
  console.warn("[MCP] Redis unavailable — rate limiting disabled");
}

// ─── Session / Transport Management ───
interface TransportEntry {
  transport: SSEServerTransport;
  userContext: AuthResult;
  lastActivity: number;
  clientIp: string;
}

const transports = new Map<string, TransportEntry>();

// Module-level auth context for tool handlers (set per POST message)
let currentAuthContext: AuthResult | null = null;

// ─── Rate Limiting ───
// Three buckets per API key:
//   1. 100 requests per 60 seconds (general)
//   2. 10 tool calls per 10 seconds (burst protection)
//   3. 5 destructive calls per 60 seconds (delete_event)

interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

async function checkRateLimit(
  auth: AuthResult,
  isDestructive: boolean,
): Promise<RateLimitResult> {
  if (!redis) {
    return { allowed: true }; // No Redis = no rate limiting
  }

  const keyPrefix = `ratelimit:mcp:${hashToken(auth.apiKeyId)}`;
  const now = Math.floor(Date.now() / 1000);

  // 1. General rate limit: 100 req/min
  const generalKey = `${keyPrefix}:general`;
  const generalCount = await redis.incr(generalKey);
  if (generalCount === 1) {
    await redis.expire(generalKey, 60);
  }
  if (generalCount > 100) {
    const ttl = await redis.ttl(generalKey);
    return {
      allowed: false,
      retryAfter: ttl > 0 ? ttl : 60,
    };
  }

  // 2. Burst protection: 10 req/10s
  const burstKey = `${keyPrefix}:burst:${Math.floor(now / 10)}`;
  const burstCount = await redis.incr(burstKey);
  if (burstCount === 1) {
    await redis.expire(burstKey, 12); // 12s to be safe across window boundary
  }
  if (burstCount > 10) {
    return { allowed: false, retryAfter: 5 };
  }

  // 3. Destructive rate limit: 5 calls/min (only for delete_event)
  if (isDestructive) {
    const destKey = `${keyPrefix}:destructive`;
    const destCount = await redis.incr(destKey);
    if (destCount === 1) {
      await redis.expire(destKey, 60);
    }
    if (destCount > 5) {
      const ttl = await redis.ttl(destKey);
      return {
        allowed: false,
        retryAfter: ttl > 0 ? ttl : 60,
      };
    }
  }

  return { allowed: true };
}

// ─── Audit Logging ───

interface AuditEntry {
  timestamp: string;
  apiKeyId: string;
  userId: string;
  tool: string;
  params: Record<string, unknown>;
  ip: string;
}

function auditLog(
  auth: AuthResult,
  tool: string,
  params: Record<string, unknown>,
  ip: string,
): void {
  const entry: AuditEntry = {
    timestamp: new Date().toISOString(),
    apiKeyId: auth.apiKeyId,
    userId: auth.userId,
    tool,
    params,
    ip,
  };
  // Structured JSON logging — consumed by admin dashboard / log aggregator
  console.log(JSON.stringify({ type: "mcp_audit", ...entry }));
}

// ─── Session TTL Check ───
// Called before each tool handler. Disconnects stale sessions.
function checkSessionTTL(
  sessionId: string,
): boolean {
  const entry = transports.get(sessionId);
  if (!entry) return false;

  const inactive = Date.now() - entry.lastActivity;
  if (inactive > SESSION_TTL_MS) {
    transports.delete(sessionId);
    return false;
  }

  return true;
}

// ─── Express App ───
const app = express();
app.use(express.json());

// ─── MCP Server ───
const server = new Server(
  {
    name: "novacal-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  },
);

// ─── ListToolsRequestSchema ───
// Returns all 8 tools with EXACT JSON Schema from Doc 04 Section 1.2.
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_events",
        description:
          "Query calendar events within a date range. Supports filtering by workspace, team member, and event status.",
        inputSchema: {
          type: "object",
          properties: {
            dateFrom: {
              type: "string",
              description: "ISO-8601 start date (required)",
            },
            dateTo: {
              type: "string",
              description: "ISO-8601 end date (required)",
            },
            workspaceId: {
              type: "string",
              description: "Filter by workspace ID",
            },
            userId: {
              type: "string",
              description: "Filter by specific user's events",
            },
            query: {
              type: "string",
              description:
                "FTS search term for title/description/location",
            },
            limit: {
              type: "number",
              description: "Max results (default: 50, max: 200)",
            },
          },
          required: ["dateFrom", "dateTo"],
        },
      },
      {
        name: "create_event",
        description:
          "Create a new calendar event. Accepts natural language description OR structured fields. Automatically detects conflicts.",
        inputSchema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Event title (required)",
            },
            startTime: {
              type: "string",
              description: "ISO-8601 start datetime (required)",
            },
            endTime: {
              type: "string",
              description: "ISO-8601 end datetime (required)",
            },
            description: {
              type: "string",
              description: "Markdown description (optional)",
            },
            location: {
              type: "string",
              description:
                "Physical location or meeting link (optional)",
            },
            timezone: {
              type: "string",
              description:
                "IANA timezone for display (optional, defaults to user preference)",
            },
            attendees: {
              type: "array",
              items: { type: "string" },
              description:
                "Array of user emails to invite (optional)",
            },
            workspaceId: {
              type: "string",
              description:
                "Workspace to create in (optional, defaults to active workspace)",
            },
            recurrence: {
              type: "string",
              description:
                "RRule string for recurring events (optional)",
            },
          },
          required: ["title", "startTime", "endTime"],
        },
      },
      {
        name: "find_common_time",
        description:
          "Cross-reference multiple team members to find the earliest available meeting slot within a date range.",
        inputSchema: {
          type: "object",
          properties: {
            userIds: {
              type: "array",
              items: { type: "string" },
              description:
                "Array of user IDs to check (required)",
            },
            dateFrom: {
              type: "string",
              description: "ISO-8601 start date (required)",
            },
            dateTo: {
              type: "string",
              description: "ISO-8601 end date (required)",
            },
            durationMinutes: {
              type: "number",
              description:
                "Desired meeting duration (required)",
            },
            workingHoursOnly: {
              type: "boolean",
              description:
                "Only consider 9-5 weekday slots (default: true)",
            },
          },
          required: [
            "userIds",
            "dateFrom",
            "dateTo",
            "durationMinutes",
          ],
        },
      },
      {
        name: "update_event",
        description:
          "Modify an existing event. For recurring events, specify singleInstance: true to edit only one occurrence.",
        inputSchema: {
          type: "object",
          properties: {
            eventId: {
              type: "string",
              description: "Event ID to update (required)",
            },
            title: { type: "string", description: "New title" },
            startTime: {
              type: "string",
              description: "New ISO-8601 start datetime",
            },
            endTime: {
              type: "string",
              description: "New ISO-8601 end datetime",
            },
            description: {
              type: "string",
              description: "New description",
            },
            location: {
              type: "string",
              description: "New location",
            },
            singleInstance: {
              type: "boolean",
              description:
                "Modify only this occurrence of a recurring event",
            },
          },
          required: ["eventId"],
        },
      },
      {
        name: "delete_event",
        description:
          "Delete an event. Requires explicit confirmation flag for destructive operations. For recurring events, specify scope.",
        inputSchema: {
          type: "object",
          properties: {
            eventId: {
              type: "string",
              description: "Event ID to delete (required)",
            },
            confirmDestructive: {
              type: "boolean",
              description:
                "Must be true to execute deletion (required)",
            },
            scope: {
              type: "string",
              enum: ["single", "this_and_future", "all"],
              description:
                "Recurrence scope (default: single)",
            },
          },
          required: ["eventId", "confirmDestructive"],
        },
      },
      {
        name: "get_availability",
        description:
          "Get a user's availability (free/busy) blocks for a given time range. Returns time blocks, not event details.",
        inputSchema: {
          type: "object",
          properties: {
            userId: {
              type: "string",
              description: "User ID (required)",
            },
            dateFrom: {
              type: "string",
              description: "ISO-8601 start date (required)",
            },
            dateTo: {
              type: "string",
              description: "ISO-8601 end date (required)",
            },
          },
          required: ["userId", "dateFrom", "dateTo"],
        },
      },
      {
        name: "search_events",
        description:
          "Full-text search across event titles, descriptions, and locations using PostgreSQL FTS. Supports typo-tolerant partial matching.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search term (required)",
            },
            workspaceId: {
              type: "string",
              description: "Filter by workspace",
            },
            limit: {
              type: "number",
              description: "Max results (default: 20)",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "get_upcoming_events",
        description:
          "Quick summary of upcoming events for the current or next N days. Useful for \"What's on my calendar today?\" queries.",
        inputSchema: {
          type: "object",
          properties: {
            days: {
              type: "number",
              description:
                "Number of days to look ahead (default: 1)",
            },
            workspaceId: {
              type: "string",
              description: "Filter by workspace",
            },
          },
        },
      },
    ],
  };
});

// ─── CallToolRequestSchema ───
// Dispatch to the appropriate tool handler based on tool name.
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const auth = currentAuthContext;
  if (!auth) {
    throw new Error("No authenticated session context");
  }

  const { name, arguments: args } = request.params;
  const toolName = name as string;

  // --- Audit log the operation ---
  // Find the first available transport entry for the client IP
  const firstEntry = transports.values().next().value;
  const clientIp = firstEntry?.clientIp ?? "unknown";
  auditLog(auth, toolName, (args as Record<string, unknown>) ?? {}, clientIp);

  // --- Rate limit check (destructive tools get stricter limits) ---
  const isDestructive = toolName === "delete_event";
  const rateOk = await checkRateLimit(auth, isDestructive);
  if (!rateOk.allowed) {
    throw new Error(
      `Rate limit exceeded. Retry after ${rateOk.retryAfter}s`,
    );
  }

  // --- RBAC check ---
  const minRole = MINIMUM_ROLE_HIERARCHY[toolName];
  if (minRole) {
    await assertMinimumRole(auth.userId, auth.activeWorkspaceId, minRole);
  }

  // --- Dispatch ---
  switch (toolName) {
    case "list_events": {
      const params = ListEventsSchema.parse(args);
      return handleListEvents(params, auth);
    }

    case "create_event": {
      const params = CreateEventSchema.parse(args);
      return handleCreateEvent(params, auth);
    }

    case "update_event": {
      const params = UpdateEventSchema.parse(args);
      return handleUpdateEvent(params, auth);
    }

    case "delete_event": {
      const params = DeleteEventSchema.parse(args);
      return handleDeleteEvent(params, auth);
    }

    case "find_common_time": {
      const params = FindCommonTimeSchema.parse(args);
      return handleFindCommonTime(params, auth);
    }

    case "get_availability": {
      const params = GetAvailabilitySchema.parse(args);
      return handleGetAvailability(params, auth);
    }

    case "search_events": {
      const params = SearchEventsSchema.parse(args);
      return handleSearchEvents(params, auth);
    }

    case "get_upcoming_events": {
      const params = GetUpcomingEventsSchema.parse(args);
      return handleGetUpcomingEvents(params, auth);
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
});

// ─── ListResourcesRequestSchema ───
// Expose read-only context URIs for progressive discovery.
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const auth = currentAuthContext;
  const workspaceId = auth?.activeWorkspaceId ?? "{unknown}";

  return {
    resources: [
      {
        uri: `novacal://workspaces/${workspaceId}/members`,
        name: "Team Roster",
        description:
          "List of team members with roles in the active workspace",
        mimeType: "application/json",
      },
      {
        uri: `novacal://workspaces/${workspaceId}/availability`,
        name: "Weekly Availability",
        description:
          "Free/busy blocks for all team members this week",
        mimeType: "application/json",
      },
      {
        uri: `novacal://users/me/profile`,
        name: "My Profile",
        description:
          "Authenticated user's profile and preferences",
        mimeType: "application/json",
      },
    ],
  };
});

// ─── Endpoint 1: GET /mcp/sse ───
// Establish SSE stream. Auth before stream creation.
app.get("/mcp/sse", async (req, res) => {
  const authResult = await authenticateRequest(req);
  if (!authResult) {
    res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid or missing API key",
        details: {},
      },
    });
    return;
  }

  // Create SSE transport (returns session POST endpoint)
  const transport = new SSEServerTransport("/mcp/message", res);
  const clientIp =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown";

  const sessionId = transport.sessionId;
  transports.set(sessionId, {
    transport,
    userContext: authResult,
    lastActivity: Date.now(),
    clientIp,
  });

  // Clean up on connection close
  req.on("close", () => {
    transports.delete(sessionId);
    console.log(`[MCP] SSE session closed: ${sessionId}`);
  });

  // Connect the MCP server to this transport
  try {
    await server.connect(transport);
    console.log(
      `[MCP] SSE session established: ${sessionId} (user: ${authResult.userId})`,
    );
  } catch (err) {
    console.error(`[MCP] Failed to connect SSE session:`, err);
    transports.delete(sessionId);
    if (!res.headersSent) {
      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to establish SSE connection",
          details: {},
        },
      });
    }
  }
});

// ─── Endpoint 2: POST /mcp/message ───
// Receive JSON-RPC payloads. Rate limit before processing.
app.post("/mcp/message", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  if (!sessionId) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Missing sessionId query parameter",
        details: {},
      },
    });
    return;
  }

  const entry = transports.get(sessionId);
  if (!entry) {
    res.status(500).json({
      error: {
        code: "NOT_FOUND",
        message: "No active SSE session. Reconnect to /mcp/sse first.",
        details: {},
      },
    });
    return;
  }

  // Session TTL check
  if (!checkSessionTTL(sessionId)) {
    res.status(500).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Session expired after 5 minutes of inactivity. Reconnect to /mcp/sse.",
        details: {},
      },
    });
    return;
  }

  // Update last activity
  entry.lastActivity = Date.now();

  // Rate limit before processing (non-destructive pre-check)
  const rateOk = await checkRateLimit(entry.userContext, false);
  if (!rateOk.allowed) {
    res.status(429).json({
      error: {
        code: "RATE_LIMITED",
        message: `Too many MCP requests. Try again in ${rateOk.retryAfter} seconds.`,
        details: { retryAfter: rateOk.retryAfter },
      },
    });
    return;
  }

  // Set auth context for the tool handler
  currentAuthContext = entry.userContext;

  try {
    await entry.transport.handlePostMessage(req, res);
  } catch (err) {
    console.error(`[MCP] Error handling message:`, err);
    if (!res.headersSent) {
      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to process MCP message",
          details: {},
        },
      });
    }
  } finally {
    currentAuthContext = null;
  }
});

// ─── Health Check ───
app.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
    service: "novacal-mcp",
    activeSessions: transports.size,
    uptime: process.uptime(),
  });
});

// ─── Graceful Shutdown ───
function shutdown() {
  console.log("\n[MCP] Shutting down MCP server...");

  // Disconnect all SSE transports
  for (const [sessionId, entry] of transports) {
    try {
      entry.transport.close();
    } catch {
      // Ignore close errors
    }
    transports.delete(sessionId);
  }

  // Close Redis
  if (redis) {
    redis.quit();
  }

  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// ─── Start Server ───
app.listen(PORT, () => {
  console.log(`✅ NovaCal MCP server listening on port ${PORT}`);
  console.log(`   SSE endpoint:    http://localhost:${PORT}/mcp/sse`);
  console.log(`   Message endpoint: POST http://localhost:${PORT}/mcp/message`);
  console.log(`   Health check:    http://localhost:${PORT}/health`);
});
