// ─── Auth Sessions Tests ───
// Source: docs/03-api-websocket-contract.md §1 — GET /auth/sessions & DELETE /auth/sessions
// Acceptance criteria:
//   GET /auth/sessions: returns device ledger with isCurrent flag
//   DELETE /auth/sessions: revokes all sessions except current, returns { status, count }
//   Rate limit: 11th request returns 429 (10 req/min per IP on auth endpoints)

import { describe, it, expect, beforeAll, vi } from "vitest";
import { NextRequest } from "next/server";

// ─── Mocks ───

const mockDb = {
  select: vi.fn(),
  delete: vi.fn(),
};

vi.mock("@novacal/db/client", () => ({
  db: mockDb,
}));

vi.mock("@novacal/db/schema", () => ({
  sessions: { id: "sessions.id", userId: "sessions.userId", deviceInfo: "sessions.deviceInfo", ipAddress: "sessions.ipAddress", createdAt: "sessions.createdAt", expiresAt: "sessions.expiresAt" },
}));

const mockErrors = {
  errorResponse: vi.fn((code, msg, status?, details?) =>
    new Response(JSON.stringify({ error: { code, message: msg, details: details ?? {} } }), {
      status: status ?? 400,
      headers: { "Content-Type": "application/json" },
    }),
  ),
  handleApiError: vi.fn((err: unknown) =>
    new Response(JSON.stringify({ error: { code: "INTERNAL_ERROR", message: (err as Error).message, details: {} } }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    }),
  ),
  ERROR_CODES: {
    UNAUTHORIZED: "UNAUTHORIZED",
    VALIDATION_ERROR: "VALIDATION_ERROR",
    CONFLICT: "CONFLICT",
    INTERNAL_ERROR: "INTERNAL_ERROR",
    RATE_LIMITED: "RATE_LIMITED",
    NOT_FOUND: "NOT_FOUND",
    FORBIDDEN: "FORBIDDEN",
  },
};

vi.mock("../../../../../lib/errors", () => mockErrors);

const mockValidateSession = vi.fn();
vi.mock("../../../../../lib/validate-session", () => ({
  validateSession: mockValidateSession,
}));

const { GET, DELETE } = await import("../sessions/route");

function createGetRequest(token: string): NextRequest {
  return new NextRequest(new URL("http://localhost:3000/api/auth/sessions"), {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
}

function createDeleteRequest(token: string): NextRequest {
  return new NextRequest(new URL("http://localhost:3000/api/auth/sessions"), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

const mockSessionData = [
  { id: "session-1", device: "Chrome on Windows", ip: "192.168.1.1", lastActive: new Date("2026-05-10T12:00:00Z"), createdAt: new Date("2026-05-01T08:00:00Z") },
  { id: "session-current", device: "Firefox on Linux", ip: "10.0.0.1", lastActive: new Date("2026-05-10T14:00:00Z"), createdAt: new Date("2026-05-05T10:00:00Z") },
  { id: "session-3", device: "NovaCal Android", ip: "192.168.1.5", lastActive: new Date("2026-05-09T09:00:00Z"), createdAt: new Date("2026-05-03T16:00:00Z") },
];

describe("Auth Sessions", () => {
  beforeAll(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/auth/sessions", () => {
    it("should return device ledger array with isCurrent flag", async () => {
      mockValidateSession.mockResolvedValue({ userId: "user-1", userName: "Ahsan", userEmail: "ahsan@test.com" });
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockSessionData),
      });

      const req = createGetRequest("session-current");
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(3);

      // Current session should have isCurrent: true
      const currentSession = body.find((s: { id: string }) => s.id === "session-current");
      expect(currentSession).toBeDefined();
      expect(currentSession.isCurrent).toBe(true);

      // Other sessions should have isCurrent: false
      const nonCurrentSession = body.find((s: { id: string }) => s.id === "session-1");
      expect(nonCurrentSession).toBeDefined();
      expect(nonCurrentSession.isCurrent).toBe(false);

      // Verify structure
      for (const session of body) {
        expect(session).toHaveProperty("id");
        expect(session).toHaveProperty("device");
        expect(session).toHaveProperty("ip");
        expect(session).toHaveProperty("lastActive");
        expect(session).toHaveProperty("createdAt");
        expect(session).toHaveProperty("isCurrent");
      }
    });

    it("should return 401 when token is invalid", async () => {
      mockValidateSession.mockRejectedValue(
        new (class extends Error {
          code = "UNAUTHORIZED";
          statusCode = 401;
          details = {};
          constructor() {
            super("Session token is invalid or expired");
            this.name = "ApiRequestError";
          }
        })(),
      );

      const req = createGetRequest("invalid-token");
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("DELETE /api/auth/sessions (revoke all)", () => {
    it("should revoke all sessions except current and return count", async () => {
      mockValidateSession.mockResolvedValue({ userId: "user-1", userName: "Ahsan", userEmail: "ahsan@test.com" });
      mockDb.delete.mockReturnValueOnce({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            { id: "session-1" },
            { id: "session-3" },
          ]),
        }),
      });

      const req = createDeleteRequest("session-current");
      const res = await DELETE(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.status).toBe("all_revoked");
      expect(body.count).toBe(2);
    });

    it("should return 401 when token is invalid", async () => {
      mockValidateSession.mockRejectedValue(
        new (class extends Error {
          code = "UNAUTHORIZED";
          statusCode = 401;
          details = {};
          constructor() {
            super("Session token is invalid or expired");
            this.name = "ApiRequestError";
          }
        })(),
      );

      const req = createDeleteRequest("invalid-token");
      const res = await DELETE(req);
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });
  });
});
