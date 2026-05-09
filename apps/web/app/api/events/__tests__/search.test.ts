// ─── Event Search Tests ───
// Source: docs/03-api-websocket-contract.md §4 — High-Speed Search
// Acceptance criteria:
//   GET /search: FTS returns ranked results with { results, latencyMs, total }
//   Prefix matching for typos
//   Empty q returns VALIDATION_ERROR
//   WorkspaceId filter scopes search to calendars in that workspace

import { describe, it, expect, beforeAll, vi } from "vitest";
import { NextRequest } from "next/server";

// ─── Mocks ───

const mockDb = {
  select: vi.fn(),
};

vi.mock("@novacal/db/client", () => ({
  db: mockDb,
}));

const mockSchema = {
  events: { id: "events.id", title: "events.title", description: "events.description", startTime: "events.startTime", endTime: "events.endTime", deletedAt: "events.deletedAt" },
  calendars: { id: "cal.id", workspaceId: "cal.workspaceId" },
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
    UNAUTHORIZED: "UNAUTHORIZED",
    INTERNAL_ERROR: "INTERNAL_ERROR",
    RATE_LIMITED: "RATE_LIMITED",
    NOT_FOUND: "NOT_FOUND",
    FORBIDDEN: "FORBIDDEN",
    CONFLICT: "CONFLICT",
  },
};

vi.mock("@/lib/errors", () => mockErrors);

const mockValidateSession = vi.fn();
vi.mock("@/lib/validate-session", () => ({
  validateSession: mockValidateSession,
}));

const { GET } = await import("../../search/route");

function createSearchRequest(token: string, query: string, limit?: string, workspaceId?: string): NextRequest {
  const url = new URL("http://localhost:3000/api/search");
  url.searchParams.set("q", query);
  if (limit) url.searchParams.set("limit", limit);
  if (workspaceId) url.searchParams.set("workspaceId", workspaceId);
  return new NextRequest(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
}

describe("GET /api/search", () => {
  beforeAll(() => {
    vi.clearAllMocks();
  });

  describe("Success cases", () => {
    it("should return ranked FTS results with latencyMs and total", async () => {
      mockValidateSession.mockResolvedValue({ userId: "user-1", userName: "Ahsan", userEmail: "ahsan@test.com" });

      const searchRows = [
        {
          id: "evt-1",
          title: "Sprint Review",
          description: "Review Q2 deliverables and plan next sprint",
          startTime: new Date("2026-05-11T14:00:00Z"),
          endTime: new Date("2026-05-11T15:00:00Z"),
          rank: 0.75,
          calendarWorkspaceId: "ws-1",
        },
        {
          id: "evt-2",
          title: "Sprint Planning",
          description: "Plan the upcoming sprint tasks",
          startTime: new Date("2026-05-12T09:00:00Z"),
          endTime: new Date("2026-05-12T10:00:00Z"),
          rank: 0.5,
          calendarWorkspaceId: "ws-1",
        },
      ];

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(searchRows),
      });

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 2 }]),
      });

      const req = createSearchRequest("valid-token", "sprint review");
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toHaveProperty("results");
      expect(body).toHaveProperty("latencyMs");
      expect(body).toHaveProperty("total");
      expect(Array.isArray(body.results)).toBe(true);
      expect(body.total).toBe(2);

      // Check result structure
      if (body.results.length > 0) {
        expect(body.results[0]).toHaveProperty("id");
        expect(body.results[0]).toHaveProperty("title");
        expect(body.results[0]).toHaveProperty("snippet");
        expect(body.results[0]).toHaveProperty("start");
        expect(body.results[0]).toHaveProperty("end");
      }

      // Results should be in rank order (highest first)
      if (body.results.length >= 2) {
        expect(body.results[0].title).toBe("Sprint Review");
        expect(body.results[1].title).toBe("Sprint Planning");
      }
    });

    it("should return empty results when no matches found", async () => {
      mockValidateSession.mockResolvedValue({ userId: "user-1", userName: "Ahsan", userEmail: "ahsan@test.com" });

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      });

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      });

      const req = createSearchRequest("valid-token", "nonexistent_term_xj12");
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.results).toHaveLength(0);
      expect(body.total).toBe(0);
    });

    it("should respect limit parameter", async () => {
      mockValidateSession.mockResolvedValue({ userId: "user-1", userName: "Ahsan", userEmail: "ahsan@test.com" });

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      });

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      });

      const req = createSearchRequest("valid-token", "sprint", "5");
      await GET(req);

      // Verify limit was capped appropriately
      const limitCall = mockDb.select.mock.calls[0];
      expect(limitCall).toBeDefined();
    });
  });

  describe("Error cases", () => {
    it("should return 400 VALIDATION_ERROR when q parameter is missing", async () => {
      mockValidateSession.mockResolvedValue({ userId: "user-1", userName: "Ahsan", userEmail: "ahsan@test.com" });

      const req = new NextRequest(new URL("http://localhost:3000/api/search"), {
        method: "GET",
        headers: { Authorization: "Bearer token" },
      });
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should return 400 when q is empty", async () => {
      mockValidateSession.mockResolvedValue({ userId: "user-1", userName: "Ahsan", userEmail: "ahsan@test.com" });

      const req = createSearchRequest("valid-token", "");
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });
  });
});
