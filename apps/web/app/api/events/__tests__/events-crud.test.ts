// ─── Events CRUD Tests ───
// Source: docs/03-api-websocket-contract.md §3 — Calendars & Events
// Acceptance criteria:
//   GET: returns events in time range with idx_events_time_range conditions
//   POST: creates event with conflict detection
//   VIEWER gets 403 on create
//   PATCH: updates event
//   DELETE: soft delete (sets deletedAt, not hard DELETE)
//   Recurring: singleInstance creates child override with baseEventId

import { describe, it, expect, beforeAll, vi } from "vitest";
import { NextRequest } from "next/server";

// ─── Mocks ───

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock("@novacal/db/client", () => ({
  db: mockDb,
}));

const mockSchema = {
  events: { id: "events.id", calendarId: "events.calendarId", creatorId: "events.creatorId", title: "events.title", description: "events.description", location: "events.location", startTime: "events.startTime", endTime: "events.endTime", isAllDay: "events.isAllDay", timezone: "events.timezone", rrule: "events.rrule", baseEventId: "events.baseEventId", deletedAt: "events.deletedAt", createdAt: "events.createdAt", updatedAt: "events.updatedAt" },
  calendars: { id: "cal.id", workspaceId: "cal.workspaceId", name: "cal.name", color: "cal.color" },
  eventAttendees: { eventId: "ea.eventId", userId: "ea.userId", email: "ea.email", rsvpStatus: "ea.rsvpStatus" },
  users: { id: "users.id", name: "users.name", email: "users.email" },
};

vi.mock("@novacal/db/schema", () => mockSchema);

const mockErrors = {
  errorResponse: vi.fn((code, msg, status?, details?) =>
    new Response(JSON.stringify({ error: { code, message: msg, details: details ?? {} } }), {
      status: status ?? 400,
      headers: { "Content-Type": "application/json" },
    }),
  ),
  handleApiError: vi.fn((err: unknown) => {
    const e = err as { code?: string; statusCode?: number; message?: string };
    return new Response(
      JSON.stringify({ error: { code: e.code ?? "INTERNAL_ERROR", message: e.message ?? "Error", details: {} } }),
      { status: e.statusCode ?? 500, headers: { "Content-Type": "application/json" } },
    );
  }),
  ERROR_CODES: {
    VALIDATION_ERROR: "VALIDATION_ERROR",
    CONFLICT: "CONFLICT",
    UNAUTHORIZED: "UNAUTHORIZED",
    INTERNAL_ERROR: "INTERNAL_ERROR",
    RATE_LIMITED: "RATE_LIMITED",
    NOT_FOUND: "NOT_FOUND",
    FORBIDDEN: "FORBIDDEN",
  },
};

vi.mock("@/lib/errors", () => mockErrors);
vi.mock("../../../../../lib/errors", () => mockErrors);

const mockValidateSession = vi.fn();
vi.mock("@/lib/validate-session", () => ({
  validateSession: mockValidateSession,
}));

const mockRequireEditor = vi.fn();
const mockRequireRole = vi.fn();
vi.mock("@/lib/rbac", () => ({
  requireEditor: mockRequireEditor,
  requireRole: mockRequireRole,
}));

const mockParseISODate = vi.fn((s: string) => new Date(s));
const mockValidateTimeRange = vi.fn();
vi.mock("@/lib/iso-8601", () => ({
  parseISODate: mockParseISODate,
  validateTimeRange: mockValidateTimeRange,
}));

const mockPublishWsEvent = vi.fn();
vi.mock("@/lib/redis", () => ({
  publishWorkspaceEvent: mockPublishWsEvent,
}));

vi.mock("@novacal/shared", () => ({
  WS_EVENTS: { EVENT_CREATED: "event.created", EVENT_UPDATED: "event.updated", EVENT_DELETED: "event.deleted" },
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 200,
  ROLE_HIERARCHY: { OWNER: 100, ADMIN: 80, EDITOR: 60, VIEWER: 40, FREE_BUSY: 20 },
}));

const { GET, POST } = await import("../route");
const { GET: GET_BY_ID, PATCH, DELETE } = await import("../[id]/route");

// ─── Helpers ───

function createGetRequest(token: string, start: string, end: string, params?: Record<string, string>): NextRequest {
  const url = new URL("http://localhost:3000/api/events");
  url.searchParams.set("start", start);
  url.searchParams.set("end", end);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  return new NextRequest(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
}

function createPostRequest(token: string, body: unknown, workspaceId?: string): NextRequest {
  const headers = new Headers({ "Content-Type": "application/json", Authorization: `Bearer ${token}` });
  if (workspaceId) headers.set("X-Workspace-Id", workspaceId);
  return new NextRequest(new URL("http://localhost:3000/api/events"), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function createPatchRequest(token: string, eventId: string, body: unknown): NextRequest {
  return new NextRequest(new URL(`http://localhost:3000/api/events/${eventId}`), {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createDeleteRequest(token: string, eventId: string, scope?: string): NextRequest {
  const url = new URL(`http://localhost:3000/api/events/${eventId}`);
  if (scope) url.searchParams.set("scope", scope);
  return new NextRequest(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

describe("Events CRUD", () => {
  beforeAll(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/events", () => {
    it("should return events in time range with pagination", async () => {
      mockValidateSession.mockResolvedValue({ userId: "user-1", userName: "Ahsan", userEmail: "ahsan@test.com" });
      mockParseISODate.mockImplementation((s: string) => new Date(s));

      const mockRows = [
        { id: "evt-1", calendarId: "cal-1", title: "Meeting", description: null, location: null, startTime: new Date("2026-05-10T09:00:00Z"), endTime: new Date("2026-05-10T10:00:00Z"), isAllDay: false, timezone: null, rrule: null, createdAt: new Date(), updatedAt: new Date(), createdBy: { id: "user-1", name: "Ahsan" }, color: "#6366F1" },
      ];

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockRows),
      });

      // Attendees query returns empty
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      });

      const req = createGetRequest("valid-token", "2026-05-10T00:00:00Z", "2026-05-17T00:00:00Z");
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
      if (body.length > 0) {
        expect(body[0]).toHaveProperty("id");
        expect(body[0]).toHaveProperty("title");
        expect(body[0]).toHaveProperty("start");
        expect(body[0]).toHaveProperty("end");
        expect(body[0]).toHaveProperty("attendees");
      }
    });

    it("should return 400 when start/end params are missing", async () => {
      mockValidateSession.mockResolvedValue({ userId: "user-1", userName: "Ahsan", userEmail: "ahsan@test.com" });

      const req = new NextRequest(new URL("http://localhost:3000/api/events"), {
        method: "GET",
        headers: { Authorization: "Bearer token" },
      });
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("POST /api/events", () => {
    it("should create event with conflict detection", async () => {
      mockValidateSession.mockResolvedValue({ userId: "editor-1", userName: "Editor", userEmail: "editor@test.com" });
      mockRequireEditor.mockResolvedValue(undefined);
      mockParseISODate.mockImplementation((s: string) => new Date(s));
      mockValidateTimeRange.mockReturnValue(undefined);

      // Calendar lookup
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: "cal-1", workspaceId: "ws-1" }]),
      });

      // Conflict detection returns empty
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      });

      // Insert event
      const mockInserted = { id: "evt-1", calendarId: "cal-1", title: "Strategy Sync", startTime: new Date("2026-05-11T14:00:00Z"), endTime: new Date("2026-05-11T15:00:00Z") };
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockInserted]),
        }),
      });

      mockPublishWsEvent.mockResolvedValue(undefined);

      const req = createPostRequest(
        "editor-token",
        { calendarId: "cal-1", title: "Strategy Sync", startTime: "2026-05-11T14:00:00Z", endTime: "2026-05-11T15:00:00Z" },
        "ws-1",
      );
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.id).toBe("evt-1");
      expect(body.title).toBe("Strategy Sync");
      expect(body).toHaveProperty("conflicts");
      expect(mockPublishWsEvent).toHaveBeenCalledWith("ws-1", "event.created", expect.any(Object));
    });

    it("should return 403 when VIEWER tries to create event", async () => {
      mockValidateSession.mockResolvedValue({ userId: "viewer-1", userName: "Viewer", userEmail: "viewer@test.com" });
      mockRequireEditor.mockRejectedValue(
        new (class extends Error {
          code = "FORBIDDEN";
          statusCode = 403;
          details = {};
          constructor() {
            super("Insufficient permissions");
            this.name = "ApiRequestError";
          }
        })(),
      );

      const req = createPostRequest(
        "viewer-token",
        { calendarId: "cal-1", title: "Hacked Event", startTime: "2026-05-11T14:00:00Z", endTime: "2026-05-11T15:00:00Z" },
        "ws-1",
      );
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("should return 400 when X-Workspace-Id header is missing", async () => {
      mockValidateSession.mockResolvedValue({ userId: "editor-1", userName: "Editor", userEmail: "editor@test.com" });

      const req = createPostRequest(
        "editor-token",
        { calendarId: "cal-1", title: "Test", startTime: "2026-05-11T14:00:00Z", endTime: "2026-05-11T15:00:00Z" },
      );
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("PATCH /api/events/:id", () => {
    it("should update an event and broadcast EVENT_UPDATED", async () => {
      mockValidateSession.mockResolvedValue({ userId: "editor-1", userName: "Editor", userEmail: "editor@test.com" });

      // Fetch existing event
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: "evt-1", calendarId: "cal-1", title: "Old Title", startTime: new Date("2026-05-11T14:00:00Z"), endTime: new Date("2026-05-11T15:00:00Z"), rrule: null, baseEventId: null, deletedAt: null }]),
      });

      // Resolve workspace
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ workspaceId: "ws-1" }]),
      });

      mockRequireEditor.mockResolvedValue(undefined);

      const updated = { id: "evt-1", title: "Updated Title", startTime: new Date("2026-05-11T15:00:00Z"), endTime: new Date("2026-05-11T16:00:00Z") };
      mockDb.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updated]),
          }),
        }),
      });

      mockPublishWsEvent.mockResolvedValue(undefined);

      const req = createPatchRequest("editor-token", "evt-1", { title: "Updated Title" });
      const res = await PATCH(req, { params: Promise.resolve({ id: "evt-1" }) });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.title).toBe("Updated Title");
      expect(mockPublishWsEvent).toHaveBeenCalledWith("ws-1", "event.updated", expect.any(Object));
    });

    it("should create child override for single-instance recurring edit", async () => {
      mockValidateSession.mockResolvedValue({ userId: "editor-1", userName: "Editor", userEmail: "editor@test.com" });

      // Existing recurring event
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: "parent-evt", calendarId: "cal-1", title: "Weekly Standup", startTime: new Date("2026-05-11T09:00:00Z"), endTime: new Date("2026-05-11T09:30:00Z"), rrule: "FREQ=WEEKLY;BYDAY=MO", baseEventId: null, deletedAt: null }]),
      });

      // Resolve workspace
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ workspaceId: "ws-1" }]),
      });

      mockRequireEditor.mockResolvedValue(undefined);

      const child = { id: "child-evt", title: "Weekly Standup", startTime: new Date("2026-05-11T10:00:00Z"), endTime: new Date("2026-05-11T10:30:00Z") };
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([child]),
        }),
      });

      mockPublishWsEvent.mockResolvedValue(undefined);

      const req = createPatchRequest("editor-token", "parent-evt", { title: "Weekly Standup", startTime: "2026-05-11T10:00:00Z", endTime: "2026-05-11T10:30:00Z", singleInstance: true });
      const res = await PATCH(req, { params: Promise.resolve({ id: "parent-evt" }) });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.id).toBe("child-evt");
      expect(body.baseEventId).toBe("parent-evt");
    });
  });

  describe("DELETE /api/events/:id", () => {
    it("should soft delete event (set deletedAt, not hard delete)", async () => {
      mockValidateSession.mockResolvedValue({ userId: "editor-1", userName: "Editor", userEmail: "editor@test.com" });

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: "evt-1", calendarId: "cal-1", rrule: null, baseEventId: null, startTime: new Date(), deletedAt: null }]),
      });

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ workspaceId: "ws-1" }]),
      });

      mockRequireEditor.mockResolvedValue(undefined);

      mockDb.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      mockPublishWsEvent.mockResolvedValue(undefined);

      const req = createDeleteRequest("editor-token", "evt-1");
      const res = await DELETE(req, { params: Promise.resolve({ id: "evt-1" }) });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.status).toBe("deleted");
      expect(body.scope).toBe("single");

      // Verify it was an update (soft delete), not a delete
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should return 200 with scope=single for basic delete", async () => {
      mockValidateSession.mockResolvedValue({ userId: "editor-1", userName: "Editor", userEmail: "editor@test.com" });

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: "evt-1", calendarId: "cal-1", rrule: null, baseEventId: null, startTime: new Date(), deletedAt: null }]),
      });

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ workspaceId: "ws-1" }]),
      });

      mockRequireEditor.mockResolvedValue(undefined);
      mockDb.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });
      mockPublishWsEvent.mockResolvedValue(undefined);

      const req = createDeleteRequest("editor-token", "evt-1", "single");
      const res = await DELETE(req, { params: Promise.resolve({ id: "evt-1" }) });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.status).toBe("deleted");
      expect(body.scope).toBe("single");
    });
  });
});
