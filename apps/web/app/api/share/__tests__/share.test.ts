// ─── Share API Tests ───
// Source: docs/03-api-websocket-contract.md §7 — Public Sharing
// Acceptance criteria:
//   POST generates 64-char hex hash
//   DELETE revokes share link
//   GET /p/[hash] renders without auth
//   Password-protected: valid password returns data, invalid returns 401
//   Expired link returns "expired"

import { describe, it, expect, beforeAll, vi } from "vitest";
import crypto from "crypto";

// ─── Mocks ───

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  delete: vi.fn(),
};

vi.mock("@novacal/db/client", () => ({
  db: mockDb,
}));

const mockSchema = {
  publicLinks: { id: "pl.id", hash: "pl.hash", entityType: "pl.entityType", entityId: "pl.entityId", passwordHash: "pl.passwordHash", expiresAt: "pl.expiresAt", createdAt: "pl.createdAt" },
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
    CONFLICT: "CONFLICT",
    INTERNAL_ERROR: "INTERNAL_ERROR",
    RATE_LIMITED: "RATE_LIMITED",
    NOT_FOUND: "NOT_FOUND",
    FORBIDDEN: "FORBIDDEN",
  },
};

vi.mock("../../../../../lib/errors", () => mockErrors);
vi.mock("../../../../../../lib/errors", () => mockErrors);

const mockAuth = {
  requireAuth: vi.fn(),
};

vi.mock("../../../../../lib/auth", () => mockAuth);
vi.mock("../../../../../../lib/auth", () => mockAuth);

const mockBcrypt = { hash: vi.fn(), compare: vi.fn() };
vi.mock("bcryptjs", () => ({
  default: mockBcrypt,
  hash: mockBcrypt.hash,
  compare: mockBcrypt.compare,
}));

const { POST: postShare } = await import("../calendar/[id]/route");
const { DELETE: deleteShare } = await import("../[hash]/route");
const { POST: postVerify } = await import("../verify/[hash]/route");

describe("Share API", () => {
  beforeAll(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/share/calendar/:id — Generate share link", () => {
    it("should generate a 64-char hex hash", async () => {
      mockAuth.requireAuth.mockResolvedValue({ sessionUser: { userId: "user-1" }, sessionId: "sess-1", userId: "user-1" });

      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockResolvedValue(undefined),
      });

      const req = new Request("http://localhost:3000/api/share/calendar/cal-1", {
        method: "POST",
        headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      // The handler uses NextRequest, but we can call with a generic Request
      const res = await postShare(req as unknown as Parameters<typeof postShare>[0], {
        params: Promise.resolve({ id: "cal-1" }),
      });
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body).toHaveProperty("hash");
      expect(body.hash).toHaveLength(64); // 32 bytes = 64 hex chars
      expect(body.shareUrl).toContain(body.hash);
      expect(body.hasPassword).toBe(false);

      // Verify the hash is hex
      expect(/^[0-9a-f]{64}$/.test(body.hash)).toBe(true);
    });

    it("should include hasPassword true when password is set", async () => {
      mockAuth.requireAuth.mockResolvedValue({ sessionUser: { userId: "user-1" }, sessionId: "sess-1", userId: "user-1" });
      mockBcrypt.hash.mockResolvedValue("$2a$12$hashedpassword");

      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockResolvedValue(undefined),
      });

      const req = new Request("http://localhost:3000/api/share/calendar/cal-1", {
        method: "POST",
        headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
        body: JSON.stringify({ password: "secret123" }),
      });

      const res = await postShare(req as unknown as Parameters<typeof postShare>[0], {
        params: Promise.resolve({ id: "cal-1" }),
      });
      const body = await res.json();

      expect(body.hasPassword).toBe(true);
      expect(mockBcrypt.hash).toHaveBeenCalledWith("secret123", 12);
    });

    it("should validate expiresAt does not exceed 365 days", async () => {
      mockAuth.requireAuth.mockResolvedValue({ sessionUser: { userId: "user-1" }, sessionId: "sess-1", userId: "user-1" });

      const farFuture = new Date();
      farFuture.setFullYear(farFuture.getFullYear() + 2);

      const req = new Request("http://localhost:3000/api/share/calendar/cal-1", {
        method: "POST",
        headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
        body: JSON.stringify({ expiresAt: farFuture.toISOString() }),
      });

      const res = await postShare(req as unknown as Parameters<typeof postShare>[0], {
        params: Promise.resolve({ id: "cal-1" }),
      });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("DELETE /api/share/:hash — Revoke share link", () => {
    it("should revoke a share link successfully", async () => {
      mockAuth.requireAuth.mockResolvedValue({ sessionUser: { userId: "user-1" }, sessionId: "sess-1", userId: "user-1" });

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: "pl-1" }]),
      });

      mockDb.delete.mockReturnValueOnce({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const req = new Request("http://localhost:3000/api/share/abc123hash", {
        method: "DELETE",
        headers: { Authorization: "Bearer token" },
      });

      const res = await deleteShare(req as unknown as Parameters<typeof deleteShare>[0], {
        params: Promise.resolve({ hash: "abc123hash" }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.status).toBe("revoked");
    });

    it("should return 404 when share link not found", async () => {
      mockAuth.requireAuth.mockResolvedValue({ sessionUser: { userId: "user-1" }, sessionId: "sess-1", userId: "user-1" });

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      });

      const req = new Request("http://localhost:3000/api/share/nonexistent", {
        method: "DELETE",
        headers: { Authorization: "Bearer token" },
      });

      const res = await deleteShare(req as unknown as Parameters<typeof deleteShare>[0], {
        params: Promise.resolve({ hash: "nonexistent" }),
      });
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("POST /api/share/verify/:hash — Verify password", () => {
    it("should return valid=true for correct password", async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: "pl-1", hash: "testhash", entityType: "CALENDAR", entityId: "cal-1", passwordHash: "$2a$12$hashed", expiresAt: null, createdAt: new Date() }]),
      });

      mockBcrypt.compare.mockResolvedValue(true);

      const req = new Request("http://localhost:3000/api/share/verify/testhash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "correct-password" }),
      });

      const res = await postVerify(req as unknown as Parameters<typeof postVerify>[0], {
        params: Promise.resolve({ hash: "testhash" }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.valid).toBe(true);
      expect(body).toHaveProperty("tempToken");
      expect(body.expiresIn).toBe(3600);
    });

    it("should return 401 for incorrect password", async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: "pl-1", hash: "testhash", entityType: "CALENDAR", entityId: "cal-1", passwordHash: "$2a$12$hashed", expiresAt: null, createdAt: new Date() }]),
      });

      mockBcrypt.compare.mockResolvedValue(false);

      const req = new Request("http://localhost:3000/api/share/verify/testhash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "wrong-password" }),
      });

      const res = await postVerify(req as unknown as Parameters<typeof postVerify>[0], {
        params: Promise.resolve({ hash: "testhash" }),
      });
      const body = await res.json();

      expect(res.status).toBe(401);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("should return valid=true without password for unsecured links (no passwordHash)", async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: "pl-2", hash: "pubhash", entityType: "CALENDAR", entityId: "cal-2", passwordHash: null, expiresAt: null, createdAt: new Date() }]),
      });

      const req = new Request("http://localhost:3000/api/share/verify/pubhash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const res = await postVerify(req as unknown as Parameters<typeof postVerify>[0], {
        params: Promise.resolve({ hash: "pubhash" }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.valid).toBe(true);
    });

    it("should return 404 for non-existent share link", async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      });

      const req = new Request("http://localhost:3000/api/share/verify/nonexistent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "test" }),
      });

      const res = await postVerify(req as unknown as Parameters<typeof postVerify>[0], {
        params: Promise.resolve({ hash: "nonexistent" }),
      });
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });
});
