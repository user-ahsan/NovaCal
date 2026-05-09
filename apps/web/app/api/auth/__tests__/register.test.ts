// ─── POST /api/auth/register Tests ───
// Source: docs/03-api-websocket-contract.md §1 — POST /auth/register
// Acceptance criteria:
//   - Valid input creates user + session, returns 201
//   - Invalid email returns VALIDATION_ERROR
//   - Duplicate email returns CONFLICT
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

vi.mock("@novacal/db/schema", () => ({
  users: { id: "users.id", email: "users.email", name: "users.name" },
  sessions: { id: "sessions.id", userId: "sessions.userId" },
}));

const mockBcrypt = { hash: vi.fn() };
vi.mock("bcryptjs", () => ({
  default: mockBcrypt,
  hash: mockBcrypt.hash,
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
  generateSessionToken: vi.fn(() => "test-session-token-abc123"),
  getClientIp: vi.fn(() => "127.0.0.1"),
  checkRateLimit: vi.fn(),
};

vi.mock("../../../../../lib/auth", () => mockAuth);

// Import the route handler after all mocks
const { POST } = await import("../register/route");

function createRequest(body: unknown, ip = "127.0.0.1"): NextRequest {
  const url = new URL("http://localhost:3000/api/auth/register");
  const headers = new Headers({ "Content-Type": "application/json" });
  if (ip) headers.set("x-forwarded-for", ip);
  return new NextRequest(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/register", () => {
  beforeAll(() => {
    vi.clearAllMocks();
  });

  describe("Success cases", () => {
    it("should create a user and session with valid input, returning 201", async () => {
      mockAuth.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 9 });

      // No existing user
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      });

      mockBcrypt.hash.mockResolvedValue("hashed_password_rounds12");

      const mockUser = { id: "user-uuid", email: "test@example.com", name: "Test User" };
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockUser]),
      });

      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockResolvedValue(undefined),
      });

      const req = createRequest({ email: "test@example.com", password: "password123", name: "Test User" });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.user).toEqual({ id: "user-uuid", email: "test@example.com", name: "Test User" });
      expect(body.sessionToken).toBe("test-session-token-abc123");
      expect(mockBcrypt.hash).toHaveBeenCalledWith("password123", 12);
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });
  });

  describe("Validation errors", () => {
    it("should return 400 VALIDATION_ERROR for invalid email", async () => {
      mockAuth.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 9 });

      const req = createRequest({ email: "not-an-email", password: "password123", name: "Test" });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should return 400 VALIDATION_ERROR for short password", async () => {
      mockAuth.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 9 });

      const req = createRequest({ email: "test@example.com", password: "123", name: "Test" });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should return 400 VALIDATION_ERROR for missing name", async () => {
      mockAuth.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 9 });

      const req = createRequest({ email: "test@example.com", password: "password123", name: "" });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should return 400 VALIDATION_ERROR for missing fields", async () => {
      mockAuth.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 9 });

      const req = createRequest({});
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("Conflict detection", () => {
    it("should return 409 CONFLICT when email already exists", async () => {
      mockAuth.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 9 });

      // Existing user found
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: "existing-uuid" }]),
      });

      const req = createRequest({ email: "existing@example.com", password: "password123", name: "Existing" });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(409);
      expect(body.error.code).toBe("CONFLICT");
      expect(body.error.message).toContain("already exists");
    });
  });

  describe("Rate limiting", () => {
    it("should return 429 RATE_LIMITED when rate limit exceeded", async () => {
      mockAuth.checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });

      const req = createRequest({ email: "test@example.com", password: "password123", name: "Test" });
      const res = await POST(req);
      const body = await res.json();

      expect(res.status).toBe(429);
      expect(body.error.code).toBe("RATE_LIMITED");
    });
  });

  describe("Error format compliance", () => {
    it("should return standard error format with code, message, details", async () => {
      mockAuth.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 9 });

      const req = createRequest({});
      const res = await POST(req);
      const body = await res.json();

      expect(body).toHaveProperty("error");
      expect(body.error).toHaveProperty("code");
      expect(body.error).toHaveProperty("message");
      expect(body.error).toHaveProperty("details");
    });
  });
});
