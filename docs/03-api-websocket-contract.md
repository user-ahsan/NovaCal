# 🔌 🔌 API & WebSocket Contract — REST Endpoints & Real-Time Protocol

# 🔌 NovaCal — API & WebSocket Contract

> **Base URL:** `https://api.yourdomain.com/v1` **Content-Type:** `application/json` **Audience:** Web frontend, Mobile app (Expo), MCP server, External integrations **Philosophy:** Stateless REST + real-time WebSocket push for instant collaboration


---

## 🛠️ Global API Configuration

### Global Headers

| Header | Required | Value | Description |
|--------|----------|-------|-------------|
| `Authorization` | Yes (except auth endpoints) | `Bearer <session_token>` | Session or API key |
| `X-Workspace-Id` | Yes (all non-auth) | `uuid` | Active workspace context |
| `Content-Type` | Yes      | `application/json` | —           |
| `X-Idempotency-Key` | No       | `uuid` | For safe retries on event creation |

### Rate Limiting (Redis-backed)

| Scope | Limit | Window | Applied To |
|-------|-------|--------|------------|
| **Standard API** | 100 requests | 60s per IP | All REST endpoints |
| **Auth / QR** | 10 requests | 60s per IP | `/auth/*` endpoints |
| **MCP SSE** | 5 concurrent connections | Per user | `/mcp/sse` |
| **Search** | 30 requests | 60s per IP | `/search`  |

### Error Response Schema

Every error response follows this strict format:

```json
{
  "error": {
    "code": "UNAUTHORIZED" | "VALIDATION_ERROR" | "CONFLICT" | "INTERNAL_ERROR" | "RATE_LIMITED" | "NOT_FOUND",
    "message": "Human readable explanation",
    "details": {}
  }
}
```

| HTTP Code | Error Code | When |
|-----------|------------|------|
| 400       | `VALIDATION_ERROR` | Malformed payload, missing required fields |
| 401       | `UNAUTHORIZED` | Missing or invalid bearer token |
| 403       | `FORBIDDEN` | Token valid but insufficient role permissions |
| 404       | `NOT_FOUND` | Resource doesn't exist |
| 409       | `CONFLICT` | Duplicate, overlapping event, expired challenge |
| 429       | `RATE_LIMITED` | Too many requests |
| 500       | `INTERNAL_ERROR` | Server-side failure |


---

## 🔐 1. Authentication & QR Bridge — `/api/auth`


---

### `POST /auth/register`

Create a new account (first-run setup or self-registration).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes      | Valid email |
| `password` | string | Yes      | Min 8 chars |
| `name` | string | Yes      | Display name |

**Response** `**201**`**:**

```json
{
  "user": { "id": "uuid", "email": "user@domain.com", "name": "Ahsan" },
  "sessionToken": "jwt_string"
}
```


---

### `POST /auth/login`

Email/password login (fallback when QR is not available).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes      | —           |
| `password` | string | Yes      | —           |

**Response** `**200**`**:**

```json
{
  "user": { "id": "uuid", "email": "user@domain.com", "name": "Ahsan", "role": "OWNER" },
  "sessionToken": "jwt_string",
  "activeWorkspaceId": "uuid"
}
```


---

### `POST /auth/qr/init`

Generates a new challenge for the Web UI. Stores challenge in Redis with TTL.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `deviceInfo` | string | Yes      | Browser/OS info for the device ledger |

**Response** `**201**`**:**

```json
{
  "challengeId": "uuid",
  "expiresAt": "2026-05-10T14:00:00Z",
  "wsChannel": "auth_uuid"
}
```

**Backend actions:**


1. Generate `challengeId` (UUID v4)
2. Store in Redis: `challenge:{challengeId}` → `{ status: "PENDING", userId: null, deviceInfo }` with TTL 60s
3. Return challenge ID + WebSocket channel


---

### `POST /auth/qr/approve`

Called by the **Authenticated Mobile App** after scanning the QR code.

**Headers:** `Authorization: Bearer <mobile_session_token>`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `challengeId` | string | Yes      | The UUID from the QR code |

**Response** `**200**`**:**

```json
{
  "status": "APPROVED"
}
```

**Backend actions:**


1. Validate mobile session token
2. Look up `challenge:{challengeId}` in Redis
3. If not found → `404 NOT_FOUND`
4. If already `APPROVED` → `409 CONFLICT`
5. Update Redis: `challenge:{challengeId}` → `{ status: "APPROVED", userId: "..." }`
6. Publish `AUTH_COMPLETE` event to the WebSocket channel
7. TTL remaining time is extended to 10s to give the web client time to consume


---

### `POST /auth/logout`

Invalidate the current session.

**Headers:** `Authorization: Bearer <session_token>`

**Response** `**200**`**:**

```json
{ "status": "logged_out" }
```


---

### `GET /auth/sessions`

Lists all active devices — the "Million Dollar" device ledger.

**Headers:** `Authorization: Bearer <session_token>`

**Response** `**200**`**:**

```json
[
  {
    "id": "session_uuid",
    "device": "Xiaomi 14T",
    "ip": "192.168.1.5",
    "lastActive": "2026-05-10T12:00:00Z",
    "createdAt": "2026-05-01T08:00:00Z",
    "isCurrent": true
  }
]
```


---

### `DELETE /auth/sessions/:id`

Revoke a specific session (remote logout).

**Headers:** `Authorization: Bearer <session_token>`

**Response** `**200**`**:**

```json
{ "status": "revoked" }
```


---

### `DELETE /auth/sessions`

"Log out of all devices" panic button.

**Headers:** `Authorization: Bearer <session_token>`

**Response** `**200**`**:**

```json
{ "status": "all_revoked", "count": 5 }
```


---

## 🏗️ 2. Workspaces & Members — `/api/workspaces`


---

### `GET /workspaces`

Lists all workspaces the authenticated user belongs to.

**Headers:** `Authorization: Bearer <session_token>`

**Response** `**200**`**:**

```json
[
  {
    "id": "uuid",
    "name": "Engineering",
    "role": "ADMIN",
    "memberCount": 12,
    "createdAt": "2026-04-01T00:00:00Z"
  }
]
```


---

### `POST /workspaces`

Create a new workspace.

**Headers:** `Authorization: Bearer <session_token>`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes      | Workspace name |
| `timezone` | string | No       | IANA timezone (defaults to user's) |

**Response** `**201**`**:**

```json
{
  "id": "uuid",
  "name": "Engineering",
  "role": "OWNER",
  "defaultTimezone": "Asia/Karachi"
}
```


---

### `PATCH /workspaces/:id`

Update workspace settings.

**Headers:** `Authorization: Bearer <session_token>`\n**Permissions:** Owner or Admin only

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No       | New name    |
| `timezone` | string | No       | New default timezone |

**Response** `**200**`**:**

```json
{ "id": "uuid", "name": "Engineering Team", "defaultTimezone": "UTC" }
```


---

### `DELETE /workspaces/:id`

Delete workspace. Owner only.

**Headers:** `Authorization: Bearer <session_token>`\n**Permissions:** Owner only

**Response** `**200**`**:**

```json
{ "status": "deleted" }
```


---

### `GET /workspaces/:id/members`

List all members in a workspace.

**Headers:** `Authorization: Bearer <session_token>`

**Response** `**200**`**:**

```json
[
  {
    "userId": "uuid",
    "name": "Ahsan Ali",
    "email": "ahsan@domain.com",
    "role": "ADMIN",
    "joinedAt": "2026-04-01T00:00:00Z"
  }
]
```


---

### `PATCH /workspaces/:id/members/:userId`

Update a member's role.

**Headers:** `Authorization: Bearer <session_token>`\n**Permissions:** Owner or Admin only

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `role` | string | Yes      | `EDITOR` \| `VIEWER` \| `FREE_BUSY` |

**Response** `**200**`**:**

```json
{ "userId": "uuid", "role": "EDITOR" }
```


---

### `DELETE /workspaces/:id/members/:userId`

Remove a member from the workspace.

**Headers:** `Authorization: Bearer <session_token>`\n**Permissions:** Owner or Admin only

**Response** `**200**`**:**

```json
{ "status": "removed" }
```


---

### `POST /workspaces/:id/invites`

Generate a one-time invitation link.

**Headers:** `Authorization: Bearer <session_token>`\n**Permissions:** Owner or Admin only

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `role` | string | Yes      | Default role for the invitee |
| `expiresInDays` | number | No       | Default: 7  |

**Response** `**201**`**:**

```json
{
  "inviteUrl": "https://cal.yourdomain.com/invite/uuid",
  "expiresAt": "2026-05-17T00:00:00Z"
}
```


---

## 📅 3. Calendars & Events — `/api/events`


---

### `GET /events`

Fetch events for a specific timeframe (used by GridCanvas and Agenda).

**Headers:** `Authorization: Bearer <session_token>`, `X-Workspace-Id: <uuid>`

**Query Params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `start` | ISO-8601 | Yes      | Start of timeframe |
| `end` | ISO-8601 | Yes      | End of timeframe |
| `calendarIds` | uuid\[\] | No       | Filter by specific calendars |
| `userId` | uuid | No       | Filter by specific user's events |

**Response** `**200**`**:**

```json
[
  {
    "id": "uuid",
    "calendarId": "uuid",
    "title": "Deep Work",
    "start": "2026-05-10T09:00:00Z",
    "end": "2026-05-10T10:00:00Z",
    "rrule": "FREQ=WEEKLY;BYDAY=MO,WE,FR",
    "color": "#6366F1",
    "description": "Focused coding session",
    "location": "Room 204",
    "timezone": "Asia/Karachi",
    "attendees": [{ "id": "uuid", "name": "Ahsan", "response": "ACCEPTED" }],
    "createdBy": { "id": "uuid", "name": "Ahsan Ali" },
    "isAllDay": false
  }
]
```

**Pagination:** Uses cursor-based pagination via `Link` header when result set exceeds `limit` (default 200).


---

### `POST /events`

Create a new event.

**Headers:** `Authorization: Bearer <session_token>`, `X-Workspace-Id: <uuid>`\n**Permissions:** EDITOR or above

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `calendarId` | string | Yes      | Which calendar to create in |
| `title` | string | Yes      | Event title |
| `startTime` | ISO-8601 | Yes      | Start datetime |
| `endTime` | ISO-8601 | Yes      | End datetime |
| `description` | string | No       | Markdown    |
| `location` | string | No       | Physical or virtual |
| `timezone` | string | No       | IANA (defaults to workspace default) |
| `attendees` | string\[\] | No       | Array of user emails to invite |
| `recurrence` | string | No       | RRule string |
| `isAllDay` | boolean | No       | Default: false |

**Response** `**201**`**:**

```json
{
  "id": "uuid",
  "title": "Strategy Sync",
  "start": "2026-05-11T14:00:00Z",
  "end": "2026-05-11T15:00:00Z",
  "conflicts": [
    { "eventId": "uuid", "title": "Sprint Review", "start": "2026-05-11T14:00:00Z" }
  ]
}
```

**Behavior:**


1. Validate all timestamps are ISO-8601 compliant
2. Check for conflicts in the target time range
3. Insert event into database
4. Broadcast `EVENT_CREATED` via WebSocket to all workspace members
5. Return created event + any detected conflicts


---

### `GET /events/:id`

Fetch a single event by ID.

**Headers:** `Authorization: Bearer <session_token>`

**Response** `**200**`**:**

```json
{
  "id": "uuid",
  "title": "Strategy Sync",
  "start": "2026-05-11T14:00:00Z",
  "end": "2026-05-11T15:00:00Z",
  "description": "## Agenda\n- Review Q2 goals",
  "location": "Virtual",
  "timezone": "Asia/Karachi",
  "attendees": [],
  "recurrence": null,
  "createdBy": { "id": "uuid", "name": "Ahsan" },
  "createdAt": "2026-05-10T10:00:00Z"
}
```


---

### `PATCH /events/:id`

Update an existing event.

**Headers:** `Authorization: Bearer <session_token>`\n**Permissions:** EDITOR or above

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | No       | —           |
| `startTime` | ISO-8601 | No       | —           |
| `endTime` | ISO-8601 | No       | —           |
| `description` | string | No       | —           |
| `location` | string | No       | —           |
| `singleInstance` | boolean | No       | For recurring: edit only this occurrence |

**Response** `**200**`**:**

```json
{
  "id": "uuid",
  "title": "Updated Title",
  "start": "2026-05-11T15:00:00Z",
  "end": "2026-05-11T16:00:00Z"
}
```


---

### `DELETE /events/:id`

Delete an event.

**Headers:** `Authorization: Bearer <session_token>`\n**Permissions:** EDITOR or above

| Query Param | Type | Required | Description |
|-------------|------|----------|-------------|
| `scope`     | string | No       | `single` \| `this_and_future` \| `all`. Default: `single` |

**Response** `**200**`**:**

```json
{ "status": "deleted", "scope": "single" }
```


---

## 🔍 4. High-Speed Search — `/api/search`


---

### `GET /search`

Executes PostgreSQL Full-Text Search across event titles, descriptions, and locations.

**Headers:** `Authorization: Bearer <session_token>`, `X-Workspace-Id: <uuid>`

**Query Params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `q`   | string | Yes      | Search query |
| `limit` | number | No       | Max results (default: 20, max: 50) |

**Response** `**200**`**:**

```json
{
  "results": [
    {
      "id": "uuid",
      "title": "Sprint Review",
      "snippet": "...review Q2 deliverables and ...",
      "start": "2026-05-11T14:00:00Z",
      "end": "2026-05-11T15:00:00Z"
    }
  ],
  "latencyMs": 12,
  "total": 1
}
```

**Backend:** Uses PostgreSQL GIN index + `to_tsvector` / `to_tsquery` with prefix matching for typo tolerance.


---

## 🤖 5. MCP (Model Context Protocol)


---

### `GET /mcp/sse`

Establishes the SSE connection for AI Agents (Cursor, Claude, OpenCode).

**Headers:**

| Header | Required | Value |
|--------|----------|-------|
| `Authorization` | Yes      | `Bearer <mcp_api_key>` |
| `X-MCP-Protocol-Version` | No       | `2025-03-26` |

**Response:** `text/event-stream`

**Internal Event:** Returns a unique URI for the client to POST messages to.

```
event: endpoint
data: /mcp/message?sessionId=uuid

event: connected
data: {"sessionId": "uuid", "server": "novacal-mcp/1.0"}
```


---

### `POST /mcp/message`

The JSON-RPC gateway for AI tool execution.

**Headers:**

| Header | Required | Value |
|--------|----------|-------|
| `Authorization` | Yes      | `Bearer <mcp_api_key>` |

**Payload:** Standard MCP JSON-RPC

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "create_event",
    "arguments": {
      "title": "Code Review",
      "startTime": "2026-05-11T14:00:00Z",
      "endTime": "2026-05-11T15:00:00Z"
    }
  }
}
```

**Response (over SSE stream):**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      { "type": "text", "text": "✅ Event created: \"Code Review\" (2026-05-11T14:00:00Z — 2026-05-11T15:00:00Z)" }
    ]
  }
}
```


---

## 🔌 6. WebSocket Contract — The Real-time Engine

**Connection URL:** `wss://api.yourdomain.com/realtime`


---

### Inbound: Handshake

Sent immediately after WebSocket connection is established.

```json
{
  "type": "SUBSCRIBE",
  "payload": {
    "workspaceId": "uuid",
    "token": "session_token"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `workspaceId` | string | Yes      | Subscribe to this workspace's events |
| `token` | string | Yes      | Session token for authentication |

**Server validates token → joins the user to a Redis Pub/Sub channel for that workspace.**


---

### Inbound: Event Mutation

Sent by the client when performing optimistic updates or drag-and-drop.

```json
{
  "type": "EVENT_MOVE",
  "payload": {
    "eventId": "uuid",
    "startTime": "new_iso_timestamp",
    "endTime": "new_iso_timestamp"
  }
}
```


---

### Outbound: Real-time Updates

Broadcasted to all connected Editors and Admins in a workspace when data changes.

```json
{
  "event": "EVENT_UPDATED",
  "payload": {
    "eventId": "uuid",
    "actor": { "name": "Ahsan Ali", "id": "uuid" },
    "changes": { "startTime": "2026-05-11T15:00:00Z" }
  }
}
```

| Outbound Event | When | Payload |
|----------------|------|---------|
| `EVENT_CREATED` | New event added | Full event object |
| `EVENT_UPDATED` | Event modified | `{ eventId, actor, changes }` |
| `EVENT_DELETED` | Event removed | `{ eventId, actor }` |
| `USER_ONLINE`  | User connected | `{ userId, name }` |
| `USER_OFFLINE` | User disconnected | `{ userId }` |
| `MEMBER_ADDED` | New member joined | `{ userId, name, role }` |
| `MEMBER_REMOVED` | Member removed | `{ userId }` |
| `MEMBER_UPDATED` | Role changed | `{ userId, newRole }` |


---

### Outbound: Auth Bridge Success

Sent to the Web UI when the Mobile app approves a QR scan.

```json
{
  "event": "AUTH_COMPLETE",
  "payload": {
    "sessionToken": "new_jwt_token",
    "userId": "uuid"
  }
}
```


---

### Connection Lifecycle

| Phase | Detail |
|-------|--------|
| **Connect** | Client opens WebSocket to `wss://api.yourdomain.com/realtime` |
| **Handshake** | Client sends `SUBSCRIBE` with workspaceId + token |
| **Heartbeat** | Server pings every 30s. Client must pong within 10s or connection dropped. |
| **Reconnect** | Client should implement exponential backoff (1s, 2s, 4s, 8s, max 30s) |
| **Disconnect** | Server broadcasts `USER_OFFLINE` to workspace |
| **Rate limit** | Max 5 concurrent connections per user |


---

## 📤 7. Public Sharing — `/api/share`


---

### `POST /share/calendar/:id`

Generate a cryptographically secure public hash for a calendar view.

**Headers:** `Authorization: Bearer <session_token>`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `password` | string | No       | Optional password protection |
| `expiresAt` | ISO-8601 | No       | Optional expiration (max 365 days from now) |

**Response** `**201**`**:**

```json
{
  "shareUrl": "https://cal.yourdomain.com/p/hash_value",
  "hash": "hash_value",
  "expiresAt": "2026-05-17T00:00:00Z",
  "hasPassword": true
}
```

**Backend:** `crypto.randomBytes(32).toString('hex')` — stored hashed in DB.


---

### `DELETE /share/:hash`

Revoke a shared link.

**Headers:** `Authorization: Bearer <session_token>`

**Response** `**200**`**:**

```json
{ "status": "revoked" }
```


---

### `GET /share/calendar/:id/links`

List all active share links for a calendar.

**Headers:** `Authorization: Bearer <session_token>`

**Response** `**200**`**:**

```json
[
  {
    "hash": "abc123...",
    "createdAt": "2026-05-10T00:00:00Z",
    "expiresAt": "2026-05-17T00:00:00Z",
    "hasPassword": true,
    "viewCount": 42
  }
]
```


---

### `POST /share/verify/:hash`

Verify a password for a locked public link. Public endpoint — no auth required.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `password` | string | Yes      | The password set during creation |

**Response** `**200**`**:**

```json
{
  "valid": true,
  "tempToken": "access_jwt",
  "expiresIn": 3600
}
```

**Response** `**401**`**:**

```json
{
  "error": { "code": "UNAUTHORIZED", "message": "Invalid password" }
}
```


---

### `GET /p/:hash`

Public calendar view. No auth required. Returns rendered event data.

**Query Params:** None (hash in URL path)

**Response** `**200**`**:** Same format as `GET /events` but scoped to the shared calendar.


---

### `GET /e/:hash`

Single event landing page. No auth required.

**Response** `**200**`**:**

```json
{
  "event": {
    "id": "uuid",
    "title": "Event Title",
    "start": "ISO",
    "end": "ISO",
    "description": "Markdown",
    "location": "Virtual"
  },
  "icsDownloadUrl": "/api/share/e/hash_value/ics"
}
```


---

## 🚑 8. System & Health — `/api/system`


---

### `GET /health`

Used by Dokploy/Docker for container health checks. No auth required.

**Response** `**200**`**:**

```json
{
  "status": "healthy",
  "postgres": "connected",
  "redis": "connected",
  "uptime": 86400,
  "version": "1.0.0"
}
```

**Response** `**503**`**:** Any dependency is down.


---

### `GET /system/metrics`

Instance admin metrics. Auth required (Instance Admin only).

**Response** `**200**`**:**

```json
{
  "totalUsers": 42,
  "totalEvents": 1500,
  "totalWorkspaces": 8,
  "activeWsConnections": 12,
  "databaseSizeMb": 256,
  "redisMemoryMb": 45,
  "requestsLastMinute": 34
}
```


---

## ✅ API Contract Checklist

### Auth Endpoints

- [ ] `POST /auth/register` — Account creation
- [ ] `POST /auth/login` — Email/password
- [ ] `POST /auth/qr/init` — Generate QR challenge
- [ ] `POST /auth/qr/approve` — Mobile approves QR
- [ ] `POST /auth/logout` — Invalidate session
- [ ] `GET /auth/sessions` — Device ledger
- [ ] `DELETE /auth/sessions/:id` — Revoke single session
- [ ] `DELETE /auth/sessions` — Panic revoke all

### Workspace Endpoints

- [ ] `GET /workspaces` — List workspaces
- [ ] `POST /workspaces` — Create workspace
- [ ] `PATCH /workspaces/:id` — Update settings
- [ ] `DELETE /workspaces/:id` — Delete (Owner only)
- [ ] `GET /workspaces/:id/members` — List members
- [ ] `PATCH /workspaces/:id/members/:userId` — Update role
- [ ] `DELETE /workspaces/:id/members/:userId` — Remove member
- [ ] `POST /workspaces/:id/invites` — Generate invite link

### Event Endpoints

- [ ] `GET /events` — Fetch timeframe
- [ ] `POST /events` — Create with conflict detection
- [ ] `GET /events/:id` — Single event
- [ ] `PATCH /events/:id` — Update
- [ ] `DELETE /events/:id` — Delete with recurrence scope

### Search

- [ ] `GET /search` — PostgreSQL FTS

### MCP

- [ ] `GET /mcp/sse` — SSE stream with Bearer auth
- [ ] `POST /mcp/message` — JSON-RPC gateway

### WebSocket

- [ ] `SUBSCRIBE` handshake with workspaceId + token
- [ ] `EVENT_MOVE` inbound
- [ ] `EVENT_CREATED / UPDATED / DELETED` outbound
- [ ] `USER_ONLINE / OFFLINE` presence
- [ ] `MEMBER_ADDED / REMOVED / UPDATED` workspace events
- [ ] `AUTH_COMPLETE` QR bridge event
- [ ] Heartbeat (30s interval, 10s timeout)
- [ ] Exponential backoff reconnect

### Sharing

- [ ] `POST /share/calendar/:id` — Generate link
- [ ] `DELETE /share/:hash` — Revoke
- [ ] `GET /share/calendar/:id/links` — List links
- [ ] `POST /share/verify/:hash` — Password verify
- [ ] `GET /p/:hash` — Public calendar view
- [ ] `GET /e/:hash` — Single event landing page

### System

- [ ] `GET /health` — Docker health check
- [ ] `GET /system/metrics` — Admin metrics
