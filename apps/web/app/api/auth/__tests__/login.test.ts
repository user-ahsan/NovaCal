// ─── POST /api/auth/login Tests ───
// Source: docs/03-api-websocket-contract.md §1 — POST /auth/login
// Acceptance criteria:
//   - Valid credentials return user + sessionToken + activeWorkspaceId
//   - Invalid password returns UNAUTHORIZED
//   - Missing user returns UNAUTHORIZED
//   - Rate limited at 10 req/min per IP

import { describe, it, expect, beforeAll, vi } from "vitest";
import { NextRequest } from "next/server";

// ─── Mocks ───

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
};

vi.mock("@novacal/db/client", () => ({
  db: mockDb,
}));

const mockSchema = {
  users: { id: "users.id", email: "users.email", name: "users.name", passwordHash: "users.passwordHash" },
  sessions: { id: "sessions.id", userId: "sessions.userId" },
  workspaceMembers: { workspaceId: "wm.workspaceId", role: "wm.role" },
};

vi.mock("@novacal/db/schema", () => mockSchema);

const mockBcrypt = { compare: vi.fn() };
vi.mock("bcryptjs", () => ({
  default: mockBcrypt,
  compare: mockBcrypt.compare,
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
    VALIDATION_ERROR: "VALIDATION_ERROR",
    CONFLICT: "CONFLICT",
    UNAUTHORIZED: "UNAUTHORIZED",
    INTERNAL_ERROR: "INTERNAL_ERROR",
    RATE_LIMITED: "RATE_LIMITED",
    NOT_FOUND: "NOT_FOUND",
    FORBIDDEN: "FORBIDDEN",
  },
};

vi.mock("../../../../../lib/errors", () => mockErrors);

const mockAuth = {
  generateSessionToken: vi.fn(() => "session-token-xyz"),
  getClientIp: vi.fn(() => "127.0.0.1"),
  checkRateLimit: vi.fn(),
};

vi.mock("../../../../../lib/auth", () => mockAuth);

const { POST } = await import("../login/route");

function createRequest(body: unknown): NextRequest {
  return new NextRequest(new URL("http://localhost:3000/api/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "127.0.0.1" },
    body: JSON.stringify(body),
  });
}

const mockUserRecord = {
  id: "user-1",
  email: "ahsan@domain.com",
  name: "Ahsan Ali",
  passwordHash: "$2a$12$hashedpassword",
};

describe("POST /api/auth/login", () => {
  beforeAll(() => {
    vi.clearAllMocks();
  });

  describe("Success cases", () => {
    it("should return 200 with user, sessionToken, and activeWorkspaceId for valid credentials", async () => {
      mockAuth.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 9 });

      // Find user
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockUserRecord]),
      });

      // Verify password
      mockBcrypt.compare.mockResolvedValue(true);

      // Find workspace membership
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ workspaceId: "ws-1", role: "OWNER" }]),
      });

      // Create session
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockResolvedValue(undefined),
      });

      const req = createRequest({ email: "ahsan@domain.com", password: "correct-password" });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.user).toEqual({ id: "user-1", email: "ahsan@domain.com", name: "Ahsan Ali", role: "OWNER" });
      expect(body.sessionToken).toBe("session-token-xyz");
      expect(body.activeWorkspaceId).toBe("ws-1");
    });

    it("should default to OWNER role when user has no workspace membership", async () => {
      mockAuth.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 9 });

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockUserRecord]),
      });

      mockBcrypt.compare.mockResolvedValue(true);

      // No workspace membership
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      });

      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockResolvedValue(undefined),
      });

      const req = createRequest({ email: "ahsan@domain.com", password: "correct-password" });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.user.role).toBe("OWNER");
      expect(body.activeWorkspaceId).toBeNull();
    });
  });

  describe("Error cases", () => {
    it("should return 401 UNAUTHORIZED for non-existent user", async () => {
      mockAuth.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 9 });

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      });

      const req = createRequest({ email: "nobody@domain.com", password: "any-password" });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("should return 401 UNAUTHORIZED for invalid password", async () => {
      mockAuth.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 9 });

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockUserRecord]),
      });

      mockBcrypt.compare.mockResolvedValue(false);

      const req = createRequest({ email: "ahsan@domain.com", password: "wrong-password" });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("should return 400 VALIDATION_ERROR for malformed email", async () => {
      mockAuth.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 9 });

      const req = createRequest({ email: "not-an-email", password: "password123" });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should return 429 when rate limited", async () => {
      mockAuth.checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });

      const req = createRequest({ email: "test@example.com", password: "password123" });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(429);
      expect(body.error.code).toBe("RATE_LIMITED");
    });
  });

  describe("Error format compliance", () => {
    it("should return standard error format", async () => {
      mockAuth.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 9 });

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      });

      const req = createRequest({ email: "nobody@domain.com", password: "pw" });
      const res = await POST(req);
      const body = await res.json();

      expect(body).toHaveProperty("error");
      expect(body.error).toHaveProperty("code");
      expect(body.error).toHaveProperty("message");
      expect(body.error).toHaveProperty("details");
    });
  });
});
